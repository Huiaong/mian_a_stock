import { decode } from 'gbk.js'

// 修改市场指数代码常量
export const MARKET_INDEX_CODES = {
  SH: 'sh000001', // 上证指数
  SZ: 'sz399001', // 深证成指
  HS300: 'sz399300', // 沪深300 - 修改为正确的代码
  KC50: 'sz399640' // 创业板指 - 修改为创业板指数代码
}

/**
 * 腾讯股票数据解析
 * API格式：http://qt.gtimg.cn/q=sh601318
 */
export function parseStockData(text) {
  // 返回格式：v_sh601318="1~中国平安~601318~82.75~82.90~82.85~728258~364108~364150~82.75~119~82.74~55~82.73~30~82.72~25~82.71~17~82.76~4~82.77~8~82.78~10~82.79~22~82.80~24~~20240226153021~-0.15~-0.18~83.00~82.52~82.75/728258/6024393617~728258~602439~0.73~18.08~~~83.00~82.52~0.58~8469.50~8469.87~2.98~90.65~74.00~1.69~-11.79~6024393617~728258~0.73~18.08~0.69~";
  const matches = text.match(/v_(?:sh|sz)\d{6}="([^"]+)"/)
  if (!matches || !matches[1]) {
    throw new Error('数据格式错误')
  }

  const values = matches[1].split('~')
  if (values.length < 40) {
    throw new Error('数据不完整')
  }

  return {
    name: values[1],
    code: values[2],
    price: parseFloat(values[3]),
    previousClose: parseFloat(values[4]),
    open: parseFloat(values[5]),
    volume: parseInt(values[6]),
    change: parseFloat(values[31]),
    changePercent: parseFloat(values[32]),
    high: parseFloat(values[33]),
    low: parseFloat(values[34]),
    amount: parseFloat(values[37]),
    date: values[30].substring(0, 8),
    time: values[30].substring(8)
  }
}

/**
 * 批量获取股票数据
 */
export async function fetchStockData(codes) {
  // 确保输入是数组
  if (!Array.isArray(codes) || codes.length === 0) return []

  try {
    const response = await fetch(`https://qt.gtimg.cn/q=${codes.join(',')}`, {
      headers: {
        Accept: '*/*',
        Referer: 'https://finance.qq.com' // 添加 Referer
      }
    })
    const buffer = await response.arrayBuffer()
    // 使用 gbk.js 解码
    const text = decode(new Uint8Array(buffer))

    // 分割多个股票的数据
    const stockDataList = text.split('\n').filter((line) => line.trim())

    return stockDataList
      .map((dataLine) => {
        try {
          return parseStockData(dataLine)
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

/**
 * 搜索股票
 * @param {string} keyword 搜索关键词（股票代码、名称或拼音首字母）
 */
export async function searchStock(keyword) {
  try {
    const response = await fetch(
      `https://suggest3.sinajs.cn/suggest/type=11,12&key=${encodeURIComponent(keyword)}`,
      {
        headers: {
          Accept: '*/*',
          Referer: 'https://finance.sina.com.cn' // 添加 Referer
        }
      }
    )
    const buffer = await response.arrayBuffer()
    const text = decode(new Uint8Array(buffer))

    const matches = text.match(/="(.*)"/)
    if (!matches || !matches[1]) return []

    return matches[1]
      .split(';')
      .filter((item) => item)
      .map((item) => {
        const parts = item.split(',')

        // 判断是否是通过股票代码搜索
        const isCodeSearch =
          parts[0].startsWith('sh') || parts[0].startsWith('sz')

        if (isCodeSearch) {
          // 股票代码搜索格式：sh600515,11,600515,sh600515,海南机场,,海南机场,99,1,ESG,
          return {
            code: parts[3], // 市场代码
            name: parts[6] // 股票名称
          }
        } else {
          // 股票名称搜索格式：名称,11,代码,市场代码,名称,,,99,1,ESG,
          return {
            code: parts[3], // 市场代码
            name: parts[0] // 股票名称
          }
        }
      })
  } catch (err) {
    console.error('搜索股票失败:', err)
    return []
  }
}
