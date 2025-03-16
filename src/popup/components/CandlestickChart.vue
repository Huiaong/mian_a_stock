<template>
  <div class="candlestick-chart-container">
    <canvas ref="chartCanvas" class="chart-canvas"></canvas>
    <div v-if="!data || data.length === 0" class="no-data">
      <span>暂无K线数据</span>
    </div>
    <div v-if="loading" class="loading-overlay">
      <el-icon class="loading-icon"><Loading /></el-icon>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch, nextTick } from 'vue'
import { Loading } from '@element-plus/icons-vue'

export default {
  name: 'CandlestickChart',
  components: {
    Loading
  },
  props: {
    data: {
      type: Array,
      default: () => []
    },
    width: {
      type: Number,
      default: 300
    },
    height: {
      type: Number,
      default: 200
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const chartCanvas = ref(null)

    const drawChart = async () => {
      await nextTick()
      const canvas = chartCanvas.value
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // 设置画布尺寸
      canvas.width = props.width
      canvas.height = props.height

      // 清空画布
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 如果没有数据，直接返回
      if (!props.data || props.data.length === 0) return

      // 计算数据范围
      const prices = props.data.flatMap((item) => [
        item.open,
        item.close,
        item.high,
        item.low
      ])
      const maxPrice = Math.max(...prices)
      const minPrice = Math.min(...prices)
      const priceRange = maxPrice - minPrice || 1 // 避免除以零

      // 设置边距
      const padding = { top: 20, right: 10, bottom: 20, left: 40 }
      const chartWidth = canvas.width - padding.left - padding.right
      const chartHeight = canvas.height - padding.top - padding.bottom

      // 计算每个蜡烛的宽度
      const candleWidth = Math.max(
        Math.floor(chartWidth / props.data.length) - 1,
        1
      )
      const candleSpacing = 1

      // 绘制Y轴
      ctx.beginPath()
      ctx.strokeStyle = '#ddd'
      ctx.moveTo(padding.left, padding.top)
      ctx.lineTo(padding.left, canvas.height - padding.bottom)
      ctx.stroke()

      // 绘制X轴
      ctx.beginPath()
      ctx.moveTo(padding.left, canvas.height - padding.bottom)
      ctx.lineTo(canvas.width - padding.right, canvas.height - padding.bottom)
      ctx.stroke()

      // 绘制Y轴刻度
      const yTickCount = 5
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#666'
      ctx.font = '10px Arial'

      for (let i = 0; i <= yTickCount; i++) {
        const y = padding.top + (chartHeight * i) / yTickCount
        const price = maxPrice - (priceRange * i) / yTickCount

        ctx.beginPath()
        ctx.moveTo(padding.left - 5, y)
        ctx.lineTo(padding.left, y)
        ctx.stroke()

        ctx.fillText(price.toFixed(2), padding.left - 8, y)

        // 绘制网格线
        ctx.beginPath()
        ctx.strokeStyle = '#f0f0f0'
        ctx.moveTo(padding.left, y)
        ctx.lineTo(canvas.width - padding.right, y)
        ctx.stroke()
        ctx.strokeStyle = '#ddd'
      }

      // 绘制蜡烛图
      props.data.forEach((item, index) => {
        const x = padding.left + index * (candleWidth + candleSpacing)

        // 计算价格对应的Y坐标
        const openY =
          padding.top + chartHeight * (1 - (item.open - minPrice) / priceRange)
        const closeY =
          padding.top + chartHeight * (1 - (item.close - minPrice) / priceRange)
        const highY =
          padding.top + chartHeight * (1 - (item.high - minPrice) / priceRange)
        const lowY =
          padding.top + chartHeight * (1 - (item.low - minPrice) / priceRange)

        // 绘制影线
        ctx.beginPath()
        ctx.strokeStyle = item.close >= item.open ? '#f5222d' : '#52c41a'
        ctx.moveTo(x + candleWidth / 2, highY)
        ctx.lineTo(x + candleWidth / 2, lowY)
        ctx.stroke()

        // 绘制实体
        ctx.fillStyle = item.close >= item.open ? '#f5222d' : '#52c41a'
        const candleHeight = Math.abs(closeY - openY) || 1 // 确保至少有1px高度
        ctx.fillRect(x, Math.min(openY, closeY), candleWidth, candleHeight)

        // 如果是最后一个数据点，显示当前价格
        if (index === props.data.length - 1) {
          ctx.fillStyle = '#333'
          ctx.textAlign = 'left'
          ctx.fillText(item.close.toFixed(2), x + candleWidth + 5, closeY)
        }

        // 每隔一定间隔绘制日期标签
        if (index % Math.ceil(props.data.length / 5) === 0 && item.date) {
          ctx.fillStyle = '#666'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillText(
            formatDate(item.date),
            x + candleWidth / 2,
            canvas.height - padding.bottom + 5
          )
        }
      })

      // 绘制均线
      if (props.data.length > 0) {
        // 计算5日均线
        const ma5 = calculateMA(props.data, 5)
        drawMA(
          ctx,
          ma5,
          '#1890ff',
          padding,
          chartHeight,
          minPrice,
          priceRange,
          candleWidth,
          candleSpacing
        )

        // 计算10日均线
        const ma10 = calculateMA(props.data, 10)
        drawMA(
          ctx,
          ma10,
          '#722ed1',
          padding,
          chartHeight,
          minPrice,
          priceRange,
          candleWidth,
          candleSpacing
        )
      }
    }

    // 计算移动平均线
    const calculateMA = (data, days) => {
      const result = []
      for (let i = 0; i < data.length; i++) {
        if (i < days - 1) {
          result.push(null)
          continue
        }

        let sum = 0
        for (let j = 0; j < days; j++) {
          sum += data[i - j].close
        }
        result.push({
          value: sum / days,
          index: i
        })
      }
      return result
    }

    // 绘制移动平均线
    const drawMA = (
      ctx,
      maData,
      color,
      padding,
      chartHeight,
      minPrice,
      priceRange,
      candleWidth,
      candleSpacing
    ) => {
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = 1

      let isFirstPoint = true

      maData.forEach((item) => {
        if (item === null) return

        const x =
          padding.left +
          item.index * (candleWidth + candleSpacing) +
          candleWidth / 2
        const y =
          padding.top + chartHeight * (1 - (item.value - minPrice) / priceRange)

        if (isFirstPoint) {
          ctx.moveTo(x, y)
          isFirstPoint = false
        } else {
          ctx.lineTo(x, y)
        }
      })

      ctx.stroke()
    }

    // 格式化日期
    const formatDate = (dateStr) => {
      if (!dateStr) return ''

      // 假设日期格式为 "YYYY-MM-DD" 或时间戳
      let date
      if (typeof dateStr === 'number') {
        date = new Date(dateStr)
      } else {
        date = new Date(dateStr)
      }

      return `${date.getMonth() + 1}/${date.getDate()}`
    }

    // 监听数据变化重绘图表
    watch(
      () => props.data,
      () => {
        drawChart()
      },
      { deep: true }
    )

    // 监听尺寸变化重绘图表
    watch([() => props.width, () => props.height], () => {
      drawChart()
    })

    onMounted(() => {
      drawChart()
    })

    return {
      chartCanvas
    }
  }
}
</script>

<style lang="less" scoped>
.candlestick-chart-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: #fff;
  border-radius: 4px;
  overflow: hidden;

  .chart-canvas {
    width: 100%;
    height: 100%;
  }

  .no-data {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
    font-size: 14px;
    background: rgba(255, 255, 255, 0.8);
  }

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.8);

    .loading-icon {
      font-size: 24px;
      color: var(--el-color-primary);
      animation: rotate 1s linear infinite;
    }
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
