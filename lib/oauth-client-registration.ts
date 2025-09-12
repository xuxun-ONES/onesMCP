import { z } from 'zod'
import { promises as fs } from 'fs'
import { join } from 'path'

// OAuth 客户端注册请求 Schema
export const ClientRegistrationRequestSchema = z.object({
  client_name: z.string(),
  client_uri: z.string().url(),
  grant_types: z.array(z.string()),
  response_types: z.array(z.string()),
  redirect_uris: z.array(z.string().url()),
  token_endpoint_auth_method: z.string()
})

// OAuth 客户端注册响应 Schema
export const ClientRegistrationResponseSchema = z.object({
  client_id: z.string(),
  client_secret: z.string().optional(),
  client_secret_expires_at: z.number().optional(),
  client_id_issued_at: z.number().optional(),
  redirect_uris: z.array(z.string().url()),
  grant_types: z.array(z.string()),
  response_types: z.array(z.string()),
  client_name: z.string(),
  client_uri: z.string().url().optional(),
  token_endpoint_auth_method: z.string()
})

export type ClientRegistrationRequest = z.infer<typeof ClientRegistrationRequestSchema>
export type ClientRegistrationResponse = z.infer<typeof ClientRegistrationResponseSchema>

// 客户端存储接口
export interface StoredClientInfo {
  client_id: string
  client_secret?: string
  client_secret_expires_at?: number
  client_id_issued_at?: number
  redirect_uris: string[]
  grant_types: string[]
  response_types: string[]
  client_name: string
  client_uri?: string
  token_endpoint_auth_method: string
  registration_endpoint: string
  created_at: number
}

// 客户端信息存储文件路径
const CONFIG_DIR = join(process.cwd(), '.config')
const CLIENT_FILE = join(CONFIG_DIR, 'oauth-client.json')

// 确保配置目录存在
async function ensureConfigDir(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true })
  } catch (error) {
    // 目录已存在，忽略错误
  }
}

// 保存客户端信息
export async function saveClientInfo(clientInfo: StoredClientInfo): Promise<void> {
  await ensureConfigDir()
  await fs.writeFile(CLIENT_FILE, JSON.stringify(clientInfo, null, 2), 'utf-8')
}

// 加载客户端信息
export async function loadClientInfo(): Promise<StoredClientInfo | null> {
  try {
    const data = await fs.readFile(CLIENT_FILE, 'utf-8')
    return JSON.parse(data) as StoredClientInfo
  } catch (error) {
    return null
  }
}

// 检查客户端是否需要重新注册
export function shouldReregisterClient(clientInfo: StoredClientInfo | null): boolean {
  if (!clientInfo) return true
  
  // 如果有 client_secret 且已过期，需要重新注册
  if (clientInfo.client_secret && clientInfo.client_secret_expires_at) {
    const now = Math.floor(Date.now() / 1000)
    if (now >= clientInfo.client_secret_expires_at) {
      return true
    }
  }
  
  // 客户端信息超过 30 天，建议重新注册
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
  if (clientInfo.created_at < thirtyDaysAgo) {
    return true
  }
  
  return false
}

// OAuth 客户端注册管理器
export class OAuthClientRegistration {
  private registrationEndpoint: string
  
  constructor(registrationEndpoint: string) {
    this.registrationEndpoint = registrationEndpoint
  }
  
  // 创建客户端注册请求
  createRegistrationRequest(): ClientRegistrationRequest {
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://your-app-domain.com'
      : 'http://localhost:3000'
    
    return {
      client_name: 'ONES Demo Generator',
      client_uri: 'https://github.com/your-org/ones-demo-generator',
      grant_types: [
        'authorization_code',
        'refresh_token'
      ],
      response_types: ['code'],
      redirect_uris: [
        `${baseUrl}/oauth/callback`,
        `${baseUrl}/api/oauth/callback`
      ],
      token_endpoint_auth_method: 'none'
    }
  }
  
  // 注册客户端
  async registerClient(): Promise<ClientRegistrationResponse> {
    const registrationRequest = this.createRegistrationRequest()
    
    console.log('注册客户端请求:', {
      endpoint: this.registrationEndpoint,
      request: registrationRequest
    })
    
    const response = await fetch(this.registrationEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(registrationRequest)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`客户端注册失败: HTTP ${response.status} - ${errorText}`)
    }
    
    const responseData = await response.json()
    console.log('客户端注册响应:', responseData)
    
    // 验证响应数据
    const validatedResponse = ClientRegistrationResponseSchema.parse(responseData)
    
    return validatedResponse
  }
  
  // 获取或注册客户端
  async getOrRegisterClient(): Promise<StoredClientInfo> {
    // 尝试加载已存储的客户端信息
    const existingClient = await loadClientInfo()
    
    // 检查是否需要重新注册
    if (!shouldReregisterClient(existingClient)) {
      console.log('使用已存储的客户端信息:', existingClient!.client_id)
      return existingClient!
    }
    
    console.log('需要注册新客户端或重新注册')
    
    // 注册新客户端
    const registrationResponse = await this.registerClient()
    
    // 创建存储信息
    const storedClientInfo: StoredClientInfo = {
      ...registrationResponse,
      client_id_issued_at: registrationResponse.client_id_issued_at || Math.floor(Date.now() / 1000),
      registration_endpoint: this.registrationEndpoint,
      created_at: Date.now()
    }
    
    // 保存客户端信息
    await saveClientInfo(storedClientInfo)
    
    console.log('客户端注册成功并已保存:', storedClientInfo.client_id)
    
    return storedClientInfo
  }
}

// 获取客户端注册管理器实例
export function createClientRegistrationManager(registrationEndpoint: string): OAuthClientRegistration {
  return new OAuthClientRegistration(registrationEndpoint)
}
