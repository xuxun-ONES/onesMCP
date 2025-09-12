import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken, getOAuthState, removeOAuthState } from '@/lib/oauth'
import { saveMCPConfig } from '@/lib/token-storage'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  
  console.log('OAuth callback received at /oauth/callback:', {
    code: code ? `${code.substring(0, 10)}...` : null,
    state: state ? `${state.substring(0, 10)}...` : null,
    error,
    errorDescription,
    fullUrl: request.url
  })
  
  // 处理授权错误
  if (error) {
    const errorMsg = errorDescription || error
    console.error('OAuth authorization error:', errorMsg)
    return NextResponse.redirect(
      new URL(`/settings?oauth_error=${encodeURIComponent(errorMsg)}`, request.url)
    )
  }
  
  // 验证必需参数
  if (!code || !state) {
    console.error('Missing OAuth parameters:', { code: !!code, state: !!state })
    return NextResponse.redirect(
      new URL('/settings?oauth_error=Missing authorization code or state', request.url)
    )
  }
  
  try {
    // 获取存储的状态
    console.log('Looking for stored state:', state)
    const storedState = await getOAuthState(state)
    if (!storedState) {
      console.error('No stored state found for:', state)
      throw new Error('Invalid or expired authorization state')
    }
    
    console.log('Found stored state, exchanging token...')
    
    // 交换授权码获取访问令牌
    const tokenData = await exchangeCodeForToken(code, state, storedState)
    
    console.log('Token exchange successful:', {
      hasAccessToken: !!tokenData.access_token,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in
    })
    
    // 清理状态
    await removeOAuthState(state)
    
    // 直接保存到持久化存储
    try {
      await saveMCPConfig({
        serverUrl: 'https://demo.ones.pro/mcp',
        token: tokenData.access_token,
        isValid: true,
        lastValidated: Date.now()
      })
      console.log('Token stored in persistent storage successfully', {
        redirectUri: process.env.OAUTH_REDIRECT_URI || 'default',
        serverUrl: 'https://demo.ones.pro/mcp'
      })
    } catch (error) {
      console.error('Failed to store token in persistent storage:', error)
      throw new Error('令牌保存失败')
    }
    
    // 将访问令牌通过 URL 参数传递给前端
    const redirectUrl = new URL('/settings', request.url)
    redirectUrl.searchParams.set('oauth_success', 'true')
    redirectUrl.searchParams.set('access_token', tokenData.access_token)
    redirectUrl.searchParams.set('token_type', tokenData.token_type || 'Bearer')
    
    console.log('Redirecting to settings with success parameters')
    return NextResponse.redirect(redirectUrl)
    
  } catch (error) {
    console.error('OAuth token exchange error:', error)
    const errorMsg = error instanceof Error ? error.message : 'Token exchange failed'
    return NextResponse.redirect(
      new URL(`/settings?oauth_error=${encodeURIComponent(errorMsg)}`, request.url)
    )
  }
}
