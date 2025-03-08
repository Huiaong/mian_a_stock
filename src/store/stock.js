import { reactive } from 'vue'

export const stockStore = reactive({
  stockList: [], // 自选股列表
  currentStock: null, // 当前关注的股票
  badgeStock: '', // 新增：用于存储要在图标上显示的股票代码

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

  async saveToStorage() {
    await chrome.storage.sync.set({
      stockList: this.stockList,
      badgeStock: this.badgeStock
    })
  },

  async loadFromStorage() {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get(['stockList', 'badgeStock'], (items) => {
          resolve(items)
        })
      })
      console.log('从storage加载的数据:', result)

      // 处理 stockList，确保它是数组形式
      if (result.stockList !== undefined) {
        // 如果是对象形式，转换为数组
        if (
          typeof result.stockList === 'object' &&
          !Array.isArray(result.stockList)
        ) {
          this.stockList = Object.values(result.stockList)
        } else {
          this.stockList = result.stockList
        }
      }

      if (result.badgeStock !== undefined) {
        this.badgeStock = result.badgeStock
      }
    } catch (err) {
      // 打印详细的错误信息，而不是清空数据
      console.error('从storage加载数据失败:', {
        error: err,
        currentStockList: this.stockList,
        currentBadgeStock: this.badgeStock
      })
      // 抛出错误，让上层调用者知道发生了问题
      throw new Error(`加载数据失败: ${err.message}`)
    }
  },

  // 新增：设置要显示在图标上的股票
  async setBadgeStock(code) {
    const numericCode = code.replace(/^(sh|sz)/, '')
    this.badgeStock = numericCode
    await this.saveToStorage()
    // 通知背景页更新
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' })
  }
})
