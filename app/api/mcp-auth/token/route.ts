import { NextRequest, NextResponse } from 'next/server'
import { MCPAuthClient } from '@/lib/mcp-auth'

// 临时存储认证状态（生产环境应使用更安全的存储）
const authStates = new Map<string, {
  codeVerifier: string
  clientId: string
  redirectUri: string
  createdAt: number
}>()

export async function POST(request: NextRequest) {
  try {
    const { code, state, redirectUri } = await request.json()

    if (!code || !state) {
      return NextResponse.json(
        { success: false, error: 'Missing code or state parameter' },
        { status: 400 }
      )
    }

    // 获取存储的认证状态
    const authState = authStates.get(state)
    if (!authState) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired state parameter' },
        { status: 400 }
      )
    }

    // 检查状态是否过期（10分钟）
    if (Date.now() - authState.createdAt > 10 * 60 * 1000) {
      authStates.delete(state)
      return NextResponse.json(
        { success: false, error: 'State parameter expired' },
        { status: 400 }
      )
    }

    // 创建 MCP 认证客户端并交换令牌
    const mcpAuth = new MCPAuthClient('https://demo.ones.pro')
    
    // 重新发现服务器信息（因为这是新的实例）
    await mcpAuth.discoverAuthServer()

    // 模拟客户端注册（在实际应用中，这些信息应该从状态中恢复）
    // 这里我们需要重新构建客户端注册信息
    const mockClientRegistration = {
      client_id: authState.clientId,
      redirect_uris: [redirectUri]
    }
    
    // 直接设置客户端注册信息（这是一个简化的方法）
    ;(mcpAuth as any).clientRegistration = mockClientRegistration

    // 交换令牌
    const tokenData = await mcpAuth.exchangeCodeForToken(
      code,
      authState.codeVerifier,
      authState.redirectUri
    )

    // 清理状态
    authStates.delete(state)

    return NextResponse.json({
      success: true,
      access_token: tokenData.access_token,
      token_type: tokenData.token_type
    })

  } catch (error) {
    console.error('Token exchange failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Token exchange failed' 
      },
      { status: 500 }
    )
  }
}

// 存储认证状态的辅助函数
function storeAuthState(state: string, authState: {
  codeVerifier: string
  clientId: string
  redirectUri: string
}) {
  authStates.set(state, {
    ...authState,
    createdAt: Date.now()
  })

  // 10分钟后自动清理
  setTimeout(() => {
    authStates.delete(state)
  }, 10 * 60 * 1000)
}
