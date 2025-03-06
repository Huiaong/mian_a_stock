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
          {{ index.changePercent.toFixed(2) }}%
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
        @dblclick="setBadgeStock(stock.code === badgeStock ? '' : stock.code)"
        :class="{ 'is-pinned': stock.code === badgeStock }"
      >
        <div class="stock-info">
          <div class="stock-name-code">
            <span class="name">{{ stock.name }}</span>
            <span class="code">{{ stock.code.substring(2) }}</span>
          </div>
          <div class="stock-price">
            <span :class="['current-price', stock.change >= 0 ? 'up' : 'down']">
              {{ stock.price.toFixed(2) }}
            </span>
            <span
              :class="['change-percent', stock.change >= 0 ? 'up' : 'down']"
            >
              {{ Math.abs(stock.changePercent).toFixed(2) }}%
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
import { ref, onMounted } from 'vue'
import { stockStore } from '@/store/stock'
import {
  fetchStockData,
  MARKET_INDEX_CODES,
  searchStock
} from '@/utils/stockParser'

export default {
  setup() {
    const newStockCode = ref('')
    const stocks = ref([])
    const marketIndexes = ref([])
    const badgeStock = ref('')
    const searchKeyword = ref('')
    const searchResults = ref([])

    const updateStockData = async () => {
      if (stockStore.stockList.length === 0) {
        stocks.value = []
        return
      }

      try {
        const stockDataList = await fetchStockData(stockStore.stockList)
        stocks.value = stockDataList.map((data) => ({
          ...data,
          code: stockStore.stockList[stockDataList.indexOf(data)]
        }))
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

    onMounted(async () => {
      try {
        await Promise.all([stockStore.loadFromStorage(), updateMarketIndexes()])
        await updateStockData()
        badgeStock.value = stockStore.badgeStock
        // 设置定时刷新
        setInterval(async () => {
          const now = new Date()
          const hour = now.getHours()
          const minute = now.getMinutes()
          const time = hour * 100 + minute

          if ((time >= 930 && time <= 1130) || (time >= 1300 && time <= 1500)) {
            await Promise.all([updateStockData(), updateMarketIndexes()])
          }
        }, 3000)
      } catch (err) {
        console.error('初始化失败:', err)
        // 可以在这里添加用户提示
        alert('加载股票列表失败: ' + err.message)
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
      selectSearchResult
    }
  }
}
</script>

<style lang="less" scoped>
.popup_page {
  width: 320px;
  padding: 12px;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
    Arial, sans-serif;
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

  .index-item {
    text-align: center;

    .index-price {
      font-size: 16px;
      font-weight: 500;
      margin-bottom: 2px;
    }

    .index-change {
      font-size: 12px;
    }
  }
}

.divider {
  height: 1px;
  background: #f0f0f0;
  margin: 12px 0;
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
  margin-bottom: 15px;

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
  padding: 8px 0;

  .stock-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }

    .stock-info {
      flex: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;

      .stock-name-code {
        .name {
          font-size: 15px;
          font-weight: 500;
          color: #333;
          margin-right: 8px;
        }

        .code {
          font-size: 12px;
          color: #999;
        }
      }

      .stock-price {
        text-align: right;

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
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .badge-btn {
      padding: 6px 10px;
      background: transparent;
      border: none;
      color: #999;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.3s;
      border-radius: 4px;

      &.active {
        color: #1890ff;
        background-color: rgba(24, 144, 255, 0.1);
      }

      &:hover {
        color: #666;
        background-color: rgba(0, 0, 0, 0.05);
      }

      .badge-icon {
        display: block;
        line-height: 1;
        font-size: 18px;
      }
    }

    .remove-btn {
      padding: 4px 8px;
      margin-left: 12px;
      background: transparent;
      border: none;
      color: #999;
      cursor: pointer;
      font-size: 16px;

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
</style>
