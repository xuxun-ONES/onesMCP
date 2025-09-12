import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { serverUrl } = await request.json()
    
    if (!serverUrl) {
      return NextResponse.json({
        success: false,
        error: '请提供 ONES 服务器地址'
      }, { status: 400 })
    }

    // 清理URL，确保格式正确
    const cleanUrl = serverUrl.replace(/\/+$/, '') // 移除尾部斜杠
    const testUrls = [
      `${cleanUrl}/.well-known/oauth-authorization-server/mcp`,
      `${cleanUrl}/mcp`,
      `${cleanUrl}/api/health`,
      `${cleanUrl}`
    ]

    const results = []
    
    for (const url of testUrls) {
      try {
        console.log(`测试连接: ${url}`)
        const startTime = Date.now()
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
          console.log(`请求超时: ${url}`)
          controller.abort()
        }, 30000) // 增加到30秒超时
        
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'ONES-MCP-Client/1.0',
            'Accept': 'application/json, text/html, */*',
            'Cache-Control': 'no-cache'
          }
        })
        
        clearTimeout(timeoutId)
        const duration = Date.now() - startTime
        
        console.log(`连接成功: ${url} (${duration}ms, status: ${response.status})`)
        
        results.push({
          url,
          status: response.status,
          statusText: response.statusText,
          success: response.ok,
          duration,
          headers: Object.fromEntries(response.headers.entries())
        })
        
        // 如果是OAuth元数据端点，尝试解析内容
        if (url.includes('oauth-authorization-server') && response.ok) {
          try {
            const metadata = await response.json()
            results[results.length - 1].metadata = metadata
          } catch (e) {
            results[results.length - 1].parseError = 'JSON解析失败'
          }
        }
        
      } catch (error) {
        const duration = Date.now() - (startTime || Date.now())
        console.error(`连接失败: ${url}`, error)
        
        results.push({
          url,
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
          errorType: error instanceof Error ? error.name : 'Error',
          duration,
          details: error instanceof Error ? {
            message: error.message,
            name: error.name,
            cause: error.cause
          } : null
        })
      }
    }

    // 分析结果
    const analysis = {
      serverReachable: results.some(r => r.success),
      oauthSupported: results.some(r => r.url.includes('oauth-authorization-server') && r.success),
      mcpEndpointAvailable: results.some(r => r.url.includes('/mcp') && r.success),
      recommendations: []
    }

    if (!analysis.serverReachable) {
      analysis.recommendations.push('服务器无法访问，请检查网络连接和服务器地址')
    }
    
    if (!analysis.oauthSupported) {
      analysis.recommendations.push('OAuth授权服务器不可用，请确认ONES系统是否支持MCP OAuth')
    }
    
    if (!analysis.mcpEndpointAvailable) {
      analysis.recommendations.push('MCP端点不可用，请确认ONES系统MCP功能是否已启用')
    }

    return NextResponse.json({
      success: true,
      serverUrl: cleanUrl,
      results,
      analysis
    })

  } catch (error) {
    console.error('连接测试错误:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '连接测试失败'
    }, { status: 500 })
  }
}
