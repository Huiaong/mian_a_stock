<template>
  <div class="dashboard-container">
    <market-index :market-indexes="marketIndexes" />
    <div class="divider"></div>
    <stock-search @select="selectSearchResult" />
    <group-tabs
      v-model="currentGroup"
      :groups="groups"
      :stocks="stocks"
      :badge-stock="badgeStock"
      :chart-data="chartData"
      @groupChange="handleGroupChange"
      @showManage="showGroupDialog = true"
      @remove="removeStock"
      @setBadge="setBadgeStock"
      @canvas-ready="handleCanvasReady"
      @stockReload="updateStockData"
      @show-kline="showKLine"
    />
    <group-manage-dialog
      v-model="showGroupDialog"
      :groups="groups"
      @update:groups="handleGroupsUpdate"
    />
  </div>
</template>

<script>
import { defineComponent, ref, onMounted, onBeforeUnmount } from 'vue'
import { groupStore, badge, stockSearch, syncManager } from '@/store/stock'
import { isTradingTime } from '@/utils/tradingTime'
import MarketIndex from '@/popup/components/MarketIndex.vue'
import StockSearch from '@/popup/components/StockSearch.vue'
import GroupTabs from '@/popup/components/GroupTabs.vue'
import GroupManageDialog from '@/popup/components/GroupManageDialog.vue'

