<template>
  <div
    class="stock-list"
    ref="stockListRef"
    @dragstart="handleListDragStart"
    @dragover="handleListDragEnter"
    @dragend="handleListDragEnd"
  >
    <stock-item
      v-for="stock in stocks"
      :key="stock.code"
      :stock="stock"
      :data-code="stock.code"
      :is-pinned="stock.code === badgeStock"
      :chart-data="chartData[stock.code]"
      @remove="$emit('remove', stock.code)"
      @pin="$emit('setBadge', stock.code === badgeStock ? '' : stock.code)"
      @canvas-ready="handleCanvasReady"
    />
  </div>
</template>

<script>
import { ref } from 'vue'
import StockItem from './StockItem.vue'

export default {
  components: {
    StockItem
  },
  props: {
    stocks: {
      type: Array,
      required: true
    },
    badgeStock: {
      type: String,
      default: ''
    },
    chartData: {
      type: Object,
      required: true
    }
  },
  emits: ['remove', 'setBadge', 'canvas-ready', 'stockReRanking'],
  setup(props, { emit }) {
    const stockListRef = ref(null)
    let source = null

    // 添加列表拖拽事件处理
    const handleListDragStart = (event) => {
      if (!event.target.classList.contains('stock-item')) {
        return
      }
      source = event.target
      event.target.classList.add('dragging')
      // 存储被拖拽元素的 id
      event.dataTransfer.setData('text/plain', event.target.dataset.groupId)
    }

    const handleListDragEnter = (event) => {
      if (!source) return

      const target = event.target.closest('.stock-item')
      if (!target || target === source) return

      const list = stockListRef.value
      const children = Array.from(list.children)
      const sourceIndex = children.indexOf(source)
      const targetIndex = children.indexOf(target)

      if (sourceIndex < targetIndex) {
        target.after(source)
      } else {
        target.before(source)
      }
    }

    const handleListDragEnd = async (event) => {
      if (!source) return

      event.target.classList.remove('dragging')

      // 获取当前分组列表的顺序
      const items = Array.from(stockListRef.value.children)
      const newStocks = items
        .filter((item) => item.classList.contains('stock-item'))
        .map((item) => {
          const code = item.dataset.code
          return props.stocks.find((s) => s.code === code)
        })
        .filter(Boolean)

      // 重置 source
      source = null

      const newStocksCodes = newStocks.map((s) => s.code)
      const oldStocksCodes = props.stocks.map((s) => s.code)

      // 如果顺序没有变化，直接返回
      if (JSON.stringify(newStocksCodes) === JSON.stringify(oldStocksCodes)) {
        return
      }

      emit('stockReRanking', newStocksCodes)
    }

    const handleCanvasReady = (code, canvas) => {
      emit('canvas-ready', code, canvas)
    }

    return {
      stockListRef,
      handleListDragStart,
      handleListDragEnter,
      handleListDragEnd,
      handleCanvasReady
    }
  }
}
</script>

<style lang="less" scoped>
.stock-list {
  background: #fff;
  border-radius: 4px;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  margin-bottom: 12px;
  position: relative;

  .stock-item {
    &.dragging {
      color: transparent;
      background: #ccc;
    }
  }

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
}
</style>
