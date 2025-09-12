import { NextRequest, NextResponse } from 'next/server'
import { MCPClient } from '@/lib/mcp'
import { ToolResultSchema } from '@/lib/schema'
import { 
  loadMCPConfig, 
  saveMCPConfig, 
  validateMCPToken, 
  getCachedMCPConfig,
  updateMemoryCache 
} from '@/lib/token-storage'
import { getValidAccessToken } from '@/lib/token-refresh'

// 缓存 MCP 客户端实例
let mcpClientInstance: MCPClient | null = null

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tool, args } = body

    if (!tool || !args) {
      return NextResponse.json(
        { ok: false, error: '缺少必要参数: tool, args' },
        { status: 400 }
      )
    }

    // 获取有效的访问令牌，必要时自动刷新
    const mcpConfig = await getValidAccessToken()

    if (!mcpConfig.serverUrl) {
      return NextResponse.json(
        { ok: false, error: 'MCP 服务器 URL 未配置' },
        { status: 500 }
      )
    }

    if (!mcpConfig.token) {
      return NextResponse.json(
        { ok: false, error: 'MCP 访问令牌未配置' },
        { status: 401 }
      )
    }

    const mcpClient = new MCPClient(mcpConfig.serverUrl, mcpConfig.token)
    const result = await mcpClient.callTool(tool, args)

    // 验证返回结果
    const validatedResult = ToolResultSchema.parse(result)
    
    return NextResponse.json(validatedResult)
  } catch (error) {
    console.error('MCP 工具调用失败:', error)
    
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : '工具调用失败'
      },
      { status: 500 }
    )
  }
}

// 获取当前配置和可用工具
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'tools') {
    // 获取可用工具列表
    try {
      const mcpConfig = await getCachedMCPConfig()
      
      if (!mcpConfig.token || !mcpConfig.serverUrl) {
        return NextResponse.json({
          ok: false,
          error: 'MCP 配置不完整'
        }, { status: 400 })
      }

      if (!mcpClientInstance) {
        mcpClientInstance = new MCPClient(mcpConfig.serverUrl, mcpConfig.token)
        await mcpClientInstance.initialize()
      }

      const tools = mcpClientInstance.getAvailableTools()
      return NextResponse.json({
        ok: true,
        tools,
        serverInfo: {
          url: mcpConfig.serverUrl,
          toolCount: tools.length
        }
      })
    } catch (error) {
      return NextResponse.json({
        ok: false,
        error: error instanceof Error ? error.message : '获取工具列表失败'
      }, { status: 500 })
    }
  }

  // 默认返回配置信息
  try {
    const mcpConfig = await getCachedMCPConfig()
    const isValid = mcpConfig.token ? await validateMCPToken(mcpConfig) : false
    
    return NextResponse.json({
      serverUrl: mcpConfig.serverUrl,
      hasToken: !!mcpConfig.token,
      isValid: isValid,
      isConnected: !!mcpClientInstance,
      lastValidated: mcpConfig.lastValidated,
      availableTools: []
    })
  } catch (error) {
    return NextResponse.json({
      serverUrl: '',
      hasToken: false,
      isValid: false,
      isConnected: false,
      availableTools: [],
      error: error instanceof Error ? error.message : '获取配置失败'
    })
  }
}

// 更新配置
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { serverUrl, token } = body

    // 获取当前配置
    const currentConfig = await loadMCPConfig()
    
    // 准备更新的配置
    const updatedConfig = {
      ...currentConfig,
      ...(serverUrl && { serverUrl }),
      ...(token !== undefined && { token })
    }

    // 保存到文件
    await saveMCPConfig(updatedConfig)
    
    // 更新内存缓存
    updateMemoryCache(updatedConfig)

    // 重置客户端实例以使用新配置
    mcpClientInstance = null

    console.log('MCP 配置已更新:', {
      serverUrl: updatedConfig.serverUrl,
      hasToken: !!updatedConfig.token
    })

    return NextResponse.json({ 
      ok: true, 
      message: '配置已更新并保存',
      config: {
        serverUrl: updatedConfig.serverUrl,
        hasToken: !!updatedConfig.token
      }
    })
  } catch (error) {
    console.error('配置更新失败:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '配置更新失败' },
      { status: 500 }
    )
  }
}

// 测试连接
export async function PATCH() {
  try {
    // 获取有效的访问令牌，必要时自动刷新
    const mcpConfig = await getValidAccessToken()
    
    if (!mcpConfig.serverUrl) {
      return NextResponse.json(
        { success: false, message: 'MCP 服务器 URL 未配置' },
        { status: 400 }
      )
    }

    if (!mcpConfig.token) {
      return NextResponse.json(
        { success: false, message: 'MCP 访问令牌未配置' },
        { status: 400 }
      )
    }

    // 重置缓存的客户端实例，确保使用最新配置
    mcpClientInstance = null
    
    // 创建新的客户端实例进行测试
    const mcpClient = new MCPClient(mcpConfig.serverUrl, mcpConfig.token)
    const testResult = await mcpClient.testConnection()

    // 更新配置中的验证状态
    await saveMCPConfig({
      ...mcpConfig,
      isValid: testResult.success,
      lastValidated: Date.now()
    })

    // 如果测试成功，缓存客户端实例
    if (testResult.success) {
      mcpClientInstance = mcpClient
      
      // 更新内存缓存
      updateMemoryCache({
        ...mcpConfig,
        isValid: true,
        lastValidated: Date.now()
      })
    }

    return NextResponse.json({
      ...testResult,
      availableTools: testResult.success ? (mcpClientInstance?.getAvailableTools() || []) : [],
      config: {
        serverUrl: mcpConfig.serverUrl,
        hasToken: !!mcpConfig.token,
        lastValidated: Date.now()
      }
    })
  } catch (error) {
    console.error('连接测试失败:', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '连接测试失败',
      availableTools: []
    })
  }
}

