import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    
    if (!token) {
      return NextResponse.json({
        valid: false,
        error: 'No token provided'
      })
    }
    
    // 测试令牌是否能访问 ONES MCP 初始化端点
    const response = await fetch('https://demo.ones.pro/mcp/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: {
          name: 'ones-demo-generator',
          version: '1.0.0'
        }
      })
    })
    
    const isValid = response.ok
    let errorMessage = ''
    
    if (!isValid) {
      if (response.status === 401) {
        errorMessage = '令牌无效或已过期'
      } else if (response.status === 403) {
        errorMessage = '令牌没有足够的权限'
      } else {
        errorMessage = `服务器错误: ${response.status}`
      }
    }
    
    return NextResponse.json({
      valid: isValid,
      status: response.status,
      error: errorMessage
    })
    
  } catch (error) {
    return NextResponse.json({
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}




