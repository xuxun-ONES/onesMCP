#!/usr/bin/env node
/**
 * 测试 SSE 连接
 */

const http = require('http')

function testSSE() {
  console.log('🔄 测试 SSE 连接...')
  
  const postData = JSON.stringify({
    projectType: 'software',
    teamSize: 'small',
    industry: 'technology',
    requirements: ['测试'],
    features: ['测试'],
    timeline: '1 week'
  })
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/generate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache'
    }
  }
  
  const req = http.request(options, (res) => {
    console.log(`✅ 连接建立，状态码: ${res.statusCode}`)
    console.log('响应头:', res.headers)
    
    if (res.statusCode !== 200) {
      console.error('❌ 请求失败')
      return
    }
    
    console.log('\n📡 开始接收 SSE 数据...\n')
    
    let buffer = ''
    res.on('data', (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // 保留不完整的行
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6))
            const timestamp = new Date(data.timestamp).toLocaleTimeString()
            console.log(`[${timestamp}] [${data.level.toUpperCase()}] ${data.step}`)
            if (data.data) {
              console.log(`  └─ ${JSON.stringify(data.data)}`)
            }
          } catch (e) {
            console.log(`Raw: ${line}`)
          }
        } else if (line.trim()) {
          console.log(`Other: ${line}`)
        }
      }
    })
    
    res.on('end', () => {
      console.log('\n🎉 SSE 流结束')
    })
    
    res.on('error', (error) => {
      console.error('❌ SSE 错误:', error)
    })
  })
  
  req.on('error', (error) => {
    console.error('❌ 请求错误:', error)
  })
  
  // 设置超时
  req.setTimeout(30000, () => {
    console.log('⏰ 请求超时')
    req.destroy()
  })
  
  req.write(postData)
  req.end()
}

testSSE()




