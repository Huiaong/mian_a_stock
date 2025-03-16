<template>
  <div class="kline-dialog-container">
    <div class="kline-header">
      <div class="stock-info">
        <div class="stock-basic-info">
          <span class="stock-name">{{ stockName }}</span>
          <span class="stock-code">{{ stockCode }}</span>
        </div>
        <div class="stock-price-info">
          <span class="current-price" :class="getPriceClass()">
            {{ formatPrice(currentPrice) }}
          </span>
          <span class="price-change" :class="getPriceClass()">
            {{ formatChange(priceChange) }} ({{ formatPercent(changePercent) }})
          </span>
        </div>
        <div class="stock-sector-info" v-if="sectorInfo">
          <span class="sector-name">{{ sectorInfo.name }}</span>
          <span class="sector-change" :class="getSectorClass()">
            {{ formatPercent(sectorInfo.changePercent) }}
          </span>
        </div>
      </div>
      <div class="header-actions">
        <el-button type="text" @click="$emit('close')">
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="kline-content">
      <div class="chart-container">
        <div class="period-selector">
          <el-radio-group v-model="selectedPeriod" size="small">
            <el-radio-button label="day">日K</el-radio-button>
            <el-radio-button label="week">周K</el-radio-button>
            <el-radio-button label="month">月K</el-radio-button>
          </el-radio-group>
        </div>

        <candlestick-chart :data="klineData" :loading="loading" />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue'
import { Close } from '@element-plus/icons-vue'
import CandlestickChart from './CandlestickChart.vue'
import { stockSearch } from '@/store/stock'

export default {
  components: {
    Close,
    CandlestickChart
  },
  props: {
    stockCode: {
      type: String,
      required: true
    },
    stockName: {
      type: String,
      required: true
    }
  },
  emits: ['close'],
  setup(props) {
    const selectedPeriod = ref('day')
    const klineData = ref([])
    const loading = ref(true)
    const currentPrice = ref(0)
    const priceChange = ref(0)
    const changePercent = ref(0)
    const sectorInfo = ref(null)

    // 加载K线数据
    const loadKLineData = async () => {
      loading.value = true

      try {
        // 调用API获取K线数据
        const data = await stockSearch.getKLineData(
          props.stockCode,
          selectedPeriod.value
        )
        klineData.value = data

        // 设置当前价格为最后一天的收盘价
        if (data.length > 0) {
          const lastDay = data[data.length - 1]
          currentPrice.value = lastDay.close

          // 计算涨跌幅
          const prevDay = data[data.length - 2]
          if (prevDay) {
            priceChange.value = lastDay.close - prevDay.close
            changePercent.value = (priceChange.value / prevDay.close) * 100
          }
        }

        // 加载股票详细信息（包括板块信息）
        // loadStockDetail()
      } catch (error) {
        console.error('加载K线数据失败:', error)
      } finally {
        loading.value = false
      }
    }

    const formatPrice = (price) => {
      if (!price && price !== 0) return '--'
      return price.toFixed(2)
    }

    const formatChange = (change) => {
      if (!change && change !== 0) return '--'
      return (change > 0 ? '+' : '') + change.toFixed(2)
    }

    const formatPercent = (percent) => {
      if (!percent && percent !== 0) return '--'
      return (percent > 0 ? '+' : '') + percent.toFixed(2) + '%'
    }

    const getPriceClass = () => {
      if (priceChange.value > 0) return 'price-up'
      if (priceChange.value < 0) return 'price-down'
      return 'price-flat'
    }

    const getSectorClass = () => {
      if (!sectorInfo.value) return ''
      if (sectorInfo.value.changePercent > 0) return 'price-up'
      if (sectorInfo.value.changePercent < 0) return 'price-down'
      return 'price-flat'
    }

    watch(selectedPeriod, () => {
      loadKLineData()
    })

    watch(
      () => props.stockCode,
      () => {
        loadKLineData()
      }
    )

    onMounted(() => {
      loadKLineData()
    })

    return {
      selectedPeriod,
      klineData,
      loading,
      currentPrice,
      priceChange,
      changePercent,
      sectorInfo,
      formatPrice,
      formatChange,
      formatPercent,
      getPriceClass,
      getSectorClass
    }
  }
}
</script>

<style lang="less" scoped>
.kline-dialog-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #fff;

  .kline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #f0f0f0;

    .stock-info {
      display: flex;
      align-items: center;
      gap: 16px;

      .stock-basic-info {
        .stock-name {
          font-size: 18px;
          font-weight: 500;
          margin-right: 8px;
        }

        .stock-code {
          font-size: 14px;
          color: #909399;
        }
      }

      .stock-price-info {
        display: flex;
        flex-direction: column;

        .current-price {
          font-size: 16px;
          font-weight: 500;
        }

        .price-change {
          font-size: 14px;
        }
      }

      .stock-sector-info {
        display: flex;
        flex-direction: column;

        .sector-name {
          font-size: 14px;
          color: #606266;
        }

        .sector-change {
          font-size: 14px;
        }
      }
    }
  }

  .kline-content {
    flex: 1;
    padding: 16px;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .chart-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;

      .period-selector {
        margin-bottom: 16px;
      }
    }
  }
}

.price-up {
  color: #f56c6c;
}

.price-down {
  color: #67c23a;
}

.price-flat {
  color: #909399;
}
</style>
