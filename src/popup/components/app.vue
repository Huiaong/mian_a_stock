<template>
  <div class="popup_page">
    <!-- 市场指数面板 -->
    <div class="market-index">
      <div class="index-item" v-for="index in marketIndexes" :key="index.code">
        <div class="index-name">{{ index.name }}</div>
        <div :class="['index-price', index.change >= 0 ? 'up' : 'down']">
          {{ index.price.toFixed(2) }}
        </div>
        <div :class="['index-change', index.change >= 0 ? 'up' : 'down']">
          {{ index.change >= 0 ? '' : '-'
          }}{{ Math.abs(index.changePercent).toFixed(2) }}%
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

    <draggable
      v-model="stocks"
      class="stock-list"
      :animation="200"
      ghost-class="ghost-item"
      chosen-class="chosen-item"
      drag-class="drag-item"
      @start="onDragStart"
      @end="onDragEnd"
      item-key="code"
      handle=".stock-info"
    >
      <template #item="{ element: stock }">
        <div
          class="stock-item"
          @dblclick.stop="
            setBadgeStock(stock.code === badgeStock ? '' : stock.code)
          "
          :class="{ 'is-pinned': stock.code === badgeStock }"
        >
          <div class="stock-info">
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
              <span
                :class="['current-price', stock.change >= 0 ? 'up' : 'down']"
              >
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
      </template>
    </draggable>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { stockStore } from '@/store/stock'
import {
  fetchStockData,
  MARKET_INDEX_CODES,
  searchStock
} from '@/utils/stockParser'
import { isTradingTime } from '@/utils/tradingTime'
import draggable from 'vuedraggable'

export default {
  components: {
    draggable
  },
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

    const selectSearchResult = async (result) => {
      await stockStore.addStock(result.code)
      searchKeyword.value = ''
      searchResults.value = []
      await updateStockData()
      // 添加股票后立即获取分时数据
      await fetchTimeSeriesData(result.code)
    }

    const removeStock = async (code) => {
      // 如果删除的是当前关注的股票，清除关注
      if (code === badgeStock.value) {
        await stockStore.setBadgeStock('')
        badgeStock.value = ''
        // 通知后台更新图标
        chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' })
      }
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

        data.forEach((point, index) => {
          const x = padding + (chartWidth * index) / (data.length - 1)
          const y = padding + chartHeight * (1 - (point.price - min) / range)
          if (index === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        })

        // 添加渐变填充
        const gradient = ctx.createLinearGradient(0, 0, 0, height)
        if (isUp) {
          gradient.addColorStop(0, 'rgba(245, 34, 45, 0.1)')
          gradient.addColorStop(1, 'rgba(245, 34, 45, 0)')
        } else {
          gradient.addColorStop(0, 'rgba(82, 196, 26, 0.1)')
          gradient.addColorStop(1, 'rgba(82, 196, 26, 0)')
        }

        ctx.stroke()
        ctx.lineTo(width - padding, height - padding)
        ctx.lineTo(padding, height - padding)
        ctx.closePath()
        ctx.fillStyle = gradient
        ctx.fill()
      }
    }

    const fetchTimeSeriesData = async (code) => {
      try {
        const formattedCode = code.startsWith('6') ? `sh${code}` : `sz${code}`
        const response = await fetch(
          `https://web.ifzq.gtimg.cn/appstock/app/minute/query?_var=min_data_${formattedCode}&code=${formattedCode}`
        )
        const text = await response.text()

        // 解析数据，移除 JavaScript 变量声明部分
        const jsonStr = text.replace(`min_data_${formattedCode}=`, '')
        const data = JSON.parse(jsonStr)

        // 提取分时数据
        const minData = data.data[formattedCode].data.data
        const chartPoints = minData.map((item) => {
          const [time, price] = item.split(' ')
          return {
            time,
            price: parseFloat(price)
          }
        })

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

      updateInterval = setInterval(async () => {
        if (isTradingTime()) {
          await Promise.all([
            updateStockData(),
            updateMarketIndexes(),
            ...stocks.value.map((stock) => fetchTimeSeriesData(stock.code))
          ])
        }
      }, getUpdateInterval())
    }

    // 添加拖拽相关方法
    const onDragStart = () => {
      // 开始拖拽时的处理
    }

    const onDragEnd = async () => {
      // 更新 stockStore 中的顺序
      stockStore.stockList = stocks.value.map((stock) => stock.code)
      await stockStore.saveToStorage()
    }

    onMounted(async () => {
      try {
        await Promise.all([stockStore.loadFromStorage(), updateMarketIndexes()])
        await updateStockData()
        badgeStock.value = stockStore.badgeStock

        // 初始化分时图数据
        for (const stock of stocks.value) {
          await fetchTimeSeriesData(stock.code)
        }

        // 设置定时刷新，同时更新股票数据和分时图
        updateTimer()

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
      handleSearch,
      selectSearchResult,
      setCanvasRef,
      onDragStart,
      onDragEnd
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
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 12px;
  background: #fff;
  padding: 12px;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;

  .index-item {
    user-select: none;
    -webkit-user-select: none;
  }
}

.divider {
  height: 1px;
  background: #f0f0f0;
  margin: 0 0 12px 0;
  flex-shrink: 0;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 0 4px;

  span {
    font-size: 14px;
    font-weight: 500;
    color: #333;
  }

  .settings-btn {
    padding: 4px 12px;
    font-size: 12px;
    color: #1890ff;
    background: transparent;
    border: none;
    cursor: pointer;

    &:hover {
      color: #40a9ff;
    }
  }
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
      width: auto;
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
      flex-shrink: 0;
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
  padding: 0;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  margin-bottom: 12px;

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

  &::-webkit-scrollbar-track {
    background-color: transparent;
  }

  .stock-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 9px;
    border-bottom: 1px solid #f0f0f0;
    user-select: none;
    -webkit-user-select: none;

    &:last-child {
      border-bottom: none;
    }

    .stock-info {
      flex: 1;
      display: flex;
      align-items: center;
      margin-right: 8px;

      .stock-name-code {
        width: 68px;
        flex-shrink: 0;

        .name {
          font-size: 15px;
          font-weight: 500;
          color: #333;
          margin-right: 8px;
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
          white-space: nowrap;
        }

        .change-percent {
          font-size: 13px;
          white-space: nowrap;
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

        .remove-icon {
          display: block;
          line-height: 1;
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

.stock-item {
  &.is-pinned {
    background: rgba(24, 144, 255, 0.05);
  }
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

  &::-webkit-scrollbar-track {
    background-color: transparent;
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

// 添加拖拽相关样式
.ghost-item {
  opacity: 0.5;
  background: #f0f0f0;
}

.chosen-item {
  background: #f5f5f5;
}

.drag-item {
  opacity: 0.8;
  transform: scale(0.95);
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stock-item {
  transition: all 0.3s;
}
</style>
