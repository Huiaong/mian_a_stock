<template>
  <div class="group-header">
    <el-tabs
      ref="tabsRef"
      :model-value="modelValue"
      @update:model-value="$emit('groupChange', $event)"
      class="group-tabs"
    >
      <el-tab-pane
        v-for="group in visibleGroups"
        :key="group.id + '_' + updateKey"
        :label="group.name + ` (${group.stocks.length})`"
        :name="group.id"
      >
        <stock-list
          :stocks="stocks"
          :badge-stock="badgeStock"
          :chart-data="chartData"
          @remove="$emit('remove', $event)"
          @setBadge="$emit('setBadge', $event)"
          @canvas-ready="handleCanvasReady"
          @stockReRanking="handleStockReRanking(group.id, $event)"
        />
      </el-tab-pane>
    </el-tabs>
    <div class="tabs-extra">
      <el-dropdown
        v-if="hiddenGroups.length"
        trigger="hover"
        @command="handleHiddenTabSelect"
      >
        <el-button class="more-tabs-btn" type="primary" text>
          <el-icon><More /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="group in hiddenGroups"
              :key="group.id"
              :command="group.id"
              :class="{ 'is-active': modelValue === group.id }"
            >
              {{ group.name }} ({{ group.stocks.length }})
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <div class="divider"></div>
      <el-button
        class="add-group-btn"
        type="primary"
        link
        @click="$emit('showManage')"
      >
        <el-icon><Edit /></el-icon>
      </el-button>
    </div>
  </div>
</template>

<script>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { Edit, More } from '@element-plus/icons-vue'
import StockList from './StockList.vue'
import { groupStore } from '@/store/stock'

export default {
  components: {
    StockList,
    Edit,
    More
  },
  props: {
    modelValue: {
      type: String,
      required: true
    },
    groups: {
      type: Array,
      required: true
    },
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
  emits: ['groupChange', 'showManage', 'remove', 'setBadge', 'canvas-ready'],
  setup(props, { emit }) {
    const updateKey = ref(0)
    const tabsRef = ref(null)
    const visibleGroups = ref([])
    const hiddenGroups = ref([])

    // 处理隐藏标签的选择
    const handleHiddenTabSelect = (groupId) => {
      emit('groupChange', groupId)
    }

    // 添加处理 canvas-ready 事件的函数
    const handleCanvasReady = (code, canvas) => {
      // 直接转发事件，保持参数顺序
      emit('canvas-ready', code, canvas)
    }

    // 计算可见和隐藏的分组
    const updateVisibleGroups = async () => {
      if (!tabsRef.value || !tabsRef.value.$el) return

      await nextTick()

      const tabsHeader = tabsRef.value.$el.querySelector('.el-tabs__header')
      if (!tabsHeader) return

      const tabsNav = tabsRef.value.$el.querySelector('.el-tabs__nav')
      if (!tabsNav) return

      const extraWidth = 80 // 右侧按钮区域宽度

      // 如果导航栏总宽度小于容器宽度，显示所有分组
      if (tabsNav.scrollWidth <= tabsHeader.clientWidth - extraWidth) {
        visibleGroups.value = props.groups
        hiddenGroups.value = []
        return
      }

      const availableWidth = tabsHeader.clientWidth - extraWidth
      const tabs = Array.from(tabsNav.children || [])
      let currentWidth = 0
      const visible = []
      const hidden = []

      // 遍历所有标签页，根据实际 DOM 宽度计算
      for (let i = 0; i < props.groups.length; i++) {
        const group = props.groups[i]
        const tab = tabs[i]

        // 如果没有对应的 DOM 元素，使用估算宽度
        const tabWidth = tab ? tab.offsetWidth : group.name.length * 14 + 40

        if (currentWidth + tabWidth < availableWidth) {
          visible.push(group)
          currentWidth += tabWidth
        } else {
          hidden.push(group)
        }
      }

      visibleGroups.value = visible
      hiddenGroups.value = hidden
    }

    // 处理窗口大小变化
    const handleResize = () => {
      updateVisibleGroups()
    }

    // 监听分组变化时延迟更新可见性
    watch(
      () => props.groups,
      () => {
        updateKey.value++
        nextTick(() => {
          setTimeout(() => {
            updateVisibleGroups()
            scrollToActiveTab()
          }, 100) // 给予一定延迟确保 DOM 已更新
        })
      },
      { deep: true }
    )

    // 监听选中值变化
    watch(
      () => props.modelValue,
      () => {
        nextTick(() => {
          scrollToActiveTab()
        })
      }
    )

    // 滚动到当前选中的标签
    const scrollToActiveTab = async () => {
      await nextTick()
      if (!tabsRef.value || !tabsRef.value.$el) return

      const navRef = tabsRef.value.$el.querySelector('.el-tabs__nav')
      if (!navRef) return

      const activeTab = navRef.querySelector('.is-active')
      if (activeTab && navRef) {
        const navRect = navRef.getBoundingClientRect()
        const tabRect = activeTab.getBoundingClientRect()
        const scrollLeft = tabRect.left - navRect.left + navRef.scrollLeft - 40

        navRef.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        })
      }
    }

    const handleStockReRanking = (groupId, sotcks) => {
      groupStore.saveStocksOrder(groupId, sotcks)
    }

    onMounted(() => {
      updateVisibleGroups()
      window.addEventListener('resize', handleResize)
    })

    onUnmounted(() => {
      window.removeEventListener('resize', handleResize)
    })

    return {
      updateKey,
      tabsRef,
      visibleGroups,
      hiddenGroups,
      handleHiddenTabSelect,
      handleCanvasReady,
      handleStockReRanking
    }
  }
}
</script>

<style lang="less" scoped>
.group-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  position: relative;

  .group-tabs {
    flex: 1;
    overflow: hidden;

    :deep(.el-tabs__header) {
      margin-bottom: 12px;
      display: flex;
      align-items: center;

      .el-tabs__nav-wrap {
        flex: 1;
        margin-right: 0;
        padding-right: 0;

        &::after {
          height: 1px;
        }
      }

      .el-tabs__nav-scroll {
        overflow-x: auto;
        margin-right: 0;
        padding-right: 0;

        &::-webkit-scrollbar {
          display: none;
        }
        scrollbar-width: none;
      }

      .el-tabs__nav {
        white-space: nowrap;
        float: none;

        .el-tabs__item {
          padding: 0 10px;
        }
      }
    }
  }

  .tabs-extra {
    position: absolute;
    right: 0;
    top: 0;
    display: flex;
    align-items: center;
    height: 32px;
    background: #fff;

    .more-tabs-btn {
      font-size: 16px;
      padding: 8px;
      height: 32px;

      &:hover {
        color: var(--el-color-primary);
      }
    }

    .divider {
      width: 1px;
      height: 16px;
      background: #dcdfe6;
      margin: 0 8px;
    }

    .add-group-btn {
      z-index: 99;
      font-size: 16px;
      padding: 8px;
      height: 32px;
    }
  }
}

:deep(.el-dropdown-menu__item) {
  &.is-active {
    color: var(--el-color-primary);
    font-weight: bold;
  }
}
</style>
