import { z } from 'zod'

// OAuth 服务器元数据 Schema
export const OAuthServerMetadataSchema = z.object({
  issuer: z.string(),
  authorization_endpoint: z.string(),
  token_endpoint: z.string(),
  registration_endpoint: z.string().optional(),
  response_types_supported: z.array(z.string()),
  code_challenge_methods_supported: z.array(z.string()).optional()
})

// 受保护资源元数据 Schema
export const ProtectedResourceMetadataSchema = z.object({
  resource: z.string(),
  authorization_servers: z.array(z.string())
})

// 客户端注册响应 Schema
export const ClientRegistrationSchema = z.object({
  client_id: z.string(),
  client_name: z.string().optional(),
  client_uri: z.string().optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  redirect_uris: z.array(z.string()).optional(),
  token_endpoint_auth_method: z.string().optional()
})

export type OAuthServerMetadata = z.infer<typeof OAuthServerMetadataSchema>
export type ProtectedResourceMetadata = z.infer<typeof ProtectedResourceMetadataSchema>
export type ClientRegistration = z.infer<typeof ClientRegistrationSchema>

export class MCPAuthClient {
  private baseUrl: string
  private mcpResourceUrl: string
  private serverMetadata: OAuthServerMetadata | null = null
  private clientRegistration: ClientRegistration | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.mcpResourceUrl = `${this.baseUrl}/openapi/mcp`
  }

  /**
   * 步骤 1: 访问受保护资源，获取认证信息
   */
  async discoverAuthServer(): Promise<{ resourceMetadata: ProtectedResourceMetadata; serverMetadata: OAuthServerMetadata }> {
    console.log('🔍 步骤 1: 发现授权服务器...')
    
    // 1.1 访问受保护资源，获取 WWW-Authenticate header
    const protectedResponse = await fetch(this.mcpResourceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          clientInfo: { name: 'ones-demo-generator', version: '1.0.0' }
        },
        id: 1
      })
    })

    if (protectedResponse.status !== 401) {
      throw new Error('Expected 401 Unauthorized response from protected resource')
    }

    const wwwAuthenticate = protectedResponse.headers.get('WWW-Authenticate')
    console.log('WWW-Authenticate header:', wwwAuthenticate)

    // 解析 resource_metadata URL
    const resourceMetadataMatch = wwwAuthenticate?.match(/resource_metadata="([^"]+)"/)
    if (!resourceMetadataMatch) {
      throw new Error('No resource_metadata found in WWW-Authenticate header')
    }

    const resourceMetadataUrl = resourceMetadataMatch[1]
    console.log('Resource metadata URL:', resourceMetadataUrl)

    // 1.2 获取受保护资源元数据
    const resourceMetadataResponse = await fetch(resourceMetadataUrl)
    if (!resourceMetadataResponse.ok) {
      throw new Error(`Failed to fetch resource metadata: ${resourceMetadataResponse.status}`)
    }

    const resourceMetadata = ProtectedResourceMetadataSchema.parse(await resourceMetadataResponse.json())
    console.log('Resource metadata:', resourceMetadata)

    // 1.3 获取授权服务器元数据
    const authServerUrl = resourceMetadata.authorization_servers[0]
    const issuerPath = new URL(authServerUrl).pathname
    const serverMetadataUrl = `${this.baseUrl}/.well-known/oauth-authorization-server${issuerPath}`
    
    console.log('Server metadata URL:', serverMetadataUrl)

    const serverMetadataResponse = await fetch(serverMetadataUrl)
    if (!serverMetadataResponse.ok) {
      throw new Error(`Failed to fetch server metadata: ${serverMetadataResponse.status}`)
    }

    const serverMetadata = OAuthServerMetadataSchema.parse(await serverMetadataResponse.json())
    console.log('Server metadata:', serverMetadata)

    this.serverMetadata = serverMetadata
    return { resourceMetadata, serverMetadata }
  }

  /**
   * 步骤 2: 注册客户端（如果需要）
   */
  async registerClient(): Promise<ClientRegistration> {
    if (!this.serverMetadata?.registration_endpoint) {
      throw new Error('No registration endpoint available')
    }

    console.log('📝 步骤 2: 注册客户端...')

    const registrationData = {
      client_name: "ONES Demo Generator",
      client_uri: "http://localhost:3000",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      redirect_uris: [
        "http://localhost:3000/oauth/callback",
        "http://localhost:50047/oauth/callback", // 支持多个回调地址
        "http://127.0.0.1:3000/oauth/callback",
        "http://127.0.0.1:50047/oauth/callback"
      ],
      token_endpoint_auth_method: "none"
    }

    const response = await fetch(this.serverMetadata.registration_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(registrationData)
    })

    if (!response.ok) {
      throw new Error(`Client registration failed: ${response.status} - ${await response.text()}`)
    }

    const clientRegistration = ClientRegistrationSchema.parse(await response.json())
    console.log('Client registered:', { client_id: clientRegistration.client_id })

    this.clientRegistration = clientRegistration
    return clientRegistration
  }

  /**
   * 步骤 3: 生成授权 URL
   */
  async generateAuthUrl(redirectUri?: string): Promise<{ url: string; state: string; codeVerifier: string }> {
    if (!this.serverMetadata) {
      throw new Error('Server metadata not available. Call discoverAuthServer() first.')
    }

    if (!this.clientRegistration) {
      throw new Error('Client not registered. Call registerClient() first.')
    }

    console.log('🔗 步骤 3: 生成授权 URL...')

    // 生成 PKCE 参数
    const codeVerifier = this.generateRandomString(128)
    const codeChallenge = await this.sha256(codeVerifier)
    const state = this.generateRandomString(32)

    // 使用提供的 redirectUri 或默认的第一个
    const finalRedirectUri = redirectUri || this.clientRegistration.redirect_uris?.[0] || 'http://localhost:3000/oauth/callback'

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientRegistration.client_id,
      redirect_uri: finalRedirectUri,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      resource: this.mcpResourceUrl // 添加 resource 参数
    })

    const authUrl = `${this.serverMetadata.authorization_endpoint}?${params.toString()}`
    console.log('Authorization URL generated')

    return { url: authUrl, state, codeVerifier }
  }

  /**
   * 步骤 4: 交换授权码获取令牌
   */
  async exchangeCodeForToken(code: string, codeVerifier: string, redirectUri: string): Promise<{ access_token: string; token_type: string }> {
    if (!this.serverMetadata) {
      throw new Error('Server metadata not available')
    }

    if (!this.clientRegistration) {
      throw new Error('Client not registered')
    }

    console.log('🔄 步骤 4: 交换访问令牌...')

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientRegistration.client_id,
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    })

    const response = await fetch(this.serverMetadata.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenParams.toString()
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Token exchange failed: ${response.status} - ${errorData.error_description || errorData.error || response.statusText}`)
    }

    const tokenData = await response.json()
    console.log('Token exchange successful')

    return tokenData
  }

  /**
   * 完整的认证流程
   */
  async authenticate(): Promise<{ authUrl: string; state: string; codeVerifier: string; clientId: string }> {
    try {
      // 步骤 1: 发现授权服务器
      await this.discoverAuthServer()

      // 步骤 2: 注册客户端
      await this.registerClient()

      // 步骤 3: 生成授权 URL
      const { url, state, codeVerifier } = await this.generateAuthUrl()

      return {
        authUrl: url,
        state,
        codeVerifier,
        clientId: this.clientRegistration!.client_id
      }
    } catch (error) {
      console.error('MCP authentication failed:', error)
      throw error
    }
  }

  // 工具方法
  private generateRandomString(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    return result
  }

  private async sha256(plain: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(plain)
    const hash = await crypto.subtle.digest('SHA-256', data)
    
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  // Getters
  getServerMetadata(): OAuthServerMetadata | null {
    return this.serverMetadata
  }

  getClientRegistration(): ClientRegistration | null {
    return this.clientRegistration
  }
}




