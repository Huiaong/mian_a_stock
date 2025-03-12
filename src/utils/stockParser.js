// 修改市场指数代码常量，适配东方财富的代码格式
export const MARKET_INDEX_CODES = {
  SH: '1.000001', // 上证指数
  SZ: '0.399001', // 深证成指
  HS300: '0.399300', // 沪深300
  KC50: '0.399640' // 创业板指
}

/**
 * 批量获取股票数据
 */
export async function fetchStockData(codes) {
  if (!Array.isArray(codes) || codes.length === 0) return []

  try {
    // 格式化代码，添加市场前缀
    const formattedCodes = codes.map((code) => {
      // 如果已经有前缀则直接使用
      if (code.includes('.')) return code
      // 根据规则添加前缀: 6开头是上证，其他是深证
      return code.startsWith('6') ? `1.${code}` : `0.${code}`
    })

    // 将请求分批处理，每批最多30个股票
    const batchSize = 30
    const batches = []
    for (let i = 0; i < formattedCodes.length; i += batchSize) {
      batches.push(formattedCodes.slice(i, i + batchSize))
    }

    // 并发请求每一批数据
    const results = await Promise.all(
      batches.map(async (batchCodes) => {
        const params = new URLSearchParams({
          fields: 'f2,f3,f4,f8,f12,f14,f13,f15,f16,f17,f18,f5,f6', // 需要的字段
          fltt: 2, // 价格格式
          secids: batchCodes.join(',') // 股票代码列表
        })

        const response = await fetchWithRetry(
          `https://push2.eastmoney.com/api/qt/ulist.np/get?${params.toString()}`,
          {
            headers: {
              Accept: '*/*',
              Referer: 'https://quote.eastmoney.com/',
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            }
          }
        )
        const data = await response.json()
        return data.data?.diff || []
      })
    )

    // 合并所有批次的结果并解析数据
    return results
      .flat()
      .map((item) => {
        try {
          return {
            name: item.f14, // 名称
            code: item.f12, // 代码
            price: parseFloat(item.f2), // 最新价
            previousClose: parseFloat(item.f18 || 0), // 昨收价
            open: parseFloat(item.f17 || 0), // 开盘价
            volume: parseInt(item.f5 || 0), // 成交量
            change: parseFloat(item.f4), // 涨跌额
            changePercent: parseFloat(item.f3), // 涨跌幅
            high: parseFloat(item.f15 || 0), // 最高
            low: parseFloat(item.f16 || 0), // 最低
            amount: parseFloat(item.f6 || 0), // 成交额
            date: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
            time: new Date().toTimeString().slice(0, 8) // 时间
          }
        } catch (err) {
          console.error('解析股票数据失败:', err)
          return null
        }
      })
      .filter((data) => data !== null)
  } catch (err) {
    console.error('获取股票数据失败:', err)
    return []
  }
}

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response
    } catch (error) {
      if (i === retries - 1) throw error
      // 延迟重试，时间递增
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}

/**
 * 搜索股票
 * @param {string} keyword 搜索关键词（股票代码、名称或拼音首字母）
 */
export async function searchStock(keyword) {
  try {
    // 使用东方财富的搜索建议 API
    const response = await fetch(
      `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(
        keyword
      )}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&markettype=&mktnum=&jys=&classify=&securitytype=&status=&count=10&_=${Date.now()}`,
      {
        headers: {
          Accept: '*/*',
          Referer: 'https://www.eastmoney.com/'
        }
      }
    )

    const data = await response.json()

    if (!data.QuotationCodeTable.Data) return []

    return data.QuotationCodeTable.Data.map((item) => {
      // 从证券代码中提取数字代码
      const numericCode = item.Code.replace(/^(SH|SZ)/, '')

      return {
        code: numericCode, // 返回6位数字代码
        name: item.Name
      }
    }).filter((item) => {
      // 只返回 A 股股票（排除基金、债券等）
      const code = item.code
      return (
        code.length === 6 &&
        (code.startsWith('60') || // 上证 A 股
          code.startsWith('00') || // 深证 A 股
          code.startsWith('30')) // 创业板
      )
    })
  } catch (err) {
    console.error('搜索股票失败:', err)
    return []
  }
}
