import { reactive } from 'vue'
import {
  fetchStockData,
  fetchTimeSeriesData,
  keywordSuggestion
} from '@/utils/stockParser'

export const stockService = reactive({
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

  // 从本地存储加载
  async loadFromStorage() {
    this.badgeStock = await storage.getLocal('badgeStock', '')
  },

  // 保存到本地存储
  async saveToStorage() {
    await storage.setLocal('badgeStock', this.badgeStock)
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
      this.groups = await storage.getLocal('stockGroups', this.defaultGroups)
      this.currentGroupId = this.groups[0].id

      // 保存默认分组到存储
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

  async saveGroupsOrder() {
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
  },

  // 添加移动股票到其他分组的方法
  async moveStockToGroup(stockCode, fromGroupId, toGroupId) {
    try {
      const fromGroup = this.groups.find((g) => g.id === fromGroupId)
      const toGroup = this.groups.find((g) => g.id === toGroupId)

      if (fromGroup && toGroup) {
        // 从原分组中移除
        const index = fromGroup.stocks.indexOf(stockCode)
        if (index > -1) {
          fromGroup.stocks.splice(index, 1)
        }

        // 添加到目标分组
        if (!toGroup.stocks.includes(stockCode)) {
          toGroup.stocks.push(stockCode)
        }

        await storage.setLocal('stockGroups', this.groups)
        return true
      }
      return false
    } catch (err) {
      console.error('移动股票失败:', err)
      return false
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
