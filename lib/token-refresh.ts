import { saveMCPConfig, loadMCPConfig, MCPConfig } from './token-storage'
import { createClientRegistrationManager } from './oauth-client-registration'

const OAUTH_CONFIG = {
  tokenUrl: 'https://demo.ones.pro/mcp/oauth/token',
  clientId: process.env.OAUTH_CLIENT_ID || '43c243c9-fc2f-4b51-a2e4-5827aa922c24'
}

/**
 * 刷新访问令牌
 */
export async function refreshAccessToken(config: MCPConfig): Promise<MCPConfig> {
  if (!config.refreshToken) {
    throw new Error('No refresh token available')
  }

  console.log('Refreshing access token...')

  // 获取客户端信息
  let clientId = OAUTH_CONFIG.clientId
  try {
    // 尝试获取动态注册的客户端ID
    const authServerResponse = await fetch('https://demo.ones.pro/.well-known/oauth-authorization-server/mcp')
    if (authServerResponse.ok) {
      const authServerMetadata = await authServerResponse.json()
      const registrationEndpoint = authServerMetadata.registration_endpoint
      
      if (registrationEndpoint) {
        const registrationManager = createClientRegistrationManager(registrationEndpoint)
        const clientInfo = await registrationManager.getOrRegisterClient()
        clientId = clientInfo.client_id
      }
    }
  } catch (error) {
    console.warn('Failed to get dynamic client ID, using default:', error)
  }

  const tokenParams = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: config.refreshToken,
    client_id: clientId
  })

  const response = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: tokenParams.toString()
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Token refresh error:', errorData)
    throw new Error(`Token refresh failed: ${response.status} - ${errorData.error_description || errorData.error || response.statusText}`)
  }

  const tokenData = await response.json()
  console.log('Token refresh successful:', {
    hasAccessToken: !!tokenData.access_token,
    hasRefreshToken: !!tokenData.refresh_token,
    expiresIn: tokenData.expires_in
  })

  if (!tokenData.access_token) {
    throw new Error('No access token received in refresh response')
  }

  // 计算新的过期时间
  const expiresAt = tokenData.expires_in 
    ? Date.now() + (tokenData.expires_in * 1000)
    : undefined

  // 更新配置
  const updatedConfig: MCPConfig = {
    ...config,
    token: tokenData.access_token,
    refreshToken: tokenData.refresh_token || config.refreshToken, // 保留原有refresh_token如果没有新的
    tokenExpiresAt: expiresAt,
    isValid: true,
    lastValidated: Date.now()
  }

  // 保存更新后的配置
  await saveMCPConfig(updatedConfig)
  
  return updatedConfig
}

/**
 * 检查令牌是否需要刷新
 */
export function shouldRefreshToken(config: MCPConfig): boolean {
  const now = Date.now()
  
  // ONES令牌实际有效期很短，忽略expires_in，基于最后验证时间判断
  // 如果令牌被标记为无效，或者超过2分钟没有验证过，就刷新
  const twoMinutesAgo = now - 2 * 60 * 1000
  const shouldRefresh = !config.isValid || !config.lastValidated || config.lastValidated < twoMinutesAgo
  
  console.log('shouldRefreshToken - based on validation:', {
    isValid: config.isValid,
    lastValidated: config.lastValidated,
    lastValidatedDate: config.lastValidated ? new Date(config.lastValidated).toISOString() : null,
    twoMinutesAgo,
    timeSinceValidation: config.lastValidated ? now - config.lastValidated : 'never',
    shouldRefresh
  })
  
  return shouldRefresh
}

/**
 * 获取有效的访问令牌，必要时自动刷新
 */
export async function getValidAccessToken(): Promise<MCPConfig> {
  const config = await loadMCPConfig()
  console.log('getValidAccessToken - loaded config:', {
    hasToken: !!config.token,
    hasRefreshToken: !!config.refreshToken,
    tokenExpiresAt: config.tokenExpiresAt,
    isValid: config.isValid,
    lastValidated: config.lastValidated
  })
  
  if (!config.token) {
    throw new Error('No access token available. Please re-authorize.')
  }
  
  // 检查是否需要刷新
  const needsRefresh = shouldRefreshToken(config)
  console.log('getValidAccessToken - needs refresh:', needsRefresh)
  
  if (needsRefresh) {
    if (!config.refreshToken) {
      console.error('getValidAccessToken - no refresh token available')
      throw new Error('Access token expired and no refresh token available. Please re-authorize.')
    }
    
    try {
      console.log('getValidAccessToken - attempting token refresh...')
      const refreshedConfig = await refreshAccessToken(config)
      console.log('getValidAccessToken - token refresh successful')
      return refreshedConfig
    } catch (error) {
      console.error('getValidAccessToken - token refresh failed:', error)
      throw new Error('Failed to refresh access token. Please re-authorize.')
    }
  }
  
  return config
}
