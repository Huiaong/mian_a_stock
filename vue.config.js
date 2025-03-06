const CopyWebpackPlugin = require('copy-webpack-plugin')
const path = require('path')

// 复制文件到指定目录
const copyFiles = [
  {
    from: path.resolve('src/plugins/manifest.json'),
    to: `${path.resolve('dist')}/manifest.json`
  },
  {
    from: path.resolve('src/assets'),
    to: path.resolve('dist/assets')
  }
]

// 复制插件
const plugins = [
  new CopyWebpackPlugin({
    patterns: copyFiles
  }),
  new CopyWebpackPlugin({
    patterns: [
      {
        from: path.resolve('src/assets/images'),
        to: path.resolve('dist'),
        globOptions: {
          ignore: ['.*']
        }
      }
    ]
  })
]

// 页面文件
const pages = {}
// 配置 popup.html 页面
const chromeName = ['popup']

chromeName.forEach((name) => {
  pages[name] = {
    entry: `src/${name}/main.js`,
    template: `src/${name}/index.html`,
    filename: `${name}.html`
  }
})

module.exports = {
  pages,
  productionSourceMap: false,
  // 只保留 background.js 的配置
  configureWebpack: {
    entry: {
      background: './src/background/main.js'
    },
    output: {
      filename: 'js/[name].js'
    },
    plugins
  },
  chainWebpack: (config) => {
    if (process.env.NODE_ENV === 'production') {
      config.output.filename('js/[name].js').end()
      config.output.chunkFilename('js/[name].js').end()
    }
  }
}
