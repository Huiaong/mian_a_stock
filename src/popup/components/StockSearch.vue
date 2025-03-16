<template>
  <div class="header">
    <div class="input-group">
      <el-autocomplete
        v-model="searchKeyword"
        :fetch-suggestions="handleSearch"
        placeholder="输入股票代码、名称或拼音首字母"
        clearable
        class="search-input"
        @select="handleSelect"
      >
        <template #suffix>
          <el-icon><Search /></el-icon>
        </template>
        <template #default="{ item }">
          <div class="search-suggestion" v-if="item">
            <span class="stock-name">{{ item.name }}</span>
            <span class="stock-code">{{ item.code }}</span>
          </div>
        </template>
      </el-autocomplete>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { sotckSuggestion } from '@/store/stock'
import { Search } from '@element-plus/icons-vue'

export default {
  name: 'StockSearch',
  components: {
    Search
  },
  emits: ['select'],
  setup(props, { emit }) {
    const searchKeyword = ref('')

    const handleSearch = async (query, cb) => {
      const results = await sotckSuggestion.keywordSuggestion(query)
      cb(results)
    }

    const handleSelect = (item) => {
      emit('select', item)
      searchKeyword.value = ''
    }

    return {
      searchKeyword,
      handleSearch,
      handleSelect
    }
  }
}
</script>

<style>
/* 全局样式，不使用 scoped */
.el-popper.el-autocomplete__popper .search-suggestion {
  display: flex;
  align-items: center;
  padding: 8px 0;
}

.el-popper.el-autocomplete__popper .search-suggestion .stock-code {
  width: 80px;
  color: #999;
  font-size: 13px;
}

.el-popper.el-autocomplete__popper .search-suggestion .stock-name {
  flex: 1;
  color: #333;
  font-weight: 500;
  margin-right: 12px;
}
</style>

<style lang="less" scoped>
.header {
  margin-bottom: 12px;
  flex-shrink: 0;
  width: 100%;

  .input-group {
    display: flex;
    align-items: center;
    width: 100%;
  }

  :deep(.search-input) {
    width: 100%;

    .el-input__wrapper {
      width: 100%;
      padding: 0 12px;
    }

    .el-input__inner {
      height: 36px;
      font-size: 14px;
    }
  }
}
</style>
