<template>
	<div class="popup_page">
		<!-- 市场指数面板 -->
		<div class="market-index">
			<div class="index-item" v-for="index in marketIndexes" :key="index.code">
				<div class="index-name">{{ index.name }}</div>
				<div :class="['index-price', index.change >= 0 ? 'up' : 'down']">
					{{ index.price.toFixed(2) }}
				</div>
				<div :class="['index-change', index.change >= 0 ? 'up' : 'down']">
					{{ (index.change >= 0 ? '+' : '') + index.changePercent.toFixed(2) }}%
				</div>
			</div>
		</div>

		<div class="divider"></div>

		<!-- 自选股标题 -->
		<div class="section-title">
			<span>自选股票</span>
			<button class="settings-btn">设置</button>
		</div>

		<!-- 原有的自选股部分 -->
		<div class="header">
			<div class="input-group">
				<input 
					v-model="newStockCode" 
					placeholder="输入股票代码，如：600519" 
					@keyup.enter="addStock"
				>
				<button class="add-btn" @click="addStock">添加</button>
			</div>
		</div>
		
		<div class="stock-list">
			<div v-for="stock in stocks" :key="stock.code" class="stock-item">
				<div class="stock-info">
					<div class="stock-name-code">
						<span class="name">{{ stock.name }}</span>
						<span class="code">{{ stock.code.substring(2) }}</span>
					</div>
					<div class="stock-price">
						<span :class="['current-price', stock.change >= 0 ? 'up' : 'down']">
							{{ stock.price.toFixed(2) }}
						</span>
						<span :class="['change-percent', stock.change >= 0 ? 'up' : 'down']">
							{{ (stock.change >= 0 ? '+' : '') + stock.changePercent.toFixed(2) }}%
						</span>
					</div>
				</div>
				<div class="stock-actions">
					<button 
						class="badge-btn" 
						:class="{ active: stock.code === badgeStock }"
						@click="setBadgeStock(stock.code === badgeStock ? '' : stock.code)"
						:title="stock.code === badgeStock ? '取消固定显示' : '固定在图标显示'"
					>
						<span class="badge-icon">📌</span>
					</button>
					<button class="remove-btn" @click="removeStock(stock.code)">
						<span class="remove-icon">×</span>
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { stockStore } from '@/store/stock'
import { fetchStockData, MARKET_INDEX_CODES } from '@/utils/stockParser'

export default {
	setup() {
		const newStockCode = ref('')
		const stocks = ref([])
		const marketIndexes = ref([])
		const badgeStock = ref('')

		const updateStockData = async () => {
			if (stockStore.stockList.length === 0) {
				stocks.value = []
				return
			}

			try {
				const stockDataList = await fetchStockData(stockStore.stockList)
				stocks.value = stockDataList.map(data => ({
					...data,
					code: stockStore.stockList[stockDataList.indexOf(data)]
				}))
			} catch (err) {
				console.error('更新股票数据失败:', err)
			}
		}

		const updateMarketIndexes = async () => {
			try {
				const codes = [
					MARKET_INDEX_CODES.SH,
					MARKET_INDEX_CODES.SZ,
					MARKET_INDEX_CODES.HS300,
					MARKET_INDEX_CODES.KC50
				]
				const indexData = await fetchStockData(codes)
				marketIndexes.value = indexData.map(data => {
					return {
						...data,
						name: getIndexName(data.code)
					}
				})
			} catch (err) {
				console.error('更新市场指数失败:', err)
			}
		}

		const getIndexName = (code) => {
			// 移除可能的 sh/sz 前缀，只比较数字部分
			const codeNumber = code.replace(/^(sh|sz)/, '')
			switch (codeNumber) {
				case '000001': return '上证指数'
				case '399001': return '深证成指'
				case '399300': return '沪深300'
				case '399640': return '创业板'
				default: return ''
			}
		}

		const addStock = async () => {
			if (newStockCode.value) {
				await stockStore.addStock(newStockCode.value)
				newStockCode.value = ''
				await updateStockData()
			}
		}

		const removeStock = async (code) => {
			await stockStore.removeStock(code)
			await updateStockData()
		}

		const setBadgeStock = async (code) => {
			await stockStore.setBadgeStock(code)
			badgeStock.value = code
		}

		onMounted(async () => {
			try {
				await Promise.all([
					stockStore.loadFromStorage(),
					updateMarketIndexes()
				])
				await updateStockData()
				badgeStock.value = stockStore.badgeStock
				// 设置定时刷新
				setInterval(async () => {
					await Promise.all([
						updateStockData(),
						updateMarketIndexes()
					])
				}, 10000)
			} catch (err) {
				console.error('初始化失败:', err)
				// 可以在这里添加用户提示
				alert('加载股票列表失败: ' + err.message)
			}
		})

		return {
			newStockCode,
			stocks,
			marketIndexes,
			addStock,
			removeStock,
			badgeStock,
			setBadgeStock
		}
	}
}
</script>

