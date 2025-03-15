<template>
  <div class="popup_page">
    <!-- 市场指数面板 -->
    <div class="market-index">
      <div class="index-item" v-for="index in marketIndexes" :key="index.code">
        <div class="index-name">{{ index.name }}</div>
        <div class="index-info">
          <div :class="['index-price', index.change >= 0 ? 'up' : 'down']">
            {{ index.price.toFixed(2) }}
          </div>
          <div :class="['index-change', index.change >= 0 ? 'up' : 'down']">
            {{ index.changePercent.toFixed(2) }}%
          </div>
        </div>
      </div>
    </div>

    <div class="divider"></div>

    <!-- 原有的自选股部分 -->
    <div class="header">
      <div class="input-group">
        <div class="search-container">
          <input
            v-model="searchKeyword"
            placeholder="输入股票代码、名称或拼音首字母"
            @input="handleSearch"
            @keyup.enter="addSelectedStock"
          />
          <div v-if="searchResults.length > 0" class="search-results">
            <div
              v-for="result in searchResults"
              :key="result.code"
              class="search-item"
              @click="selectSearchResult(result)"
            >
              <span class="stock-code">{{ result.code }}</span>
              <span class="stock-name">{{ result.name }}</span>
            </div>
          </div>
        </div>
        <button class="add-btn" @click="addSelectedStock">添加</button>
      </div>
    </div>

    <div class="stock-list">
      <div
        v-for="stock in stocks"
        :key="stock.code"
        class="stock-item"
        :class="{
          'is-pinned': stock.code === badgeStock,
          'is-dragging': draggingItem === stock.code,
          'is-drag-over': dragOverItem === stock.code
        }"
        draggable="true"
        @dragstart="handleDragStart($event, stock)"
        @dragend="handleDragEnd"
        @dragover.prevent="handleDragOver($event, stock)"
        @dragenter.prevent="dragOverItem = stock.code"
        @dragleave="dragOverItem = null"
        @drop.prevent="handleDrop($event, stock)"
        @dblclick.stop="
          setBadgeStock(stock.code === badgeStock ? '' : stock.code)
        "
      >
        <div
          class="stock-info"
          :class="{ grabbing: draggingItem === stock.code }"
        >
          <div class="stock-name-code">
            <span class="name">{{ stock.name }}</span>
            <span class="code">{{ stock.code }}</span>
          </div>
          <div class="mini-chart">
            <canvas
              :ref="(el) => setCanvasRef(el, stock.code)"
              width="120"
              height="30"
            ></canvas>
          </div>
          <div class="stock-price">
            <span :class="['current-price', stock.change >= 0 ? 'up' : 'down']">
              {{ stock.price.toFixed(2) }}
            </span>
            <span
              :class="['change-percent', stock.change >= 0 ? 'up' : 'down']"
            >
              {{ stock.change >= 0 ? '' : '-'
              }}{{ Math.abs(stock.changePercent).toFixed(2) }}%
            </span>
          </div>
        </div>
        <div class="stock-actions">
          <button class="remove-btn" @click="removeStock(stock.code)">
            <span class="remove-icon">×</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { stockStore } from '@/store/stock'
import {
  fetchStockData,
  MARKET_INDEX_CODES,
  searchStock,
  fetchTimeSeriesData
} from '@/utils/stockParser'
import { isTradingTime } from '@/utils/tradingTime'

// 添加防抖函数
function useDebounce(fn, delay = 300) {
  let timer = null

  const debounced = (...args) => {
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      fn(...args)
      timer = null
    }, delay)
  }

  onBeforeUnmount(() => {
    if (timer) {
      clearTimeout(timer)
    }
  })

  return debounced
}

