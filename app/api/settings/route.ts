import { NextRequest, NextResponse } from 'next/server'
import { saveAppSettings, loadAppSettings } from '@/lib/token-storage'

// GET - 获取应用设置
export async function GET() {
  try {
    const settings = await loadAppSettings()
    
    return NextResponse.json({
      success: true,
      settings: {
        openaiApiKey: settings.openaiApiKey ? '••••••••••••••••' : '', // 隐藏实际的API Key
        anthropicApiKey: settings.anthropicApiKey ? '••••••••••••••••' : '',
        aiProvider: settings.aiProvider || 'anthropic', // 默认使用Anthropic
        hasOpenaiApiKey: !!settings.openaiApiKey,
        hasAnthropicApiKey: !!settings.anthropicApiKey,
        lastUpdated: settings.lastUpdated
      }
    })
  } catch (error) {
    console.error('获取应用设置失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取设置失败'
    }, { status: 500 })
  }
}

// PUT - 保存应用设置
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { openaiApiKey, anthropicApiKey, aiProvider } = body
    
    // 验证输入
    if (openaiApiKey !== undefined && typeof openaiApiKey !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'OpenAI API Key 必须是字符串'
      }, { status: 400 })
    }
    
    if (anthropicApiKey !== undefined && typeof anthropicApiKey !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Anthropic API Key 必须是字符串'
      }, { status: 400 })
    }
    
    if (aiProvider !== undefined && !['openai', 'anthropic'].includes(aiProvider)) {
      return NextResponse.json({
        success: false,
        error: 'AI Provider 必须是 openai 或 anthropic'
      }, { status: 400 })
    }
    
    // 构建更新对象
    const updates: Partial<AppSettings> = {}
    
    // 如果不是占位符，则更新
    if (openaiApiKey !== undefined && openaiApiKey !== '••••••••••••••••') {
      updates.openaiApiKey = openaiApiKey.trim() || undefined
    }
    
    if (anthropicApiKey !== undefined && anthropicApiKey !== '••••••••••••••••') {
      updates.anthropicApiKey = anthropicApiKey.trim() || undefined
    }
    
    if (aiProvider !== undefined) {
      updates.aiProvider = aiProvider
    }
    
    // 如果没有任何更新，返回成功
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        success: true,
        message: '设置未更改'
      })
    }
    
    // 保存设置
    await saveAppSettings(updates)
    
    return NextResponse.json({
      success: true,
      message: '设置已保存'
    })
  } catch (error) {
    console.error('保存应用设置失败:', error)
    return NextResponse.json({
      success: false,
      error: '保存设置失败'
    }, { status: 500 })
  }
}
