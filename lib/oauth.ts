import { z } from 'zod'
import { promises as fs } from 'fs'
import { join } from 'path'

// OAuth 配置
export const OAUTH_CONFIG = {
  authUrl: 'https://demo.ones.pro/mcp/oauth/authorize',
  tokenUrl: 'https://demo.ones.pro/mcp/oauth/token',
  clientId: '8f39e712-1e73-456b-bada-69743dd3af14',
  redirectUri: process.env.NODE_ENV === 'production' 
    ? 'https://your-app-domain.com/oauth/callback'
    : process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/oauth/callback',
  scope: '' // ONES 可能不支持 mcp scope
}

// OAuth 状态存储 Schema
export const OAuthStateSchema = z.object({
  state: z.string(),
  codeVerifier: z.string(),
  codeChallenge: z.string(),
  createdAt: z.number(),
  clientId: z.string().optional()
})

export type OAuthState = z.infer<typeof OAuthStateSchema>

// 生成随机字符串
function generateRandomString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

// 生成 SHA256 哈希并转为 base64url
async function sha256(plain: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  const hash = await crypto.subtle.digest('SHA-256', data)
  
  // 转换为 base64url 格式
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// 生成 PKCE 参数
export async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const codeVerifier = generateRandomString(128)
  const codeChallenge = await sha256(codeVerifier)
  
  return {
    codeVerifier,
    codeChallenge
  }
}

// 生成授权 URL
export async function generateAuthUrl(clientId?: string): Promise<{ url: string; state: OAuthState }> {
  const state = generateRandomString(32)
  const { codeVerifier, codeChallenge } = await generatePKCE()
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId || OAUTH_CONFIG.clientId,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    resource: 'https://demo.ones.pro/mcp'
  })
  
  // 只有当 scope 不为空时才添加 scope 参数
  if (OAUTH_CONFIG.scope) {
    params.set('scope', OAUTH_CONFIG.scope)
  }
  
  const authUrl = `${OAUTH_CONFIG.authUrl}?${params.toString()}`
  
  const oauthState: OAuthState = {
    state,
    codeVerifier,
    codeChallenge,
    createdAt: Date.now(),
    clientId: clientId || OAUTH_CONFIG.clientId
  }
  
  return {
    url: authUrl,
    state: oauthState
  }
}

// 交换授权码获取访问令牌
export async function exchangeCodeForToken(
  code: string, 
  state: string, 
  storedState: OAuthState
): Promise<{ access_token: string; token_type: string; expires_in?: number; refresh_token?: string }> {
  // 验证 state 参数
  if (state !== storedState.state) {
    throw new Error('Invalid state parameter')
  }
  
  // 检查状态是否过期（10分钟）
  if (Date.now() - storedState.createdAt > 10 * 60 * 1000) {
    throw new Error('Authorization state expired')
  }
  
  const clientId = storedState.clientId || OAUTH_CONFIG.clientId
  
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code: code,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    code_verifier: storedState.codeVerifier
  })
  
  console.log('Sending token exchange request to:', OAUTH_CONFIG.tokenUrl)
  console.log('Token exchange parameters:', {
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    code: `${code.substring(0, 10)}...`,
    code_verifier: `${storedState.codeVerifier.substring(0, 10)}...`
  })
  
  const response = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: tokenParams.toString()
  })
  
  console.log('Token exchange response status:', response.status)
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Token exchange error response:', errorData)
    throw new Error(`Token exchange failed: ${response.status} - ${errorData.error_description || errorData.error || response.statusText}`)
  }
  
  const tokenData = await response.json()
  console.log('Token exchange response data:', {
    hasAccessToken: !!tokenData.access_token,
    tokenType: tokenData.token_type,
    expiresIn: tokenData.expires_in,
    scope: tokenData.scope,
    hasRefreshToken: !!tokenData.refresh_token
  })
  
  // 记录完整响应以便调试
  console.log('Full token response keys:', Object.keys(tokenData))
  
  if (!tokenData.access_token) {
    throw new Error('No access token received')
  }
  
  return tokenData
}

// 混合存储：内存 + 文件系统（开发环境防止热重载丢失状态）
export const oauthStates = new Map<string, OAuthState>()
const TEMP_DIR = join(process.cwd(), '.tmp')
const OAUTH_STATES_FILE = join(TEMP_DIR, 'oauth-states.json')

// 确保临时目录存在
async function ensureTempDir() {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true })
  } catch (error) {
    // 目录已存在，忽略错误
  }
}

// 从文件加载状态
async function loadStatesFromFile(): Promise<void> {
  try {
    const data = await fs.readFile(OAUTH_STATES_FILE, 'utf-8')
    const states = JSON.parse(data) as Record<string, OAuthState>
    
    // 过滤掉过期的状态
    const now = Date.now()
    Object.entries(states).forEach(([key, state]) => {
      if (now - state.createdAt < 10 * 60 * 1000) { // 10分钟内有效
        oauthStates.set(key, state)
      }
    })
    
    console.log('Loaded OAuth states from file:', oauthStates.size)
  } catch (error) {
    // 文件不存在或读取失败，忽略
    console.log('No OAuth states file found, starting fresh')
  }
}

// 保存状态到文件
async function saveStatesToFile(): Promise<void> {
  try {
    await ensureTempDir()
    const states = Object.fromEntries(oauthStates)
    await fs.writeFile(OAUTH_STATES_FILE, JSON.stringify(states, null, 2))
  } catch (error) {
    console.error('Failed to save OAuth states to file:', error)
  }
}

// 初始化时加载状态（使用立即执行的异步函数）
;(async () => {
  await loadStatesFromFile()
})()

export async function storeOAuthState(state: OAuthState): Promise<void> {
  console.log('Storing OAuth state:', state.state)
  oauthStates.set(state.state, state)
  console.log('Total stored states:', oauthStates.size)
  
  // 保存到文件
  await saveStatesToFile()
  
  // 清理过期状态（10分钟后）
  setTimeout(async () => {
    oauthStates.delete(state.state)
    await saveStatesToFile()
    console.log('Cleaned up expired OAuth state:', state.state)
  }, 10 * 60 * 1000)
}

export async function getOAuthState(state: string): Promise<OAuthState | undefined> {
  console.log('Looking for OAuth state:', state)
  
  // 如果内存中没有，尝试从文件加载
  if (!oauthStates.has(state)) {
    await loadStatesFromFile()
  }
  
  console.log('Available states:', Array.from(oauthStates.keys()))
  return oauthStates.get(state)
}

export async function removeOAuthState(state: string): Promise<void> {
  oauthStates.delete(state)
  await saveStatesToFile()
}
