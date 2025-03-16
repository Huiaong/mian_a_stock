<template>
  <div class="candlestick-chart-container">
    <div ref="chartRef" class="chart-container"></div>
    <div v-if="loading" class="loading-overlay">
      <el-icon class="loading-icon"><Loading /></el-icon>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch, onBeforeUnmount, nextTick } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import * as echarts from 'echarts/core'
import {
  BarChart,
  LineChart,
  CandlestickChart as EChartsCandlestick
} from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  ToolboxComponent,
  LegendComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

// 注册必要的组件
echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  ToolboxComponent,
  LegendComponent,
  BarChart,
  LineChart,
  EChartsCandlestick,
  CanvasRenderer
])

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
    loading: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const chartRef = ref(null)
    let chart = null

    // 初始化图表
    const initChart = () => {
      if (chart) {
        chart.dispose()
      }

      chart = echarts.init(chartRef.value)

      // 设置响应式
      window.addEventListener('resize', () => {
        chart && chart.resize()
      })

      updateChart()
    }

    // 更新图表数据
    const updateChart = () => {
      if (!chart || !props.data || props.data.length === 0) return

      const dates = props.data.map((item) => item.date)
      const data = props.data.map((item) => [
        item.open,
        item.close,
        item.low,
        item.high
      ])
      const volumes = props.data.map((item) => item.volume)

      // 计算MA5和MA10
      const ma5 = calculateMA(5, props.data)
      const ma10 = calculateMA(10, props.data)
      const ma20 = calculateMA(20, props.data)

      const option = {
        animation: false,
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'cross'
          },
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 10,
          textStyle: {
            color: '#000'
          },
          formatter: function (params) {
            const candleParam = params[0]
            if (!candleParam) return ''

            const dataIndex = candleParam.dataIndex
            const item = props.data[dataIndex]
            if (!item) return ''

            const colorUp = '#f5222d'
            const colorDown = '#52c41a'

            const color = item.open <= item.close ? colorUp : colorDown

            let result = '<div style="text-align: left;">'
            result += `<div style="font-weight: bold; margin-bottom: 4px;">${item.date}</div>`
            result += `<div>开盘: <span style="color:${color}; font-weight: bold;">${item.open.toFixed(2)}</span></div>`
            result += `<div>收盘: <span style="color:${color}; font-weight: bold;">${item.close.toFixed(2)}</span></div>`
            result += `<div>最高: <span style="color:${color}; font-weight: bold;">${item.high.toFixed(2)}</span></div>`
            result += `<div>最低: <span style="color:${color}; font-weight: bold;">${item.low.toFixed(2)}</span></div>`

            if (item.volume) {
              result += `<div>成交量: ${formatVolume(item.volume)}</div>`
            }

            return result
          }
        },
        axisPointer: {
          link: [{ xAxisIndex: [0, 1] }]
        },
        grid: [
          {
            left: '3%',
            right: '3%',
            top: '5%',
            height: '60%'
          },
          {
            left: '3%',
            right: '3%',
            top: '70%',
            height: '20%'
          }
        ],
        xAxis: [
          {
            type: 'category',
            data: dates,
            scale: true,
            boundaryGap: false,
            axisLine: { lineStyle: { color: '#8392A5' } },
            splitLine: { show: false },
            axisLabel: {
              formatter: function (value) {
                // 简化日期显示
                return value.substring(5) // 只显示月-日
              }
            },
            min: 'dataMin',
            max: 'dataMax'
          },
          {
            type: 'category',
            gridIndex: 1,
            data: dates,
            scale: true,
            boundaryGap: false,
            axisLine: { lineStyle: { color: '#8392A5' } },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            min: 'dataMin',
            max: 'dataMax'
          }
        ],
        yAxis: [
          {
            scale: true,
            splitArea: {
              show: true
            }
          },
          {
            scale: true,
            gridIndex: 1,
            splitNumber: 2,
            axisLabel: { show: false },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false }
          }
        ],
        dataZoom: [
          {
            type: 'inside',
            xAxisIndex: [0, 1],
            start: 50,
            end: 100
          },
          {
            show: true,
            xAxisIndex: [0, 1],
            type: 'slider',
            bottom: '0%',
            height: '5%',
            start: 50,
            end: 100
          }
        ],
        series: [
          {
            name: 'K线',
            type: 'candlestick',
            data: data,
            itemStyle: {
              color: '#f5222d',
              color0: '#52c41a',
              borderColor: '#f5222d',
              borderColor0: '#52c41a'
            }
          },
          {
            name: 'MA5',
            type: 'line',
            data: ma5,
            smooth: true,
            showSymbol: false,
            lineStyle: {
              width: 1,
              color: '#f5a623'
            }
          },
          {
            name: 'MA10',
            type: 'line',
            data: ma10,
            smooth: true,
            showSymbol: false,
            lineStyle: {
              width: 1,
              color: '#8b572a'
            }
          },
          {
            name: 'MA20',
            type: 'line',
            data: ma20,
            smooth: true,
            showSymbol: false,
            lineStyle: {
              width: 1,
              color: '#61a0a8'
            }
          },
          {
            name: '成交量',
            type: 'bar',
            xAxisIndex: 1,
            yAxisIndex: 1,
            data: volumes,
            itemStyle: {
              color: function (params) {
                const idx = params.dataIndex
                return props.data[idx].close > props.data[idx].open
                  ? '#f5222d'
                  : '#52c41a'
              }
            }
          }
        ]
      }

      chart.setOption(option)
    }

    // 计算移动平均线
    const calculateMA = (dayCount, data) => {
      const result = []
      for (let i = 0; i < data.length; i++) {
        if (i < dayCount - 1) {
          result.push('-')
          continue
        }

        let sum = 0
        for (let j = 0; j < dayCount; j++) {
          sum += data[i - j].close
        }
        result.push((sum / dayCount).toFixed(2))
      }
      return result
    }

    // 格式化成交量
    const formatVolume = (volume) => {
      if (volume >= 100000000) {
        return (volume / 100000000).toFixed(2) + '亿'
      } else if (volume >= 10000) {
        return (volume / 10000).toFixed(2) + '万'
      } else {
        return volume.toString()
      }
    }

    // 监听数据变化
    watch(
      () => props.data,
      () => {
        nextTick(() => {
          if (chart) {
            updateChart()
          }
        })
      },
      { deep: true }
    )

    onMounted(() => {
      nextTick(() => {
        initChart()
      })
    })

    onBeforeUnmount(() => {
      if (chart) {
        chart.dispose()
        chart = null
      }
      window.removeEventListener('resize', chart && chart.resize)
    })

    return {
      chartRef
    }
  }
}
</script>

<style lang="less" scoped>
.candlestick-chart-container {
  width: 100%;
  height: 100%;
  position: relative;

  .chart-container {
    width: 100%;
    height: 100%;
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
