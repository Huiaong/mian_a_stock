<template>
  <div class="popup_page">
    <dash-board />
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import DashBoard from '@/popup/components/DashBoard.vue'

export default defineComponent({
  components: {
    DashBoard
  },
  setup() {}
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
}
</style>
