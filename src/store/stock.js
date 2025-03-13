import { reactive } from 'vue'
import { fetchStockData } from '../utils/stockParser'

// 添加节流函数
function throttle(func, wait) {
  let timeout = null
  let savedArgs = null

  return function wrapper(...args) {
    if (timeout === null) {
      func.apply(this, args)
      timeout = setTimeout(() => {
        if (savedArgs) {
          wrapper.apply(this, savedArgs)
          savedArgs = null
        } else {
          timeout = null
        }
      }, wait)
    } else {
      savedArgs = args
    }
  }
}

// 缓存相关的工具函数
const timeSeriesCache = {
  async get(code) {
    try {
      const result = await chrome.storage.local.get(['timeSeriesCache'])
      const cache = result.timeSeriesCache || {}
      if (!cache[code]) return null
      
      const now = Date.now()
      const cacheTimeout = 60000 // 1分钟缓存
      
      if (now - cache[code].timestamp < cacheTimeout) {
        return cache[code].data
      }
      
      // 缓存过期，删除它
      await this.delete(code)
      return null
    } catch (err) {
      console.error('读取缓存失败:', err)
      return null
    }
  },

  async set(code, data) {
    try {
      const result = await chrome.storage.local.get(['timeSeriesCache'])
      const cache = result.timeSeriesCache || {}
      
      cache[code] = {
        data,
        timestamp: Date.now()
      }
      
      await chrome.storage.local.set({ timeSeriesCache: cache })
    } catch (err) {
      console.error('保存缓存失败:', err)
    }
  },

  async delete(code) {
    try {
      const result = await chrome.storage.local.get(['timeSeriesCache'])
      const cache = result.timeSeriesCache || {}
      
      delete cache[code]
      await chrome.storage.local.set({ timeSeriesCache: cache })
    } catch (err) {
      console.error('删除缓存失败:', err)
    }
  },

  async clear() {
    try {
      await chrome.storage.local.remove('timeSeriesCache')
    } catch (err) {
      console.error('清除缓存失败:', err)
    }
  },

  async cleanExpired() {
    try {
      const result = await chrome.storage.local.get(['timeSeriesCache'])
      const cache = result.timeSeriesCache || {}
      const now = Date.now()
      const cacheTimeout = 60000 // 1分钟缓存
      let hasExpired = false

      // 检查并删除过期数据
      for (const code in cache) {
        if (now - cache[code].timestamp >= cacheTimeout) {
          delete cache[code]
          hasExpired = true
        }
      }

      // 只有在有过期数据时才更新存储
      if (hasExpired) {
        await chrome.storage.local.set({ timeSeriesCache: cache })
      }
    } catch (err) {
      console.error('清理过期缓存失败:', err)
    }
  }
}