export default defineComponent({
  name: 'DashBoard',
  components: {
    MarketIndex,
    StockSearch,
    GroupTabs,
    GroupManageDialog
  },
  emits: ['show-kline'],
  setup(props, { emit }) {
    const stocks = ref([])
    const groups = ref([])
    const marketIndexes = ref([])
    const badgeStock = ref('')
    const chartData = ref({})
    let updateInterval = null
    let checkIntervalTimer = null
    let timeSeriesInterval = null
    const showGroupDialog = ref(false)
    const currentGroup = ref('')

    onMounted(async () => {
      try {
        await groupStore.initGroups()

        currentGroup.value = groupStore.currentGroupId
        groups.value = groupStore.groups
        badgeStock.value = badge.badgeStock

        const currentGroupData = groupStore.getCurrentGroup()
        if (currentGroupData) {
          stocks.value = currentGroupData.stocks.map((code) => ({
            code,
            name: '',
            price: 0,
            change: 0,
            changePercent: 0,
            marketValue: 0,
            amount: 0
          }))
        }

        await Promise.all([updateStockData(), updateMarketIndexes()])

        stocks.value.forEach((stock) => {
          fetchTimeSeries(stock.code)
        })

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

        // 添加页面关闭事件监听
        window.addEventListener('beforeunload', handleBeforeUnload)
      } catch (err) {
        console.error('初始化失败:', err)
      }
    })

    onBeforeUnmount(() => {
      if (updateInterval) clearInterval(updateInterval)
      if (timeSeriesInterval) clearInterval(timeSeriesInterval)
      if (checkIntervalTimer) clearInterval(checkIntervalTimer)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    })

    const showKLine = (code, name) => {
      emit('show-kline', code, name)
    }

    // 更新股票数据
    const updateStockData = async () => {
      try {
        const currentGroupData = groupStore.getCurrentGroup()
        if (!currentGroupData || !currentGroupData.stocks.length) return

        const stockCodes = currentGroupData.stocks
        const stockData = await stockSearch.fetchStockData(stockCodes)

        // 更新股票数据
        stocks.value = stockCodes.map((code) => {
          const data = stockData.find((s) => s.code === code)
          if (!data) {
            return {
              code,
              name: '',
              price: 0,
              change: 0,
              changePercent: 0,
              marketValue: 0,
              amount: 0
            }
          }
          return data
        })

        // 如果有设置徽章，更新徽章
        if (badge.badgeStock) {
          const badgeStockData = stocks.value.find(
            (s) => s.code === badge.badgeStock
          )
          if (badgeStockData) {
            chrome.runtime.sendMessage({
              type: 'UPDATE_BADGE_DATA',
              data: badgeStockData
            })
          }
        }
      } catch (error) {
        console.error('更新股票数据失败:', error)
      }
    }

    // 更新市场指数
    const updateMarketIndexes = async () => {
      try {
        marketIndexes.value = await stockSearch.fetchMarketIndexes()
      } catch (error) {
        console.error('更新市场指数失败:', error)
      }
    }

    // 处理分组变更
    const handleGroupChange = async (groupId) => {
      if (groupId === currentGroup.value) return

      currentGroup.value = groupId
      groupStore.currentGroupId = groupId
      await groupStore.saveToStorage()

      // 加载新分组的股票
      const currentGroupData = groupStore.getCurrentGroup()
      if (currentGroupData) {
        stocks.value = currentGroupData.stocks.map((code) => ({
          code,
          name: '',
          price: 0,
          change: 0,
          changePercent: 0,
          marketValue: 0,
          amount: 0
        }))

        // 更新数据
        await updateStockData()

        // 获取分时图数据
        stocks.value.forEach((stock) => {
          fetchTimeSeries(stock.code)
        })
      }
    }

    // 添加股票
    const selectSearchResult = async (item) => {
      try {
        const currentGroupData = groupStore.getCurrentGroup()
        if (!currentGroupData) return

        // 检查是否已存在
        if (currentGroupData.stocks.includes(item.code)) {
          return
        }

        // 添加到当前分组
        currentGroupData.stocks.push(item.code)
        await groupStore.saveToStorage()

        // 更新股票列表
        stocks.value.push({
          code: item.code,
          name: item.name,
          price: 0,
          change: 0,
          changePercent: 0,
          marketValue: 0,
          amount: 0
        })

        // 获取最新数据
        await updateStockData()
        fetchTimeSeries(item.code)
      } catch (error) {
        console.error('添加股票失败:', error)
      }
    }

    // 移除股票
    const removeStock = async (code) => {
      try {
        await groupStore.removeStock(code)
        stocks.value = stocks.value.filter((stock) => stock.code !== code)

        // 如果是徽章股票，也移除徽章
        await badge.removeBadgeStock(code)
      } catch (error) {
        console.error('移除股票失败:', error)
      }
    }

    // 设置徽章股票
    const setBadgeStock = async (code) => {
      try {
        await badge.setBadgeStock(code)
        badgeStock.value = code

        // 如果设置了徽章，立即更新徽章数据
        if (code) {
          const badgeStockData = stocks.value.find((s) => s.code === code)
          if (badgeStockData) {
            chrome.runtime.sendMessage({
              type: 'UPDATE_BADGE_DATA',
              data: badgeStockData
            })
          }
        }
      } catch (error) {
        console.error('设置徽章失败:', error)
      }
    }

    const handleCanvasReady = (code, canvas) => {
      if (!canvas || !chartData.value[code]) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

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
        const chartPoints = await stockSearch.fetchTimeSeriesData(code)
        chartData.value[code] = chartPoints
      } catch (error) {
        console.error('获取分时数据失败:', error)
        chartData.value[code] = []
      }
    }

    const handleGroupsUpdate = async (newGroupIds) => {
      if (!Array.isArray(newGroupIds) || newGroupIds.length === 0) {
        console.warn('Invalid groups data:', newGroupIds)
        return
      }

      // 更新 store
      await groupStore.updateGroupsOrder(newGroupIds)

      // 先将 groups 设置为空数组，强制触发变化
      groups.value = []

      // 然后在下一个 tick 设置为最新值
      groups.value = groupStore.groups

      console.log('Dashboard groups updated:', groups.value)
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
        window.clearInterval(updateInterval)
      }

      // 主更新定时器 - 更新股票数据和市场指数
      updateInterval = window.setInterval(async () => {
        if (isTradingTime()) {
          await Promise.all([updateStockData(), updateMarketIndexes()])
        }
      }, getUpdateInterval())
    }

    const handleBeforeUnload = async () => {
      await syncManager.syncAll()
    }

    return {
      stocks,
      groups,
      marketIndexes,
      removeStock,
      badgeStock,
      setBadgeStock,
      selectSearchResult,
      handleCanvasReady,
      showGroupDialog,
      currentGroup,
      chartData,
      handleGroupsUpdate,
      handleGroupChange,
      updateStockData,
      showKLine
    }
  }
})
</script>

<style lang="less" scoped>
.dashboard-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.divider {
  height: 1px;
  background: #f0f0f0;
  margin: 0 0 12px 0;
  flex-shrink: 0;
}

/* 确保分组标签页占据剩余空间 */
.group-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* 关键属性 */
}
</style>
