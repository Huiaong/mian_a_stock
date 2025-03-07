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
  configureWebpack: {
    entry: {
      background: './src/background/main.js'
    },
    output: {
      filename: '[name].js',
      chunkFilename: '[name].js'
    },
    plugins,
    optimization: {
      splitChunks: false
    },
    devtool: 'inline-source-map'
  },
  chainWebpack: (config) => {
    // 移除 chunk-vendors，确保 background.js 是独立的
    config.optimization.delete('splitChunks')

    // 修改输出路径，确保 background.js 在根目录
    if (process.env.NODE_ENV === 'production') {
      config.output.filename('[name].js').chunkFilename('[name].js')
    }

    // 禁用 eval
    if (process.env.NODE_ENV === 'production') {
      config.mode('production').devtool('source-map')
    }
  }
}
