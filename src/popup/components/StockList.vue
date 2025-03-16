<template>
  <div
    class="stock-list"
    ref="stockListRef"
    @dragstart="handleListDragStart"
    @dragover="handleListDragEnter"
    @dragend="handleListDragEnd"
  >
    <transition-group name="stock-list" tag="div" class="stock-items-container">
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
        class="stock-item"
      />
    </transition-group>
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
      const children = Array.from(
        list.querySelector('.stock-items-container').children
      )
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
      const items = Array.from(
        stockListRef.value.querySelector('.stock-items-container').children
      )
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
  margin-bottom: 12px;
  position: relative;

  .stock-items-container {
    display: flex;
    flex-direction: column;
  }

  /* 优化过渡效果 */
  .stock-list-move {
    transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .stock-list-enter-active {
    transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
    position: relative;
    z-index: 1;
  }

  .stock-list-leave-active {
    transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    position: absolute;
    width: 100%;
    z-index: 0;
  }

  .stock-list-enter-from {
    opacity: 0;
    transform: translateY(20px);
  }

  .stock-list-leave-to {
    opacity: 0;
    transform: translateY(-20px);
  }

  .stock-item {
    &.dragging {
      color: transparent;
      background: #f0f0f0;
      opacity: 0.7;
      z-index: 10;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transform: scale(1.02);
      transition:
        background 0.2s ease,
        opacity 0.2s ease,
        transform 0.2s ease,
        box-shadow 0.2s ease;
    }
  }
}
</style>