<style lang="less" scoped>
	.popup_page {
		width: 320px;
		padding: 12px;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
	}

	.market-index {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
		margin-bottom: 12px;
		background: #fff;
		padding: 12px;
		border-radius: 4px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

		.index-item {
			text-align: center;
			
			.index-price {
				font-size: 16px;
				font-weight: 500;
				margin-bottom: 2px;
			}
			
			.index-change {
				font-size: 12px;
			}
		}
	}

	.divider {
		height: 1px;
		background: #f0f0f0;
		margin: 12px 0;
	}

	.section-title {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
		padding: 0 4px;

		span {
			font-size: 14px;
			font-weight: 500;
			color: #333;
		}

		.settings-btn {
			padding: 4px 12px;
			font-size: 12px;
			color: #1890ff;
			background: transparent;
			border: none;
			cursor: pointer;
			
			&:hover {
				color: #40a9ff;
			}
		}
	}

	.header {
		margin-bottom: 15px;
		
		.input-group {
			display: flex;
			gap: 8px;
			
			input {
				flex: 1;
				padding: 8px 12px;
				border: 1px solid #ddd;
				border-radius: 4px;
				font-size: 14px;
				
				&:focus {
					outline: none;
					border-color: #40a9ff;
					box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
				}
			}
			
			.add-btn {
				padding: 8px 16px;
				background: #1890ff;
				color: white;
				border: none;
				border-radius: 4px;
				cursor: pointer;
				font-size: 14px;
				
				&:hover {
					background: #40a9ff;
				}
			}
		}
	}

	.stock-list {
		background: #fff;
		border-radius: 4px;
		padding: 8px 0;

		.stock-item {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 12px;
			border-bottom: 1px solid #f0f0f0;
			
			&:last-child {
				border-bottom: none;
			}
			
			.stock-info {
				flex: 1;
				display: flex;
				justify-content: space-between;
				align-items: center;
				
				.stock-name-code {
					.name {
						font-size: 15px;
						font-weight: 500;
						color: #333;
						margin-right: 8px;
					}
					
					.code {
						font-size: 12px;
						color: #999;
					}
				}
				
				.stock-price {
					text-align: right;
					
					.current-price {
						display: block;
						font-size: 16px;
						font-weight: 500;
						margin-bottom: 2px;
					}
					
					.change-percent {
						font-size: 13px;
					}
				}
			}
			
			.stock-actions {
				display: flex;
				align-items: center;
				gap: 8px;
			}
			
			.badge-btn {
				padding: 6px 10px;
				background: transparent;
				border: none;
				color: #999;
				cursor: pointer;
				font-size: 16px;
				transition: all 0.3s;
				border-radius: 4px;
				
				&.active {
					color: #1890ff;
					background-color: rgba(24, 144, 255, 0.1);
				}
				
				&:hover {
					color: #666;
					background-color: rgba(0, 0, 0, 0.05);
				}

				.badge-icon {
					display: block;
					line-height: 1;
					font-size: 18px;
				}
			}
			
			.remove-btn {
				padding: 4px 8px;
				margin-left: 12px;
				background: transparent;
				border: none;
				color: #999;
				cursor: pointer;
				font-size: 16px;
				
				&:hover {
					color: #666;
				}
				
				.remove-icon {
					display: block;
					line-height: 1;
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