#!/usr/bin/env node
/**
 * OAuth 回调代理服务器
 * 监听端口 50047，将回调请求转发到端口 3000
 */

const http = require('http')
const { URL } = require('url')

const PROXY_PORT = 50047
const TARGET_PORT = 3000

const server = http.createServer((req, res) => {
  console.log(`📥 收到回调请求: ${req.method} ${req.url}`)
  
  if (req.url.startsWith('/oauth/callback')) {
    // 构建目标 URL
    const targetUrl = `http://localhost:${TARGET_PORT}${req.url}`
    console.log(`🔄 转发到: ${targetUrl}`)
    
    // 重定向到目标端口
    res.writeHead(302, {
      'Location': targetUrl,
      'Content-Type': 'text/html'
    })
    res.end(`
      <html>
        <head><title>OAuth 回调转发</title></head>
        <body>
          <h2>🔄 正在转发 OAuth 回调...</h2>
          <p>正在重定向到: <a href="${targetUrl}">${targetUrl}</a></p>
          <script>window.location.href = "${targetUrl}";</script>
        </body>
      </html>
    `)
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  }
})

server.listen(PROXY_PORT, () => {
  console.log(`🚀 OAuth 代理服务器启动成功!`)
  console.log(`📡 监听端口: ${PROXY_PORT}`)
  console.log(`🎯 转发目标: http://localhost:${TARGET_PORT}`)
  console.log(`🔗 回调地址: http://localhost:${PROXY_PORT}/oauth/callback`)
  console.log(`\n按 Ctrl+C 停止服务器`)
})

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n👋 正在关闭代理服务器...')
  server.close(() => {
    console.log('✅ 代理服务器已关闭')
    process.exit(0)
  })
})




