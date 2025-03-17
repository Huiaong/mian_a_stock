/**
 * 判断当前是否为交易时间
 * @returns {boolean}
 */
export function isTradingTime() {
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const time = hour * 100 + minute

  // 判断是否在交易时段内
  const isInTradingHours =
    (time >= 915 && time <= 1130) || (time >= 1300 && time <= 1500)

  if (!isInTradingHours) return false

  // 判断是否为工作日
  const day = now.getDay()
  if (day === 0 || day === 6) return false

  // 获取当前日期字符串 YYYY-MM-DD
  const dateStr = now.toISOString().split('T')[0]
  const year = now.getFullYear().toString()

  // 从 holiday.json 中获取节假日数据
  const holidayData = require('@/assets/holiday.json')

  // 获取当年的节假日数据
  const yearData = holidayData.data[year]
  if (!yearData) return true // 如果没有当年数据，默认为交易日

  // 将日期转换为 MM-DD 格式
  const shortDate = dateStr.substring(5) // 获取 MM-DD 部分

  // 检查是否为节假日或补班日
  const dayInfo = yearData[shortDate]
  if (!dayInfo) return true // 如果没有特殊日期信息，则为普通工作日

  // holiday 为 true 表示放假，false 表示补班
  return !dayInfo.holiday
}