export default {
  setup() {
    const newStockCode = ref('')
    const stocks = ref([])
    const marketIndexes = ref([])
    const badgeStock = ref('')
    const searchKeyword = ref('')
    const searchResults = ref([])
    const canvasRefs = ref({})
    const chartData = ref({})
    let updateInterval = null
    let checkIntervalTimer = null
    let timeSeriesInterval = null
    const draggingItem = ref(null)
    const dragOverItem = ref(null)

    const updateStockData = async () => {
      if (stockStore.stockList.length === 0) {
        stocks.value = []
        return
      }

      try {
        const stockDataList = await fetchStockData(stockStore.stockList)
        stocks.value = stockStore.stockList
          .map((code) => {
            return stockDataList.find((data) => data.code === code)
          })
          .filter(Boolean)
      } catch (err) {
        console.error('更新股票数据失败:', err)
      }
    }

    const updateMarketIndexes = async () => {
      try {
        const codes = [
          MARKET_INDEX_CODES.SH,
          MARKET_INDEX_CODES.SZ,
          MARKET_INDEX_CODES.HS300,
          MARKET_INDEX_CODES.KC50
        ]
        const indexData = await fetchStockData(codes)
        marketIndexes.value = indexData.map((data) => {
          return {
            ...data,
            name: getIndexName(data.code)
          }
        })
      } catch (err) {
        console.error('更新市场指数失败:', err)
      }
    }

    const getIndexName = (code) => {
      // 移除可能的 sh/sz 前缀，只比较数字部分
      const codeNumber = code.replace(/^(sh|sz)/, '')
      switch (codeNumber) {
        case '000001':
          return '上证指数'
        case '399001':
          return '深证成指'
        case '399300':
          return '沪深300'
        case '399640':
          return '创业板'
        default:
          return ''
      }
    }

    const handleSearch = async () => {
      if (searchKeyword.value.length < 2) {
        searchResults.value = []
        return
      }
      searchResults.value = await searchStock(searchKeyword.value)
    }

    // 使用防抖包装搜索函数
    const debouncedSearch = useDebounce(handleSearch, 300)

    const selectSearchResult = async (result) => {
      await stockStore.addStock(result.code)
      searchKeyword.value = ''
      searchResults.value = []
      await updateStockData()
      // 添加股票后立即获取分时数据
      await fetchTimeSeries(result.code)
    }

    const removeStock = async (code) => {
      // 如果删除的是当前关注的股票，清除关注
      if (code === badgeStock.value) {
        await stockStore.setBadgeStock('')
        badgeStock.value = ''
        // 通知后台更新图标
        chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' })
      }

      // 清理分时图相关数据
      delete chartData.value[code] // 删除分时数据
      delete canvasRefs.value[code] // 删除canvas引用
      await stockStore.deleteTimeSeriesCache(code) // 删除缓存的分时数据

      // 删除股票
      await stockStore.removeStock(code)
      await updateStockData()
    }

    const setBadgeStock = async (code) => {
      await stockStore.setBadgeStock(code)
      badgeStock.value = code
    }

    const setCanvasRef = (el, code) => {
      if (el) {
        canvasRefs.value[code] = el
        drawMiniChart(code)
      }
    }

    const drawMiniChart = (code) => {
      const canvas = canvasRefs.value[code]
      if (!canvas || !chartData.value[code]) return

      const ctx = canvas.getContext('2d')
      const data = chartData.value[code]
      const width = canvas.width
      const height = canvas.height

      // 清除画布
      ctx.clearRect(0, 0, width, height)

      if (data.length > 0) {
        // 总共需要240个点（4小时交易时间）
        const totalPoints = 240
        const currentPoints = data.length
        const prices = data.map((item) => item.price)
        const basePrice = prices[0] // 使用开盘价作为基准
        const maxDiff = Math.max(
          Math.abs(Math.max(...prices) - basePrice),
          Math.abs(Math.min(...prices) - basePrice)
        )
        const max = basePrice + maxDiff
        const min = basePrice - maxDiff
        const range = max - min || 1

        const padding = 2
        const chartWidth = width - 2 * padding
        const chartHeight = height - 2 * padding

        // 绘制基准线
        ctx.beginPath()
        ctx.strokeStyle = '#999'
        ctx.setLineDash([2, 2])
        const baseY = padding + chartHeight * (1 - (basePrice - min) / range)
        ctx.moveTo(padding, baseY)
        ctx.lineTo(width - padding, baseY)
        ctx.stroke()
        ctx.setLineDash([])

        // 获取对应的股票数据以确定涨跌
        const stock = stocks.value.find((s) => s.code === code)
        const isUp = stock ? stock.change >= 0 : false

        // 绘制分时线
        ctx.beginPath()
        ctx.strokeStyle = isUp ? '#f5222d' : '#52c41a'
        ctx.lineWidth = 1

        // 计算每个点的位置，考虑总长度为240点
        data.forEach((point, index) => {
          // 根据当前点数调整x轴位置，确保线条从左开始绘制
          const x = padding + (chartWidth * index) / (totalPoints - 1)
          const y = padding + chartHeight * (1 - (point.price - min) / range)
          if (index === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        })

        // 如果当前点数小于240，绘制剩余空白部分的边框
        if (currentPoints < totalPoints) {
          const lastPoint = data[data.length - 1]
          const lastX =
            padding + (chartWidth * (currentPoints - 1)) / (totalPoints - 1)
          const lastY =
            padding + chartHeight * (1 - (lastPoint.price - min) / range)

          // 绘制虚线表示未来时间
          ctx.stroke() // 先结束实线部分
          ctx.beginPath()
          ctx.setLineDash([2, 2])
          ctx.moveTo(lastX, lastY)
          ctx.lineTo(width - padding, lastY)
          ctx.strokeStyle = '#999'
          ctx.stroke()
          ctx.setLineDash([])
        } else {
          ctx.stroke()
        }
      }
    }

    const fetchTimeSeries = async (code) => {
      try {
        // 直接使用 stockParser.js 中的方法
        const chartPoints = await fetchTimeSeriesData(code)
        chartData.value[code] = chartPoints
        drawMiniChart(code)
      } catch (error) {
        console.error('获取分时数据失败:', error)
        // 获取失败时，清空数据
        chartData.value[code] = []
        drawMiniChart(code)
      }
    }

    // 动态调整更新频率
    const getUpdateInterval = () => {
      const now = new Date()
      const hour = now.getHours()
      const minute = now.getMinutes()

      // 开盘和收盘前后加快更新频率
      if (
        (hour === 9 && minute >= 25) ||
        (hour === 11 && minute >= 25) ||
        (hour === 13 && minute <= 5) ||
        (hour === 14 && minute >= 55)
      ) {
        return 1000 // 1秒
      }

      // 非交易时间降低更新频率
      if (!isTradingTime()) {
        return 30000 // 30秒
      }

      return 3000 // 默认3秒
    }

    // 更新定时器
    const updateTimer = () => {
      if (updateInterval) {
        clearInterval(updateInterval)
      }

      // 主更新定时器 - 更新股票数据和市场指数
      updateInterval = setInterval(async () => {
        if (isTradingTime()) {
          await Promise.all([updateStockData(), updateMarketIndexes()])
        }
      }, getUpdateInterval())
    }

    const handleDragStart = (e, stock) => {
      draggingItem.value = stock.code
      e.dataTransfer.effectAllowed = 'move'
      e.target.classList.add('dragging')

      // 创建自定义拖动图像
      const dragEl = e.target.cloneNode(true)
      dragEl.style.position = 'fixed'
      dragEl.style.top = '-1000px'
      dragEl.style.opacity = '0'
      document.body.appendChild(dragEl)
      e.dataTransfer.setDragImage(dragEl, 0, 0)
      setTimeout(() => document.body.removeChild(dragEl), 0)
    }

    const handleDragEnd = async () => {
      draggingItem.value = null
      dragOverItem.value = null
      document.querySelectorAll('.stock-item').forEach((el) => {
        el.classList.remove('dragging')
      })
      await stockStore.saveToStorage()
    }

    const handleDragOver = (e, stock) => {
      if (!draggingItem.value || draggingItem.value === stock.code) return

      const draggedIndex = stocks.value.findIndex(
        (s) => s.code === draggingItem.value
      )
      const targetIndex = stocks.value.findIndex((s) => s.code === stock.code)

      if (draggedIndex === -1 || targetIndex === -1) return

      const rect = e.currentTarget.getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      const moveAfter = e.clientY > midY

      if (
        (moveAfter && draggedIndex < targetIndex) ||
        (!moveAfter && draggedIndex > targetIndex)
      ) {
        const newStocks = [...stocks.value]
        const [draggedStock] = newStocks.splice(draggedIndex, 1)
        newStocks.splice(targetIndex, 0, draggedStock)
        stocks.value = newStocks
        stockStore.stockList = newStocks.map((s) => s.code)
      }
    }

    const handleDrop = () => {
      dragOverItem.value = null
    }

    onMounted(async () => {
      try {
        await Promise.all([stockStore.loadFromStorage(), updateMarketIndexes()])
        await updateStockData()
        badgeStock.value = stockStore.badgeStock

        // 初始化分时图数据
        for (const stock of stocks.value) {
          await fetchTimeSeries(stock.code)
        }

        // 设置主定时刷新
        updateTimer()

        // 设置分时图定时刷新 - 每分钟更新一次
        timeSeriesInterval = setInterval(async () => {
          if (isTradingTime()) {
            await Promise.all(
              stocks.value.map((stock) => fetchTimeSeries(stock.code))
            )
          }
        }, 60000) // 每分钟更新一次

        // 定期检查并调整更新频率
        checkIntervalTimer = setInterval(() => {
          updateTimer()
        }, 60000) // 每分钟检查一次
      } catch (err) {
        console.error('初始化失败:', err)
        alert('加载股票列表失败: ' + err.message)
      }
    })

    // 添加组件卸载前的清理
    onBeforeUnmount(() => {
      if (updateInterval) {
        clearInterval(updateInterval)
        updateInterval = null
      }
      if (timeSeriesInterval) {
        clearInterval(timeSeriesInterval)
        timeSeriesInterval = null
      }
      if (checkIntervalTimer) {
        clearInterval(checkIntervalTimer)
        checkIntervalTimer = null
      }
    })

    return {
      newStockCode,
      stocks,
      marketIndexes,
      removeStock,
      badgeStock,
      setBadgeStock,
      searchKeyword,
      searchResults,
      handleSearch: debouncedSearch,
      selectSearchResult,
      setCanvasRef,
      handleDragStart,
      handleDragEnd,
      handleDragOver,
      handleDrop,
      draggingItem,
      dragOverItem
    }
  }
}
</script>

<style lang="less" scoped>
.popup_page {
  width: 360px;
  height: 500px;
  padding: 12px;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
    Arial, sans-serif;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

.market-index {
  display: flex;
  justify-content: space-between;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 8px 12px;
  background: #fff;

  .index-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 4px;

    .index-name {
      font-size: 15px;
      font-weight: 500;
      color: #333;
      margin-bottom: 4px;
    }

    .index-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;

      .index-price {
        font-size: 14px;
        font-weight: 500;
        line-height: 1.2;
        margin-bottom: 2px;

        &.up {
          color: #f5222d;
        }
        &.down {
          color: #52c41a;
        }
      }

      .index-change {
        font-size: 13px;
        line-height: 1.2;

        &.up {
          color: #f5222d;
        }
        &.down {
          color: #52c41a;
        }
      }
    }
  }
}

