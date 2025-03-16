import { badge } from '@/store/stock'
import { fetchStockData } from '@/utils/stockParser'
import { isTradingTime } from '@/utils/tradingTime'

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
  await badge.loadFromStorage()

  // 如果没有设置要显示的股票，则不显示badge
  if (!badge.badgeStock) {
    chrome.action.setBadgeText({ text: '' })
    return
  }

  try {
    const stockDataList = await fetchStockData([badge.badgeStock])
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
    await badge.loadFromStorage()
    await updateStockData()

    setInterval(() => {
      if (isTradingTime()) {
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