export const stockStore = reactive({
  stockList: [], // 自选股列表
  currentStock: null, // 当前关注的股票
  badgeStock: '', // 新增：用于存储要在图标上显示的股票代码
  stockCache: new Map(), // 添加缓存
  cacheExpireTime: 3000, // 缓存过期时间（毫秒）
  requestStatus: {
    loading: false,
    error: null,
    lastUpdate: null
  },

  // 添加缓存相关方法
  getTimeSeriesCache: (code) => timeSeriesCache.get(code),
  setTimeSeriesCache: (code, data) => timeSeriesCache.set(code, data),
  deleteTimeSeriesCache: (code) => timeSeriesCache.delete(code),
  clearTimeSeriesCache: () => timeSeriesCache.clear(),
  cleanExpiredTimeSeriesCache: () => timeSeriesCache.cleanExpired(),

  async addStock(code) {
    // 确保只存储数字代码
    const numericCode = code.replace(/^(sh|sz)/, '')
    if (!this.stockList.includes(numericCode)) {
      this.stockList.unshift(numericCode)
      await this.saveToStorage()
    }
  },

  async removeStock(code) {
    const numericCode = code.replace(/^(sh|sz)/, '')
    const index = this.stockList.indexOf(numericCode)
    if (index > -1) {
      this.stockList.splice(index, 1)
      await this.saveToStorage()
    }
  },

  // 使用本地存储作为备份
  async saveToStorage() {
    // 先保存到 local storage
    await chrome.storage.local.set({
      stockList: this.stockList,
      badgeStock: this.badgeStock,
      lastUpdate: Date.now()
    })

    // 节流后的同步存储
    this.throttledSyncStorage()

    // 通知后台更新
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' })
  },

  // 节流后的同步存储方法
  throttledSyncStorage: throttle(async function () {
    try {
      await chrome.storage.sync.set({
        stockList: this.stockList,
        badgeStock: this.badgeStock,
        lastUpdate: Date.now()
      })
    } catch (err) {
      console.warn('同步存储失败，将使用本地存储作为备份:', err)
    }
  }, 30000), // 30秒内的修改会被合并

  async loadFromStorage() {
    try {
      // 先从本地存储加载
      const localData = await new Promise((resolve) => {
        chrome.storage.local.get(
          ['stockList', 'badgeStock', 'lastUpdate'],
          (items) => {
            resolve(items)
          }
        )
      })

      // 如果本地存储有数据，直接使用
      if (localData.lastUpdate) {
        if (localData.stockList) {
          this.stockList = Array.isArray(localData.stockList)
            ? localData.stockList
            : Object.values(localData.stockList)
        }
        if (localData.badgeStock !== undefined) {
          this.badgeStock = localData.badgeStock
        }

        // 异步加载同步存储的数据，用于后续更新
        this.loadSyncStorage()
        return
      }

      // 如果本地没有数据，则尝试从同步存储加载
      const syncData = await new Promise((resolve) => {
        chrome.storage.sync.get(
          ['stockList', 'badgeStock', 'lastUpdate'],
          (items) => {
            resolve(items)
          }
        )
      })

      if (syncData.stockList) {
        this.stockList = Array.isArray(syncData.stockList)
          ? syncData.stockList
          : Object.values(syncData.stockList)
      }

      if (syncData.badgeStock !== undefined) {
        this.badgeStock = syncData.badgeStock
      }

      // 如果从同步存储加载到了数据，保存到本地存储
      if (syncData.lastUpdate) {
        await chrome.storage.local.set({
          stockList: this.stockList,
          badgeStock: this.badgeStock,
          lastUpdate: syncData.lastUpdate
        })
      }
    } catch (err) {
      console.error('从存储加载数据失败:', err)
      throw new Error(`加载数据失败: ${err.message}`)
    }
  },

  // 添加异步加载同步存储的方法
  async loadSyncStorage() {
    try {
      const syncData = await new Promise((resolve) => {
        chrome.storage.sync.get(
          ['stockList', 'badgeStock', 'lastUpdate'],
          (items) => {
            resolve(items)
          }
        )
      })

      // 如果同步存储的数据更新，则更新本地数据
      if (syncData.lastUpdate > (await this.getLocalLastUpdate())) {
        if (syncData.stockList) {
          this.stockList = Array.isArray(syncData.stockList)
            ? syncData.stockList
            : Object.values(syncData.stockList)
        }
        if (syncData.badgeStock !== undefined) {
          this.badgeStock = syncData.badgeStock
        }
        // 更新本地存储
        await chrome.storage.local.set({
          stockList: this.stockList,
          badgeStock: this.badgeStock,
          lastUpdate: syncData.lastUpdate
        })
      }
    } catch (err) {
      console.warn('加载同步存储数据失败:', err)
    }
  },

  // 获取本地存储的最后更新时间
  async getLocalLastUpdate() {
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['lastUpdate'], (items) => {
        resolve(items.lastUpdate || 0)
      })
    })
    return result
  },

  // 新增：设置要显示在图标上的股票
  async setBadgeStock(code) {
    const numericCode = code.replace(/^(sh|sz)/, '')
    this.badgeStock = numericCode
    await this.saveToStorage()
    // 通知背景页更新
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' })
  },

  // 添加缓存方法
  setCacheData(code, data) {
    this.stockCache.set(code, {
      data,
      timestamp: Date.now()
    })
  },

  getCacheData(code) {
    const cached = this.stockCache.get(code)
    if (!cached) return null

    // 检查缓存是否过期
    if (Date.now() - cached.timestamp > this.cacheExpireTime) {
      this.stockCache.delete(code)
      return null
    }

    return cached.data
  },

  // 清理过期缓存
  cleanExpiredCache() {
    const now = Date.now()
    for (const [code, cached] of this.stockCache.entries()) {
      if (now - cached.timestamp > this.cacheExpireTime) {
        this.stockCache.delete(code)
      }
    }
  },

  async updateStockData() {
    this.requestStatus.loading = true
    this.requestStatus.error = null

    try {
      // 检查缓存
      const cachedData = this.getCacheData('stockData')
      if (cachedData) {
        return cachedData
      }

      const data = await fetchStockData(this.stockList)

      // 更新缓存
      this.setCacheData('stockData', data)
      this.requestStatus.lastUpdate = Date.now()

      return data
    } catch (error) {
      this.requestStatus.error = error
      throw error
    } finally {
      this.requestStatus.loading = false
    }
  }
})
