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
          @show-kline="handleShowKline"
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
import { ref, watch, onMounted } from 'vue'
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
  emits: [
    'groupChange',
    'showManage',
    'remove',
    'setBadge',
    'canvas-ready',
    'stockReload',
    'show-kline'
  ],
  setup(props, { emit }) {
    const updateKey = ref(0)
    const tabsRef = ref(null)
    const visibleGroups = ref([])
    const hiddenGroups = ref([])

    const handleShowKline = (code, name) => {
      emit('show-kline', code, name)
    }

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
    const updateVisibleGroups = () => {
      if (!tabsRef.value || !tabsRef.value.$el) return

      const tabsHeader = tabsRef.value.$el.querySelector('.el-tabs__header')
      if (!tabsHeader) return

      const tabsNav = tabsRef.value.$el.querySelector('.el-tabs__nav')
      if (!tabsNav) return

      const extraWidth = 83 // 右侧按钮区域宽度

      // 如果导航栏总宽度小于容器宽度，显示所有分组
      if (tabsNav.scrollWidth <= tabsHeader.clientWidth - extraWidth) {
        visibleGroups.value = [...props.groups]
        hiddenGroups.value = []
        return
      }

      const availableWidth = tabsHeader.clientWidth - extraWidth

      // 计算每个标签的宽度
      const tabWidths = props.groups.map((group) => {
        const numLength = (group.stocks.length % 10) + 1
        return group.name.length * 14 + numLength * 8 + 32.886
      })

      // 计算可见标签的索引
      let currentWidth = 0
      const visibleIndices = []

      // 从左到右添加标签，直到填满可用宽度
      for (let i = 0; i < props.groups.length; i++) {
        if (currentWidth + tabWidths[i] < availableWidth) {
          visibleIndices.push(i)
          currentWidth += tabWidths[i]
        }
      }

      // 根据索引创建可见和隐藏分组
      const visible = visibleIndices.map((i) => props.groups[i])
      const hidden = props.groups.filter((_, i) => !visibleIndices.includes(i))

      // 使用扩展运算符创建新数组，确保触发响应式更新
      visibleGroups.value = [...visible]
      hiddenGroups.value = [...hidden]
    }

    // 监听分组变化时延迟更新可见性
    watch(
      () => props.groups,
      () => {
        updateKey.value++
        updateVisibleGroups()
      },
      { deep: true, immediate: true }
    )

    const handleStockReRanking = async (groupId, stockCodes) => {
      // 保存到 groupStore
      await groupStore.saveStocksOrder(groupId, stockCodes)

      // 通知父组件需要更新股票数据
      emit('stockReload')
    }

    onMounted(() => {
      updateVisibleGroups()
    })

    return {
      updateKey,
      tabsRef,
      visibleGroups,
      hiddenGroups,
      handleHiddenTabSelect,
      handleCanvasReady,
      handleStockReRanking,
      handleShowKline
    }
  }
}
</script>

<style lang="less" scoped>
.group-header {
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;
  position: relative;
  flex: 1;
  overflow: hidden;
}

.group-tabs {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.tabs-extra {
  position: absolute;
  right: 0;
  top: 0;
  display: flex;
  align-items: center;
  height: 32px;
  background: #fff;
  z-index: 10;

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

:deep(.el-dropdown-menu__item) {
  &.is-active {
    color: var(--el-color-primary);
    font-weight: bold;
  }
}

/* 确保标签页内容区域占据剩余空间 */
:deep(.el-tabs__content) {
  flex: 1;
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.el-tab-pane) {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 修复标签头部位置 */
:deep(.el-tabs__header) {
  margin-bottom: 12px;
  order: -1; /* 确保标签头部在内容之前 */

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
</style>
