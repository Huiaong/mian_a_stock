import { stockStore } from '@/store/stock'
import { fetchStockData } from '@/utils/stockParser'

console.log('background service worker started')

// 更新图标显示
function updateBadge(change) {
  const color = change >= 0 ? [235, 87, 87, 255] : [39, 174, 96, 255]
  const text = Math.abs(change).toFixed(2)

  chrome.action.setBadgeBackgroundColor({ color })
  chrome.action.setBadgeText({ text })
}

// 定时获取股票数据
async function updateStockData() {
  await stockStore.loadFromStorage()

  // 如果没有设置要显示的股票，则不显示badge
  if (!stockStore.badgeStock) {
    chrome.action.setBadgeText({ text: '' })
    return
  }

  try {
    const stockDataList = await fetchStockData([stockStore.badgeStock])
    if (stockDataList.length > 0) {
      updateBadge(stockDataList[0].changePercent)
    }
  } catch (error) {
    console.error('获取股票数据失败:', error)
    chrome.action.setBadgeText({ text: 'ERR' })
  }
}

// 添加消息监听
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'UPDATE_BADGE') {
    updateStockData()
  }
})

// 初始化
async function init() {
  try {
    await stockStore.loadFromStorage()
    await updateStockData()

    setInterval(() => {
      const now = new Date()
      const hour = now.getHours()
      const minute = now.getMinutes()
      const time = hour * 100 + minute

      if ((time >= 930 && time <= 1130) || (time >= 1300 && time <= 1500)) {
        updateStockData()
      }
    }, 3000)
  } catch (err) {
    console.error('初始化失败:', err)
    // 在图标上显示错误状态
    chrome.action.setBadgeText({ text: 'ERR' })
    chrome.action.setBadgeBackgroundColor({ color: [255, 0, 0, 255] })
  }
}

init()
