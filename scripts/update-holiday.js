const fs = require('fs')
const path = require('path')
const https = require('https')

const HOLIDAY_URL = 'https://x2rr.github.io/funds/holiday.json'
const OUTPUT_PATH = path.resolve(__dirname, '../src/assets/holiday.json')

// 确保目录存在
function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath)
  if (fs.existsSync(dirname)) {
    return true
  }
  ensureDirectoryExistence(dirname)
  fs.mkdirSync(dirname)
}

// 获取节假日数据
function fetchHolidayData() {
  return new Promise((resolve, reject) => {
    https
      .get(HOLIDAY_URL, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          try {
            const holidayData = JSON.parse(data)
            resolve(holidayData)
          } catch (err) {
            reject(new Error('解析数据失败: ' + err.message))
          }
        })
      })
      .on('error', (err) => {
        reject(new Error('获取数据失败: ' + err.message))
      })
  })
}

// 主函数
async function main() {
  try {
    console.log('开始获取节假日数据...')
    const holidayData = await fetchHolidayData()
    
    // 确保目录存在
    ensureDirectoryExistence(OUTPUT_PATH)
    
    // 写入文件
    fs.writeFileSync(
      OUTPUT_PATH,
      JSON.stringify(holidayData, null, 2),
      'utf8'
    )
    
    console.log('节假日数据已更新到:', OUTPUT_PATH)
  } catch (err) {
    console.error('更新失败:', err.message)
    process.exit(1)
  }
}

main() 