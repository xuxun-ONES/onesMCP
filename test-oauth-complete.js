#!/usr/bin/env node
/**
 * 测试完整的 OAuth 流程
 */

const http = require('http')
const https = require('https')
const { URL } = require('url')

async function testOAuthFlow() {
  console.log('🔄 开始测试完整的 OAuth 流程...\n')
  
  try {
    // 1. 生成授权 URL
    console.log('1️⃣ 生成授权 URL...')
    const authResponse = await fetch('http://localhost:3000/api/oauth/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    
    if (!authResponse.ok) {
      throw new Error(`授权请求失败: ${authResponse.status}`)
    }
    
    const authData = await authResponse.json()
    console.log('✅ 授权 URL 生成成功')
    console.log('State:', authData.state)
    console.log('Auth URL:', authData.authUrl)
    console.log()
    
    // 2. 检查 MCP 配置状态
    console.log('2️⃣ 检查当前 MCP 配置...')
    const mcpResponse = await fetch('http://localhost:3000/api/mcp')
    const mcpData = await mcpResponse.json()
    console.log('MCP 配置:', mcpData)
    console.log()
    
    // 3. 模拟用户手动完成授权并获取回调
    console.log('3️⃣ 请在浏览器中访问以下 URL 完成授权:')
    console.log(authData.authUrl)
    console.log()
    console.log('授权完成后，OAuth 代理服务器会自动处理回调...')
    console.log('请等待授权完成，然后按 Enter 继续...')
    
    // 等待用户输入
    await new Promise(resolve => {
      const stdin = process.stdin
      stdin.setRawMode(true)
      stdin.resume()
      stdin.setEncoding('utf8')
      stdin.on('data', (key) => {
        if (key === '\r' || key === '\n') {
          stdin.setRawMode(false)
          stdin.pause()
          resolve()
        }
      })
    })
    
    // 4. 检查授权后的配置
    console.log('\n4️⃣ 检查授权后的 MCP 配置...')
    const mcpResponse2 = await fetch('http://localhost:3000/api/mcp')
    const mcpData2 = await mcpResponse2.json()
    console.log('授权后的 MCP 配置:', mcpData2)
    
    if (mcpData2.hasToken) {
      console.log('✅ 令牌获取成功!')
      
      // 5. 测试 MCP 连接
      console.log('\n5️⃣ 测试 MCP 连接...')
      const testResponse = await fetch('http://localhost:3000/api/mcp', {
        method: 'PATCH'
      })
      const testData = await testResponse.json()
      console.log('连接测试结果:', testData)
      
      if (testData.success) {
        console.log('🎉 OAuth 流程完全成功!')
      } else {
        console.log('❌ MCP 连接测试失败')
      }
    } else {
      console.log('❌ 令牌获取失败')
      console.log('请检查 OAuth 回调是否正确处理')
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message)
  }
}

// 运行测试
testOAuthFlow().catch(console.error)