.divider {
  height: 1px;
  background: #f0f0f0;
  margin: 0 0 12px 0;
  flex-shrink: 0;
}

.header {
  margin-bottom: 12px;
  flex-shrink: 0;

  .input-group {
    display: flex;
    align-items: center;
    width: 100%;

    .search-container {
      position: relative;
      flex: 1;
      margin-right: 36px;

      input {
        width: 100%;
        padding: 6px 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 13px;
        height: 32px;

        &::placeholder {
          font-size: 12px;
          color: #999;
        }

        &:focus {
          outline: none;
          border-color: #40a9ff;
          box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
        }
      }
    }

    .add-btn {
      width: 50px;
      height: 32px;
      line-height: 32px;
      font-size: 13px;
      background: #1890ff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;

      &:hover {
        background: #40a9ff;
      }
    }
  }
}

.stock-list {
  background: #fff;
  border-radius: 4px;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  margin-bottom: 12px;
  position: relative;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: #e8e8e8;
    border-radius: 3px;

    &:hover {
      background-color: #d9d9d9;
    }
  }

  .stock-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 9px;
    border-bottom: 1px solid #f0f0f0;
    user-select: none;
    background: white;
    transition: transform 0.2s ease;

    &:last-child {
      border-bottom: none;
    }

    &.is-pinned {
      background: rgba(24, 144, 255, 0.05);
    }

    &.is-dragging {
      opacity: 0.5;
      background: #f0f7ff;
    }

    &.is-drag-over {
      transform: translate3d(10px, 10px, 10px);

      &::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        height: 2px;
        bottom: -1px;
      }
    }

    .stock-info {
      flex: 1;
      display: flex;
      align-items: center;
      margin-right: 8px;
      cursor: grab;

      &.grabbing {
        cursor: grabbing;
      }

      .stock-name-code {
        width: 80px;
        flex-shrink: 0;

        .name {
          font-size: 15px;
          font-weight: 500;
          color: #333;
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .code {
          font-size: 12px;
          color: #999;
          display: block;
        }
      }

      .mini-chart {
        width: 120px;
        height: 30px;
        margin: 0 8px;
        flex-shrink: 0;
      }

      .stock-price {
        width: 60px;
        text-align: right;
        flex-shrink: 0;
        margin-left: auto;

        .current-price {
          display: block;
          font-size: 16px;
          font-weight: 500;
          margin-bottom: 2px;
        }

        .change-percent {
          font-size: 13px;
        }
      }
    }

    .stock-actions {
      width: 32px;
      flex-shrink: 0;

      .remove-btn {
        padding: 4px 8px;
        background: transparent;
        border: none;
        color: #999;
        cursor: pointer;
        font-size: 16px;
        transition: color 0.3s;

        &:hover {
          color: #666;
        }
      }
    }
  }
}

.up {
  color: #f5222d !important;
}

.down {
  color: #52c41a !important;
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  width: 256px;
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  margin-top: 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: #e8e8e8;
    border-radius: 3px;
  }
}

.search-item {
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #f5f5f5;
  }

  .stock-code {
    font-size: 13px;
    color: #666;
    width: 80px;
    margin-right: 8px;
  }

  .stock-name {
    font-size: 13px;
    color: #333;
    flex: 1;
  }
}
</style>
