<template>
  <div class="popup_page" :class="{ expanded: showKLineDialog }">
    <dash-board v-if="!showKLineDialog" @show-kline="showKLine" />

    <k-line-popup
      v-if="showKLineDialog"
      :stock-code="selectedStockCode"
      :stock-name="selectedStockName"
      @close="closeKLineDialog"
    />
  </div>
</template>

<script>
import { defineComponent, ref } from 'vue'
import DashBoard from '@/popup/components/DashBoard.vue'
import KLinePopup from '@/popup/components/KLinePopup.vue'

export default defineComponent({
  components: {
    DashBoard,
    KLinePopup
  },
  setup() {
    // K线图相关状态
    const showKLineDialog = ref(false)
    const selectedStockCode = ref('')
    const selectedStockName = ref('')

    // 显示K线图
    const showKLine = (code, name) => {
      selectedStockCode.value = code
      selectedStockName.value = name
      showKLineDialog.value = true
    }

    // 关闭K线图
    const closeKLineDialog = () => {
      showKLineDialog.value = false
    }

    return {
      showKLineDialog,
      selectedStockCode,
      selectedStockName,
      showKLine,
      closeKLineDialog
    }
  }
})
</script>

<style>
/* 全局样式：移除所有按钮的 focus-visible 样式 */
.el-button:focus-visible {
  outline: none !important;
  box-shadow: none !important;
}

.el-tabs__item:focus-visible {
  outline: none !important;
}

.el-dropdown-menu__item:focus-visible {
  outline: none !important;
}

.el-input__inner:focus-visible {
  outline: none !important;
  box-shadow: none !important;
}
</style>

<style lang="less" scoped>
.popup_page {
  width: 360px;
  height: 500px;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
    Arial, sans-serif;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  transition:
    width 0.3s,
    height 0.3s;

  &.expanded {
    width: 600px;
    height: 450px;
  }
}
</style>
