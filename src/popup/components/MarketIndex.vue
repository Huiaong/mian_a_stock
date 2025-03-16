<template>
  <div class="market-index">
    <div class="index-item" v-for="index in marketIndexes" :key="index.code">
      <div class="index-name">{{ index.name }}</div>
      <div class="index-info">
        <div :class="['index-price', index.change >= 0 ? 'up' : 'down']">
          {{ index.price.toFixed(2) }}
        </div>
        <div :class="['index-change', index.change >= 0 ? 'up' : 'down']">
          {{ index.changePercent.toFixed(2) }}%
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    marketIndexes: {
      type: Array,
      required: true
    }
  }
}
</script>

<style lang="less" scoped>
.market-index {
  display: flex;
  justify-content: space-between;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 8px 12px;
  background: #fff;

  .index-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 4px;

    .index-name {
      font-size: 15px;
      font-weight: 500;
      color: #333;
      margin-bottom: 4px;
    }

    .index-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;

      .index-price {
        font-size: 14px;
        font-weight: 500;
        line-height: 1.2;
        margin-bottom: 2px;
      }

      .index-change {
        font-size: 13px;
        line-height: 1.2;
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
