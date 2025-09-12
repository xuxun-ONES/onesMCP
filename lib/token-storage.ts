import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { MCPClient } from './mcp'

// 配置存储接口
export interface MCPConfig {
  serverUrl: string
  token: string
  refreshToken?: string
  tokenExpiresAt?: number
  lastValidated?: number
  isValid?: boolean
}

// 应用设置接口
export interface AppSettings {
  openaiApiKey?: string
  anthropicApiKey?: string
  aiProvider?: 'openai' | 'anthropic'
  lastUpdated?: number
}

// 配置文件路径
const CONFIG_DIR = join(process.cwd(), '.config')
const TOKEN_FILE = join(CONFIG_DIR, 'mcp-config.json')
const SETTINGS_FILE = join(CONFIG_DIR, 'app-settings.json')

// 默认配置
const DEFAULT_CONFIG: MCPConfig = {
  serverUrl: process.env.ONES_MCP_SERVER_URL || 'https://demo.ones.pro/mcp',
  token: process.env.ONES_MCP_SERVER_TOKEN || '',
  lastValidated: 0,
  isValid: false
}

// 确保配置目录存在
async function ensureConfigDir(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true })
  } catch (error) {
    // 目录已存在，忽略错误
  }
}

// 保存 MCP 配置
export async function saveMCPConfig(config: Partial<MCPConfig>): Promise<void> {
  try {
    await ensureConfigDir()
    
    // 读取现有配置并合并
    const existingConfig = await loadMCPConfig()
    const newConfig: MCPConfig = {
      ...existingConfig,
      ...config,
      lastValidated: Date.now()
    }
    
    await fs.writeFile(TOKEN_FILE, JSON.stringify(newConfig, null, 2))
    console.log('MCP 配置已保存到文件')
  } catch (error) {
    console.error('保存 MCP 配置失败:', error)
    throw new Error('配置保存失败')
  }
}

// 加载 MCP 配置
export async function loadMCPConfig(): Promise<MCPConfig> {
  try {
    const data = await fs.readFile(TOKEN_FILE, 'utf-8')
    const config = JSON.parse(data) as MCPConfig
    
    // 合并默认配置，确保所有字段都存在
    return {
      ...DEFAULT_CONFIG,
      ...config
    }
  } catch (error) {
    console.log('配置文件不存在或读取失败，使用默认配置')
    return { ...DEFAULT_CONFIG }
  }
}

// 验证令牌有效性
export async function validateMCPToken(config: MCPConfig): Promise<boolean> {
  if (!config.token || !config.serverUrl) {
    return false
  }

  // 如果最近验证过且有效，跳过验证（5分钟内）
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
  if (config.lastValidated && config.lastValidated > fiveMinutesAgo && config.isValid) {
    return true
  }

  try {
    const client = new MCPClient(config.serverUrl, config.token)
    const result = await client.testConnection()
    
    // 更新验证状态
    await saveMCPConfig({
      ...config,
      isValid: result.success,
      lastValidated: Date.now()
    })
    
    return result.success
  } catch (error) {
    console.error('令牌验证失败:', error)
    
    // 更新验证状态
    await saveMCPConfig({
      ...config,
      isValid: false,
      lastValidated: Date.now()
    })
    
    return false
  }
}

// 获取有效的 MCP 配置
export async function getValidMCPConfig(): Promise<MCPConfig | null> {
  const config = await loadMCPConfig()
  
  if (!config.token || !config.serverUrl) {
    return null
  }
  
  const isValid = await validateMCPToken(config)
  return isValid ? config : null
}

// 清除配置
export async function clearMCPConfig(): Promise<void> {
  try {
    await fs.unlink(TOKEN_FILE)
    console.log('MCP 配置已清除')
  } catch (error) {
    // 文件不存在，忽略错误
  }
}

// 内存缓存（用于性能优化）
let memoryCache: MCPConfig | null = null
let cacheTimestamp = 0

// 获取配置（带内存缓存）
export async function getCachedMCPConfig(): Promise<MCPConfig> {
  const now = Date.now()
  
  // 缓存有效期 30 秒
  if (memoryCache && (now - cacheTimestamp) < 30 * 1000) {
    return memoryCache
  }
  
  const config = await loadMCPConfig()
  memoryCache = config
  cacheTimestamp = now
  
  return config
}

// 更新缓存
export function updateMemoryCache(config: MCPConfig): void {
  memoryCache = config
  cacheTimestamp = Date.now()
}

// 应用设置存储函数
export async function saveAppSettings(settings: Partial<AppSettings>): Promise<void> {
  try {
    await ensureConfigDir()
    
    // 读取现有设置并合并
    const existingSettings = await loadAppSettings()
    const newSettings: AppSettings = {
      ...existingSettings,
      ...settings,
      lastUpdated: Date.now()
    }
    
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(newSettings, null, 2))
    console.log('应用设置已保存到文件')
  } catch (error) {
    console.error('保存应用设置失败:', error)
    throw error
  }
}

export async function loadAppSettings(): Promise<AppSettings> {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8')
    return JSON.parse(data) as AppSettings
  } catch (error) {
    // 文件不存在或读取失败，返回默认设置
    return {}
  }
}
