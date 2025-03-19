<template>
  <div class="group-header">
    <div class="custom-tabs">
      <div class="tabs-nav-wrap" ref="tabsNavWrap">
        <div class="tabs-nav" ref="tabsNav">
          <div
            v-for="group in visibleGroups"
            :key="group.id"
            class="tab-item"
            :class="{ active: modelValue === group.id }"
            @click="$emit('groupChange', group.id)"
          >
            {{ group.name }} ({{ group.stocks.length }})
          </div>
        </div>
      </div>

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

    <div class="tabs-content">
      <!-- 只渲染当前选中的分组内容 -->
      <div
        v-for="group in allGroups"
        :key="group.id"
        v-show="modelValue === group.id"
        class="tab-pane"
      >
        <stock-list
          :stocks="getGroupStocks(group)"
          :badge-stock="badgeStock"
          :chart-data="chartData"
          @remove="$emit('remove', $event)"
          @setBadge="$emit('setBadge', $event)"
          @stockReRanking="handleStockReRanking(group.id, $event)"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, nextTick, onBeforeUnmount } from 'vue'
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
  emits: ['groupChange', 'showManage', 'remove', 'setBadge', 'stockReload'],
  setup(props, { emit }) {
    const tabsNavWrap = ref(null)
    const tabsNav = ref(null)
    const visibleGroups = ref([])
    const hiddenGroups = ref([])

    // 合并所有分组，确保所有分组的股票列表都能被渲染
    const allGroups = computed(() => {
      return [...visibleGroups.value, ...hiddenGroups.value]
    })

    // 根据分组获取其包含的股票详情
    const getGroupStocks = (group) => {
      return props.stocks.filter((stock) => group.stocks.includes(stock.code))
    }

    // 处理隐藏标签的选择
    const handleHiddenTabSelect = (groupId) => {
      // 通知父组件切换分组
      emit('groupChange', groupId)
    }

    // 计算可见和隐藏分组
    const updateVisibleGroups = () => {
      if (!tabsNavWrap.value) return

      const availableWidth = tabsNavWrap.value.clientWidth

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

    // 监听分组变化和浏览器窗口大小变化
    watch(
      () => props.groups,
      () => {
        nextTick(() => {
          updateVisibleGroups()
        })
      },
      { deep: true, immediate: true }
    )

    // 监听选中分组的变化
    watch(
      () => props.modelValue,
      () => {
        nextTick(() => {
          updateVisibleGroups()
        })
      }
    )

    const handleStockReRanking = async (groupId, stockCodes) => {
      // 保存到 groupStore
      await groupStore.saveStocksOrder(groupId, stockCodes)

      // 通知父组件需要更新股票数据
      emit('stockReload')
    }

    onMounted(() => {
      updateVisibleGroups()

      // 监听窗口大小变化
      window.addEventListener('resize', updateVisibleGroups)
    })

    // 在组件销毁前移除事件监听
    onBeforeUnmount(() => {
      window.removeEventListener('resize', updateVisibleGroups)
    })

    return {
      tabsNavWrap,
      tabsNav,
      visibleGroups,
      hiddenGroups,
      allGroups,
      handleHiddenTabSelect,
      handleStockReRanking,
      getGroupStocks
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

.custom-tabs {
  display: flex;
  position: relative;
  border-bottom: 1px solid #e4e7ed;
  margin-bottom: 12px;
}

.tabs-nav-wrap {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.tabs-nav {
  display: flex;
  white-space: nowrap;
  position: relative;
  transition: transform 0.3s;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.tab-item {
  padding: 0 10px;
  height: 32px;
  line-height: 32px;
  cursor: pointer;
  transition: color 0.3s;
  position: relative;
  margin-right: 10px;

  &:hover {
    color: var(--el-color-primary);
  }

  &.active {
    color: var(--el-color-primary);
    font-weight: bold;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background-color: var(--el-color-primary);
    }
  }
}

.tabs-extra {
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

.tabs-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tab-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:deep(.el-dropdown-menu__item) {
  &.is-active {
    color: var(--el-color-primary);
    font-weight: bold;
  }
}
</style>
