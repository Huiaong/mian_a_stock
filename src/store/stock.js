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
    this.badgeStock = await storage.getLocal('badgeStock', '')
    if (this.badgeStock) {
      return
    }

    this.badgeStock = await storage.getSync('badgeStock', '')
  },

  // 保存到本地存储
  async saveToStorage() {
    // 保存到本地存储
    await storage.setLocal('badgeStock', this.badgeStock)

    // 加载上次同步时间
    this.lastSyncTime = await storage.getLocal('lastBadgeSyncTime', 0)
    // 检查上次同步时间，如果超过30秒则同步到sync
    const now = Date.now()
    if (now - this.lastSyncTime > 30000) {
      // 30秒 = 30000毫秒
      try {
        await storage.setSync('badgeStock', this.badgeStock)
        // 更新同步时间
        this.lastSyncTime = now
        await storage.setLocal('lastBadgeSyncTime', now)
      } catch (err) {
        console.error('同步到sync存储失败:', err)
        // 同步失败不影响主流程，继续执行
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
      if (this.groups.length === 0) {
        this.groups = await storage.getSync('stockGroups', this.defaultGroups)
      }
      this.currentGroupId = this.groups[0].id

      // 保存分组到存储
      await storage.setLocal('stockGroups', this.groups)
    } catch (err) {
      console.error('初始化分组失败:', err)
      this.groups = this.defaultGroups
      this.currentGroupId = 'default'
    }
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
      await storage.setLocal('stockGroups', this.groups)
      return true
    } catch (err) {
      console.error('保存分组失败:', err)
      return false
    }
  },

  async deleteGroup(groupId) {
    try {
      if (groupId === 'default') return false

      const index = this.groups.findIndex((g) => g.id === groupId)
      if (index > -1) {
        this.groups.splice(index, 1)

        if (this.currentGroupId === groupId) {
          this.currentGroupId = 'default'
        }

        // 保存到存储
        await storage.setLocal('stockGroups', this.groups)
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
      await storage.setLocal('stockGroups', this.groups)
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
        await storage.setLocal('stockGroups', this.groups)
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
      await this.saveStocksOrder(group.id, group.stocks)
    }
  },

  async getCurrentGroupStocks() {
    const group = this.getCurrentGroup()
    return group ? group.stocks : []
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
