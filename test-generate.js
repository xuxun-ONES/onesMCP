#!/usr/bin/env node
/**
 * 测试演示数据生成流程
 */

async function testGenerate() {
  console.log('🧪 开始测试演示数据生成流程...\n')
  
  try {
    // 创建一个测试请求
    const testData = {
      projectType: 'software',
      teamSize: 'small',
      industry: 'technology',
      requirements: ['基础功能测试', '用户管理', '数据分析'],
      features: ['登录注册', '用户权限', '数据报表'],
      timeline: '1 month'
    }
    
    console.log('📤 发送生成请求...')
    console.log('测试数据:', JSON.stringify(testData, null, 2))
    
    const response = await fetch('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    })
    
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status} ${response.statusText}`)
    }
    
    console.log('✅ 请求发送成功，开始接收 SSE 流...\n')
    
    // 读取 SSE 流
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6))
              console.log(`[${data.level.toUpperCase()}] ${data.step}`, data.data ? `- ${JSON.stringify(data.data)}` : '')
            } catch (e) {
              console.log('Raw data:', line)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
    
    console.log('\n🎉 演示数据生成完成!')
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message)
    
    if (error.message.includes('fetch')) {
      console.log('\n💡 可能的原因:')
      console.log('1. Next.js 服务器未启动 (运行 npm run dev)')
      console.log('2. OAuth 代理服务器未启动 (运行 node oauth-proxy.js)')
      console.log('3. MCP 配置未完成 (需要先完成 OAuth 授权)')
    }
  }
}

// 运行测试
testGenerate().catch(console.error)




