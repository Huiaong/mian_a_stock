<template>
  <el-card
    class="stock-item"
    :class="{
      'is-pinned': isPinned
    }"
    shadow="hover"
    draggable="true"
    @dblclick.stop="$emit('pin')"
  >
    <div class="stock-info">
      <div class="stock-name-code">
        <span class="name">{{ stock.name }}</span>
        <span class="code">{{ stock.code }}</span>
      </div>
      <div class="mini-chart" @click="showKLineChart">
        <div ref="chartRef" class="chart-container"></div>
      </div>
      <div class="stock-price-info">
        <div class="price-container">
          <span :class="['current-price', stock.change >= 0 ? 'up' : 'down']">
            {{ stock.price.toFixed(2) }}
          </span>
          <span :class="['change-percent', stock.change >= 0 ? 'up' : 'down']">
            {{ stock.change >= 0 ? '+' : '-'
            }}{{ Math.abs(stock.changePercent).toFixed(2) }}%
          </span>
        </div>
      </div>
      <el-button type="danger" link class="remove-btn" @click="$emit('remove')">
        <el-icon><Delete /></el-icon>
      </el-button>
    </div>
  </el-card>
</template>

<script>
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

// 注册必要的组件
echarts.use([GridComponent, LineChart, CanvasRenderer])

export default {
  name: 'StockItem',
  components: {
    Delete
  },
  props: {
    stock: {
      type: Object,
      required: true
    },
    isPinned: {
      type: Boolean,
      default: false
    },
    chartData: {
      type: Array,
      default: () => []
    }
  },
  emits: ['remove', 'pin', 'show-kline'],
  setup(props, { emit }) {
    const chartRef = ref(null)
    let chart = null

    // 初始化图表
    const initChart = () => {
      if (!chartRef.value) return

      if (chart) {
        chart.dispose()
      }

      chart = echarts.init(chartRef.value)
      updateChart()
    }

    // 更新图表数据
    const updateChart = () => {
      if (!chart || !props.chartData || props.chartData.length === 0) return

      const data = props.chartData.map((item) => item.price)
      const basePrice = data[0] || props.stock.price // 使用第一个数据点作为基准价，如果没有则使用当前价格
      const isUp = props.stock.change >= 0

      // 创建一个固定长度为240的数据数组，全部填充为null
      const fullData = new Array(240).fill(null)

      // 将实际数据填充到数组中
      for (let i = 0; i < Math.min(data.length, 240); i++) {
        fullData[i] = data[i]
      }

      const option = {
        animation: false,
        grid: {
          left: 0,
          right: 0,
          top: 0,
          bottom: 0
        },
        xAxis: {
          type: 'category',
          show: false,
          boundaryGap: false,
          data: Array.from({ length: 240 }, (_, i) => i)
        },
        yAxis: {
          type: 'value',
          show: false,
          scale: true
        },
        series: [
          {
            type: 'line',
            data: fullData,
            showSymbol: false,
            connectNulls: false, // 不连接空值点，这样未来时间会留空
            lineStyle: {
              color: isUp ? '#f5222d' : '#52c41a',
              width: 1
            },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                {
                  offset: 0,
                  color: isUp
                    ? 'rgba(245, 34, 45, 0.2)'
                    : 'rgba(82, 196, 26, 0.2)'
                },
                {
                  offset: 1,
                  color: 'rgba(255, 255, 255, 0)'
                }
              ])
            }
          }
        ],
        // 添加开盘价横向虚线
        markLine: {
          silent: true,
          symbol: 'none', // 不显示端点符号
          lineStyle: {
            color: '#999',
            type: 'dashed',
            width: 1
          },
          data: [
            {
              yAxis: basePrice,
              label: { show: false }
            }
          ]
        }
      }

      chart.setOption(option)
    }

    // 添加显示K线图的方法
    const showKLineChart = () => {
      emit('show-kline', props.stock.code, props.stock.name)
    }

    // 监听数据变化
    watch(
      () => props.chartData,
      () => {
        if (chart) {
          updateChart()
        }
      },
      { deep: true }
    )

    // 监听股票涨跌变化，更新图表颜色
    watch(
      () => props.stock.change,
      () => {
        if (chart) {
          updateChart()
        }
      }
    )

    onMounted(() => {
      initChart()

      // 添加窗口大小变化监听
      window.addEventListener('resize', initChart)
    })

    onBeforeUnmount(() => {
      if (chart) {
        chart.dispose()
        chart = null
      }
      window.removeEventListener('resize', initChart)
    })

    return {
      chartRef,
      showKLineChart
    }
  }
}
</script>

<style lang="less" scoped>
.stock-item {
  margin-bottom: 8px;

  &.is-pinned {
    background: var(--el-color-primary-light-9);
  }

  &.is-dragging {
    opacity: 0.5;
  }

  &.is-drag-over {
    border: 2px dashed var(--el-color-primary);
  }

  .stock-info {
    display: flex;
    align-items: center;
    gap: 12px;

    &.grabbing {
      cursor: grabbing;
    }

    .stock-name-code {
      flex: 1;
      min-width: 56px;
      display: flex;
      flex-direction: column;
      align-items: center;

      .name {
        display: block;
        font-size: 14px;
        font-weight: 500;
        color: #333;
      }

      .code {
        display: block;
        font-size: 12px;
        color: #999;
      }
    }

    .mini-chart {
      width: 120px;
      height: 30px;
      cursor: pointer;

      &:hover {
        opacity: 0.8;
      }

      .chart-container {
        width: 100%;
        height: 100%;
      }
    }

    .stock-price-info {
      flex: 1;
      text-align: right;

      .price-container {
        display: flex;
        align-items: center;
        flex-direction: column;

        .current-price {
          font-size: 16px;
          font-weight: 500;
          margin-right: 8px;
        }

        .change-percent {
          font-size: 14px;
        }
      }

      .stock-details {
        font-size: 12px;
        color: #666;

        .market-value {
          margin-right: 8px;
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
</style>
