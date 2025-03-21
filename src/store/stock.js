import { reactive } from 'vue'
import {
  fetchStockData,
  fetchTimeSeriesData,
  keywordSuggestion
} from '@/utils/stockParser'

export const stockSearch = reactive({
  // 修改市场指数代码常量，适配东方财富的代码格式
  MARKET_INDEX_CODES: [
    '1.000001', // 上证指数
    '0.399001', // 深证成指
    '0.399300', // 沪深300
    '0.399640' // 创业板指
  ],

  async fetchStockData(codes) {
    return await fetchStockData(codes)
  },
  async fetchMarketIndexes() {
    return await fetchStockData(this.MARKET_INDEX_CODES)
  },
  async fetchTimeSeriesData(code) {
    return await fetchTimeSeriesData(code)
  }
})

export const sotckSuggestion = reactive({
  stocks: [],
  async keywordSuggestion(query) {
    return await keywordSuggestion(query)
  }
})

export const badge = reactive({
  badgeStock: '',

  // 新增：设置要显示在图标上的股票
  async setBadgeStock(code) {
    const numericCode = code.replace(/^(sh|sz)/, '')
    this.badgeStock = numericCode
    await this.saveToStorage()
    // 通知背景页更新
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' })
  },

  // 如果图标上显示的是code的涨跌幅，则移除
  async removeBadgeStock(code) {
    if (this.badgeStock === code) {
      this.badgeStock = ''
      await this.saveToStorage()
      chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' })
    }
  },

  // 先从本地存储加载，如果本地没有，则从sync加载
  async loadFromStorage() {
    this.badgeStock = await storage.getLocal('badgeStock', null)
    if (this.badgeStock !== null) {
      return
    }

    this.badgeStock = await storage.getSync('badgeStock', '')
  },

  // 保存到本地存储
  async saveToStorage() {
    await storage.setLocal('badgeStock', this.badgeStock)
    await storage.setLocal('badgeIsDirty', true)
  },

  async checkAndSync() {
    const isDirty = await storage.getLocal('badgeIsDirty', false)
    if (isDirty) {
      try {
        await storage.setSync('badgeStock', this.badgeStock)
        await storage.setLocal('badgeIsDirty', false)
      } catch (err) {
        console.error('检查同步失败:', err)
      }
    }
  }
})

