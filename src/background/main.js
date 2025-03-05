import hotReload from '@/utils/hotReload'
import { stockStore } from '@/store/stock'
import { fetchStockData } from '@/utils/stockParser'

hotReload()
console.log('this is background main.js')

// 更新图标显示
function updateBadge(change) {
  const color = change >= 0 ? [255, 0, 0, 255] : [0, 255, 0, 255]
  const text = change.toFixed(1) + '%'
  
  chrome.browserAction.setBadgeBackgroundColor({ color })
  chrome.browserAction.setBadgeText({ text })
}

// 定时获取股票数据
async function updateStockData() {
  await stockStore.loadFromStorage()
  
  // 如果没有设置要显示的股票，则不显示badge
  if (!stockStore.badgeStock) {
    chrome.browserAction.setBadgeText({ text: '' })
    return
  }
  
  try {
    const stockDataList = await fetchStockData([stockStore.badgeStock])
    if (stockDataList.length > 0) {
      updateBadge(stockDataList[0].changePercent)
    }
  } catch (error) {
    console.error('获取股票数据失败:', error)
    chrome.browserAction.setBadgeText({ text: 'ERR' })
  }
}

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
    }, 10000)
  } catch (err) {
    console.error('初始化失败:', err)
    // 在图标上显示错误状态
    chrome.browserAction.setBadgeText({ text: 'ERR' })
    chrome.browserAction.setBadgeBackgroundColor({ color: [255, 0, 0, 255] })
  }
}

init()
