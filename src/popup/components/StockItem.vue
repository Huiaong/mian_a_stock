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
      <div class="mini-chart">
        <canvas :ref="setCanvasRef" width="120" height="30"></canvas>
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
import { ref } from 'vue'
import { Delete } from '@element-plus/icons-vue'

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
  emits: ['remove', 'pin', 'canvas-ready'],
  setup(props, { emit }) {
    const canvas = ref(null)

    const setCanvasRef = (el) => {
      if (el) {
        canvas.value = el
        emit('canvas-ready', props.stock.code, el)
      }
    }

    return {
      setCanvasRef
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