export const groupStore = reactive({
  groups: [], // 添加分组数组
  currentGroupId: 'default', // 添加当前分组ID
  defaultGroups: [
    {
      id: 'default',
      name: '今日必涨',
      stocks: []
    }
  ],

  async initGroups() {
    try {
      // 从本地存储读取分组数据
      this.groups = await storage.getLocal('stockGroups', [])

      // 如果本地没有分组数据，尝试从sync读取
      if (this.groups.length === 0) {
        this.groups = await storage.getSync('stockGroups', [])
      }

      // 如果仍然没有分组数据，尝试从旧版本数据迁移
      if (this.groups.length === 0) {
        const migratedStocks = await this.migrateFromV1_0()

        // 如果迁移成功，创建默认分组并添加迁移的股票
        if (migratedStocks && migratedStocks.length > 0) {
          this.groups = [
            {
              id: 'default',
              name: '今日必涨',
              stocks: migratedStocks
            }
          ]

          // 删除旧数据
          await storage.removeLocal('stockList')
          await storage.removeSync('stockList')
        } else {
          // 如果没有迁移到数据，使用默认分组
          this.groups = this.defaultGroups
        }
      }

      this.currentGroupId = this.groups[0].id

      // 保存分组到存储
      await this.saveToStorage()
    } catch (err) {
      console.error('初始化分组失败:', err)
      this.groups = this.defaultGroups
      this.currentGroupId = 'default'
    }
  },

  // 从旧版本数据迁移，返回股票代码数组
  async migrateFromV1_0() {
    try {
      // 尝试读取旧版本的 stockList 数据
      const oldStockList = await chrome.storage.local.get(['stockList'])

      if (!oldStockList) {
        // 尝试从 sync 读取旧数据
        const oldSyncStockList = await chrome.storage.local.get(['stockList'])
        if (!oldSyncStockList) {
          return [] // 没有旧数据
        }

        return this.convertV1_0StockList(oldSyncStockList)
      }

      return this.convertV1_0StockList(oldStockList)
    } catch (err) {
      console.error('从旧版本迁移数据失败:', err)
      return []
    }
  },

  // 转换旧版本的 stockList 对象到股票代码数组
  convertV1_0StockList(oldStockList) {
    const stockCodes = Object.values(oldStockList.stockList)
    return stockCodes.length > 0 ? stockCodes : []
  },

  // 添加通用的保存到存储方法
  async saveToStorage() {
    // 保存到本地存储
    await storage.setLocal('stockGroups', this.groups)
    await storage.setLocal('groupsIsDirty', true) // 标记为脏数据
  },

  getCurrentGroup() {
    return this.groups.find((g) => g.id === this.currentGroupId)
  },

  async saveGroup(groupName, editingGroupId = null) {
    try {
      if (editingGroupId) {
        const group = this.groups.find((g) => g.id === editingGroupId)
        if (group) {
          group.name = groupName.trim()
        }
      } else {
        const newGroup = {
          id: 'group_' + Date.now(),
          name: groupName.trim(),
          stocks: []
        }
        this.groups.push(newGroup)
      }

      // 保存到存储
      await this.saveToStorage()
      return true
    } catch (err) {
      console.error('保存分组失败:', err)
      return false
    }
  },

  async deleteGroup(groupId) {
    try {
      // 如果只剩一个分组，不允许删除
      if (this.groups.length <= 1) return false

      const index = this.groups.findIndex((g) => g.id === groupId)
      if (index > -1) {
        this.groups.splice(index, 1)

        // 如果删除的是当前选中的分组，切换到默认分组
        if (this.currentGroupId === groupId) {
          this.currentGroupId = this.groups[0].id
        }

        // 保存到存储
        await this.saveToStorage()
        return true
      }
      return false
    } catch (err) {
      console.error('删除分组失败:', err)
      return false
    }
  },

  async updateGroupsOrder(newGroupIds) {
    this.groups = this.groups.sort((a, b) => {
      return newGroupIds.indexOf(a.id) - newGroupIds.indexOf(b.id)
    })

    try {
      await this.saveToStorage()
      return true
    } catch (err) {
      console.error('保存分组顺序失败:', err)
      return false
    }
  },

  // 添加保存股票顺序的方法
  async saveStocksOrder(groupId, stocks) {
    try {
      const group = this.groups.find((g) => g.id === groupId)
      if (group) {
        group.stocks = stocks
        await this.saveToStorage()
        return true
      }
      return false
    } catch (err) {
      console.error('保存股票顺序失败:', err)
      return false
    }
  },

  async removeStock(code) {
    const group = this.getCurrentGroup()
    if (group) {
      group.stocks = group.stocks.filter((stock) => stock !== code)
      await this.saveToStorage()
    }
  },

  async getCurrentGroupStocks() {
    const group = this.getCurrentGroup()
    return group ? group.stocks : []
  },

  // 添加检查并同步方法
  async checkAndSync() {
    const isDirty = await storage.getLocal('groupsIsDirty', false)
    if (isDirty) {
      try {
        // 重新从本地存储加载最新数据
        this.groups = await storage.getLocal('stockGroups', this.groups)
        await storage.setSync('stockGroups', this.groups)
        await storage.setLocal('groupsIsDirty', false)
      } catch (err) {
        console.error('检查同步失败:', err)
      }
    }
  }
})

// 添加通用存储方法
const storage = {
  async removeLocal(key) {
    try {
      await chrome.storage.local.remove(key)
    } catch (err) {
      console.error('本地存储删除失败:', err)
      throw err
    }
  },

  async removeSync(key) {
    try {
      await chrome.storage.sync.remove(key)
    } catch (err) {
      console.error('同步存储删除失败:', err)
      throw err
    }
  },

  async setLocal(key, value) {
    try {
      const serializedValue = JSON.stringify(value)
      await chrome.storage.local.set({ [key]: serializedValue })
    } catch (err) {
      console.error('本地存储写入失败:', err)
      throw err
    }
  },

  async getLocal(key, defaultValue = null) {
    try {
      const result = await chrome.storage.local.get([key])
      if (!result[key]) return defaultValue
      return JSON.parse(result[key])
    } catch (err) {
      console.error('本地存储读取失败:', err)
      return defaultValue
    }
  },

  async setSync(key, value) {
    try {
      const serializedValue = JSON.stringify(value)
      await chrome.storage.sync.set({ [key]: serializedValue })
    } catch (err) {
      console.error('同步存储写入失败:', err)
      throw err
    }
  },

  async getSync(key, defaultValue = null) {
    try {
      const result = await chrome.storage.sync.get([key])
      if (!result[key]) return defaultValue
      return JSON.parse(result[key])
    } catch (err) {
      console.error('同步存储读取失败:', err)
      return defaultValue
    }
  }
}

// 同步管理器
export const syncManager = {
  async syncAll() {
    await Promise.all([groupStore.checkAndSync(), badge.checkAndSync()])
  }
}
