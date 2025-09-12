import { NextResponse } from 'next/server'
import { MCPAuthClient } from '@/lib/mcp-auth'

export async function POST() {
  try {
    const mcpAuth = new MCPAuthClient('https://demo.ones.pro')
    
    // 执行完整的认证流程（发现 + 注册 + 生成授权URL）
    const result = await mcpAuth.authenticate()
    
    return NextResponse.json({
      success: true,
      ...result,
      serverMetadata: mcpAuth.getServerMetadata(),
      clientRegistration: mcpAuth.getClientRegistration()
    })
  } catch (error) {
    console.error('MCP authentication discovery failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Authentication discovery failed' 
      },
      { status: 500 }
    )
  }
}




