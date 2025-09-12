import { NextRequest, NextResponse } from 'next/server'
import { createClientRegistrationManager } from '@/lib/oauth-client-registration'

// 获取或注册 OAuth 客户端
export async function POST(request: NextRequest) {
  try {
    // 获取注册端点（从 .well-known 获取）
    const authServerResponse = await fetch('https://demo.ones.pro/.well-known/oauth-authorization-server/mcp')
    
    if (!authServerResponse.ok) {
      throw new Error('无法获取 OAuth 授权服务器元数据')
    }
    
    const authServerMetadata = await authServerResponse.json()
    const registrationEndpoint = authServerMetadata.registration_endpoint
    
    if (!registrationEndpoint) {
      throw new Error('OAuth 授权服务器不支持动态客户端注册')
    }
    
    // 创建客户端注册管理器
    const registrationManager = createClientRegistrationManager(registrationEndpoint)
    
    // 获取或注册客户端
    const clientInfo = await registrationManager.getOrRegisterClient()
    
    return NextResponse.json({
      success: true,
      client: {
        client_id: clientInfo.client_id,
        client_name: clientInfo.client_name,
        redirect_uris: clientInfo.redirect_uris,
        created_at: clientInfo.created_at,
        has_secret: !!clientInfo.client_secret
      }
    })
  } catch (error) {
    console.error('客户端注册失败:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '客户端注册失败'
    }, { status: 500 })
  }
}

// 获取当前客户端信息
export async function GET(request: NextRequest) {
  try {
    const { loadClientInfo } = await import('@/lib/oauth-client-registration')
    const clientInfo = await loadClientInfo()
    
    if (!clientInfo) {
      return NextResponse.json({
        success: false,
        error: '未找到客户端信息'
      }, { status: 404 })
    }
    
    return NextResponse.json({
      success: true,
      client: {
        client_id: clientInfo.client_id,
        client_name: clientInfo.client_name,
        redirect_uris: clientInfo.redirect_uris,
        created_at: clientInfo.created_at,
        has_secret: !!clientInfo.client_secret,
        expires_at: clientInfo.client_secret_expires_at
      }
    })
  } catch (error) {
    console.error('获取客户端信息失败:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '获取客户端信息失败'
    }, { status: 500 })
  }
}
