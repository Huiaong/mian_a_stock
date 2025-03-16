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
        <template #default="scope">
          <div class="search-suggestion" v-if="scope && scope.item">
            <span class="stock-code">{{ scope.item.code }}</span>
            <span class="stock-name">{{ scope.item.name }}</span>
          </div>
        </template>
      </el-autocomplete>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { sotckSuggestion } from '@/store/stock'

export default {
  emits: ['select'],
  setup(props, { emit }) {
    const searchKeyword = ref('')

    const handleSearch = async (query, cb) => {
      if (query.length < 2) {
        return
      }
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

<style lang="less" scoped>
.header {
  margin-bottom: 12px;
  flex-shrink: 0;

  .input-group {
    display: flex;
    align-items: center;
    width: 100%;
  }

  .search-input {
    width: 100%;
  }

  .search-suggestion {
    display: flex;
    align-items: center;

    .stock-code {
      width: 80px;
      color: #666;
    }

    .stock-name {
      flex: 1;
      color: #333;
    }
  }
}
</style>
