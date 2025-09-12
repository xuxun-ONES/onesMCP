import { NextResponse } from 'next/server'
import { generateAuthUrl, storeOAuthState } from '@/lib/oauth'
import { createClientRegistrationManager } from '@/lib/oauth-client-registration'

export async function POST() {
  try {
    // 首先获取或注册客户端
    console.log('正在尝试连接 ONES OAuth 服务器...')
    
    let authServerResponse
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 增加到30秒超时
      
      authServerResponse = await fetch('https://demo.ones.pro/.well-known/oauth-authorization-server/mcp', {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
    } catch (fetchError) {
      console.error('连接 ONES 服务器失败:', fetchError)
      throw new Error(`无法连接到 ONES 服务器 (demo.ones.pro)。请检查：
1. 网络连接是否正常
2. ONES 服务器是否可访问
3. 域名 demo.ones.pro 是否正确
4. 是否需要配置代理或VPN

技术错误: ${fetchError instanceof Error ? fetchError.message : '网络连接失败'}`)
    }
    
    if (!authServerResponse.ok) {
      throw new Error(`OAuth 授权服务器响应错误: HTTP ${authServerResponse.status} ${authServerResponse.statusText}`)
    }
    
    const authServerMetadata = await authServerResponse.json()
    const registrationEndpoint = authServerMetadata.registration_endpoint
    
    if (!registrationEndpoint) {
      throw new Error('OAuth 授权服务器不支持动态客户端注册')
    }
    
    // 获取或注册客户端
    const registrationManager = createClientRegistrationManager(registrationEndpoint)
    const clientInfo = await registrationManager.getOrRegisterClient()
    
    console.log('使用客户端 ID:', clientInfo.client_id)
    
    // 使用动态客户端 ID 生成授权 URL
    const { url, state } = await generateAuthUrl(clientInfo.client_id)
    
    // 存储状态用于后续验证
    await storeOAuthState(state)
    
    return NextResponse.json({
      success: true,
      authUrl: url,
      state: state.state,
      client_id: clientInfo.client_id
    })
  } catch (error) {
    console.error('OAuth authorization error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Authorization failed' 
      },
      { status: 500 }
    )
  }
}
