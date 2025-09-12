import { NextRequest, NextResponse } from 'next/server'
import { OpenAIClient } from '@/lib/openai'
import { AnthropicClient } from '@/lib/anthropic'
import { MCPClient, retryToolCall } from '@/lib/mcp'
import { WizardFormSchema, SeedPlan } from '@/lib/schema'
import { generateId } from '@/lib/utils'
import { streamManager } from '@/lib/stream-manager'
import { getValidMCPConfig, loadAppSettings } from '@/lib/token-storage'
import { DemoPlanGuide } from '@/lib/demo-plan-guide'

// 配置API路由超时时间为5分钟
export const maxDuration = 300

// 获取配置
async function getConfig() {
  try {
    // 从持久化存储获取配置
    const mcpConfig = await getValidMCPConfig()
    const appSettings = await loadAppSettings()
    
    return {
      openaiApiKey: appSettings.openaiApiKey || process.env.OPENAI_API_KEY || '',
      anthropicApiKey: appSettings.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '',
      aiProvider: appSettings.aiProvider || 'anthropic',
      mcpServerUrl: mcpConfig?.serverUrl || process.env.ONES_MCP_SERVER_URL || '',
      mcpToken: mcpConfig?.token || process.env.ONES_MCP_SERVER_TOKEN || '',
      mcpConfigValid: !!mcpConfig
    }
  } catch (error) {
    console.error('获取配置失败:', error)
    return {
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
      aiProvider: 'anthropic',
      mcpServerUrl: process.env.ONES_MCP_SERVER_URL || '',
      mcpToken: process.env.ONES_MCP_SERVER_TOKEN || '',
      mcpConfigValid: false
    }
  }
}

// 简化的广播日志器
class BroadcastLogger {
  async info(step: string, data?: any) {
    streamManager.broadcast({
      level: 'info',
      step,
      data,
      timestamp: new Date().toISOString()
    })
  }

  async warn(step: string, data?: any) {
    streamManager.broadcast({
      level: 'warn',
      step,
      data,
      timestamp: new Date().toISOString()
    })
  }

  async error(step: string, data?: any) {
    streamManager.broadcast({
      level: 'error',
      step,
      data,
      timestamp: new Date().toISOString()
    })
  }

  async step(step: string, tool?: string, data?: any, elapsedMs?: number) {
    streamManager.broadcast({
      level: 'step',
      step,
      tool,
      data,
      elapsedMs,
      timestamp: new Date().toISOString()
    })
  }
}

export async function POST(request: NextRequest) {
  const logger = new BroadcastLogger()

  try {
    const body = await request.json()
    const formData = WizardFormSchema.parse(body)

    // 等待SSE连接建立（最多等待2秒）
    let waitTime = 0
    const maxWaitTime = 2000
    const checkInterval = 100
    
    while (streamManager.getStreamCount() === 0 && waitTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval))
      waitTime += checkInterval
    }
    
    if (streamManager.getStreamCount() === 0) {
      console.warn('未检测到活跃的SSE连接，但继续执行生成过程')
    } else {
      console.log(`检测到 ${streamManager.getStreamCount()} 个活跃的SSE连接`)
    }

    await logger.info('开始生成演示数据', { formData })

    // 获取最新配置
    const apiConfig = await getConfig()
    await logger.info('配置获取完成', { 
      hasOpenaiKey: !!apiConfig.openaiApiKey,
      hasAnthropicKey: !!apiConfig.anthropicApiKey,
      aiProvider: apiConfig.aiProvider,
      hasMcpUrl: !!apiConfig.mcpServerUrl,
      hasMcpToken: !!apiConfig.mcpToken,
      mcpConfigValid: apiConfig.mcpConfigValid
    })

    // 智能选择AI Provider：优先使用Anthropic，如果不可用则使用OpenAI
    let selectedProvider = apiConfig.aiProvider
    let selectedApiKey = ''
    
    // 检查Anthropic是否可用
    if (apiConfig.anthropicApiKey) {
      selectedProvider = 'anthropic'
      selectedApiKey = apiConfig.anthropicApiKey
      await logger.info('选择AI服务', { provider: 'Anthropic', reason: 'Anthropic API Key可用，优先使用' })
    }
    // 如果Anthropic不可用，检查OpenAI
    else if (apiConfig.openaiApiKey) {
      selectedProvider = 'openai'
      selectedApiKey = apiConfig.openaiApiKey
      await logger.info('选择AI服务', { provider: 'OpenAI', reason: 'Anthropic不可用，回退到OpenAI' })
    }
    // 如果都不可用
    else {
      await logger.error('AI API Key 未配置', {
        message: '请在设置页面配置 Anthropic 或 OpenAI API Key'
      })
      return NextResponse.json({ 
        success: false, 
        error: '未配置有效的AI API Key。请在设置页面配置 Anthropic 或 OpenAI API Key。' 
      }, { status: 400 })
    }

    if (!apiConfig.mcpServerUrl) {
      await logger.error('MCP 服务器 URL 未配置')
      return NextResponse.json({ 
        success: false, 
        error: 'MCP 服务器 URL 未配置' 
      }, { status: 400 })
    }

    if (!apiConfig.mcpToken) {
      await logger.error('MCP 访问令牌未配置')
      return NextResponse.json({ 
        success: false, 
        error: 'MCP 访问令牌未配置' 
      }, { status: 400 })
    }

    if (!apiConfig.mcpConfigValid) {
      await logger.error('MCP 配置无效或令牌已过期')
      return NextResponse.json({ 
        success: false, 
        error: 'MCP 配置无效或令牌已过期，请重新授权' 
      }, { status: 401 })
    }

    // 初始化客户端
    const aiClient = selectedProvider === 'openai' 
      ? new OpenAIClient(selectedApiKey)
      : new AnthropicClient(selectedApiKey)
    const mcpClient = new MCPClient(apiConfig.mcpServerUrl, apiConfig.mcpToken)
    
    // 初始化 MCP 连接并获取可用工具
    await logger.step('正在连接 MCP 服务器并获取工具列表...')
    await mcpClient.initialize()
    const availableTools = mcpClient.getAvailableTools()
    await logger.info('MCP 服务器连接成功', { 
      toolCount: availableTools.length,
      tools: availableTools.map(t => t.name)
    })

    // 第一步：生成种子计划
    await logger.step('正在生成演示数据计划...')
    const startTime = Date.now()
    
    let seedPlan: SeedPlan
    try {
      seedPlan = await aiClient.generateSeedPlan(formData)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      
      // 检查是否为超时错误
      if (errorMessage.includes('timeout') || errorMessage.includes('504') || errorMessage.includes('Request timeout')) {
        await logger.error('AI服务请求超时', { 
          provider: selectedProvider, 
          error: errorMessage,
          suggestion: '请尝试简化需求或稍后重试'
        })
        return NextResponse.json({ 
          success: false, 
          error: 'AI服务响应超时，请尝试简化演示需求或稍后重试。如果问题持续存在，请检查网络连接。' 
        }, { status: 504 })
      }
      
      // 其他错误
      await logger.error('AI生成计划失败', { provider: selectedProvider, error: errorMessage })
      throw error
    }
    
    const elapsedMs = Date.now() - startTime
    const providerName = selectedProvider === 'openai' ? 'openai' : 'anthropic'
    await logger.step('生成计划完成', `${providerName}.generateSeedPlan`, undefined, elapsedMs)

    await logger.info('计划生成成功', { 
      projectName: seedPlan.project.name,
      issueCount: seedPlan.issues.length,
      commentCount: seedPlan.comments.length,
      worklogCount: seedPlan.worklogs.length,
      wikiPageCount: seedPlan.wikiPages.length
    })

    // 第二步：使用异步分步生成替代批量生成
    await executeAsyncCreationPlan(formData, mcpClient, aiClient, logger)

    await logger.info('演示数据生成完成')
    
    return NextResponse.json({ 
      success: true, 
      message: '演示数据生成完成' 
    })

  } catch (error) {
    let errorMessage = '未知错误'
    let statusCode = 500
    
    if (error instanceof Error) {
      errorMessage = error.message
      
      // 处理特定的AI服务错误
      if (error.message.includes('insufficient_quota') || error.message.includes('exceeded your current quota')) {
        errorMessage = 'AI API 配额不足。请检查您的账户余额和使用限制。'
        statusCode = 402 // Payment Required
      } else if (error.message.includes('Incorrect API key') || error.message.includes('invalid_api_key')) {
        errorMessage = 'AI API Key 无效。请在设置页面检查并更新您的 API Key。'
        statusCode = 401
      } else if (error.message.includes('Rate limit') || error.message.includes('rate_limit')) {
        errorMessage = 'AI API 请求频率过高。请稍后重试。'
        statusCode = 429
      } else if (error.message.includes('model_not_found')) {
        errorMessage = '所选模型不可用。请稍后重试或联系管理员。'
        statusCode = 400
      } else if (error.message.includes('permission_denied')) {
        errorMessage = 'API Key 权限不足。请检查您的账户权限设置。'
        statusCode = 403
      }
    }
    
    await logger.error('生成过程失败', {
      error: errorMessage,
      originalError: error instanceof Error ? error.message : '未知错误'
    })
    
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: statusCode })
  }
}

async function executeCreationPlan(
  seedPlan: SeedPlan,
  mcpClient: MCPClient,
  logger: any
) {
  const createdItems: Record<string, string> = {} // title -> id 映射

  try {
    // 1. 创建项目
    await logger.step('正在创建项目...', 'create_project')
    const projectStartTime = Date.now()
    const projectResult = await retryToolCall(() => mcpClient.executeTask('create_project', {
      name: seedPlan.project.name,
      template: 'project-t1' // 使用敏捷项目管理模板
    }))
    const projectElapsedMs = Date.now() - projectStartTime
    await logger.step('项目创建完成', 'create_project', undefined, projectElapsedMs)

    if (!projectResult.ok) {
      throw new Error(`项目创建失败: ${projectResult.error}`)
    }

    // 处理不同的返回格式
    let projectId = projectResult.result?.id || projectResult.result?.projectId || projectResult.result?.uuid
    
    if (!projectId && projectResult.result?.raw) {
      // 如果在raw字段中
      projectId = projectResult.result.raw.id || projectResult.result.raw.projectId || projectResult.result.raw.uuid
    }
    
    if (!projectId) {
      console.log('项目创建返回数据:', JSON.stringify(projectResult.result, null, 2))
      throw new Error(`项目创建失败: 无法获取项目ID`)
    }

    await logger.info('项目创建成功', { projectId, name: seedPlan.project.name })

    // 2. 获取工作项类型
    await logger.step('正在获取工作项类型...', 'get_types')
    const typesStartTime = Date.now()
    const issueTypesResult = await retryToolCall(() => mcpClient.executeTask('get_types', { project_id: projectId }))
    const typesElapsedMs = Date.now() - typesStartTime
    await logger.step('工作项类型获取完成', 'get_types', undefined, typesElapsedMs)

    if (!issueTypesResult.ok) {
      throw new Error(`获取工作项类型失败: ${issueTypesResult.error}`)
    }

    // 处理工作项类型数据
    let issueTypes = []
    if (issueTypesResult.result?.raw) {
      // 如果raw是数组，直接使用
      if (Array.isArray(issueTypesResult.result.raw)) {
        issueTypes = issueTypesResult.result.raw
      }
      // 如果raw是对象且包含data数组，使用data
      else if (issueTypesResult.result.raw.data && Array.isArray(issueTypesResult.result.raw.data)) {
        issueTypes = issueTypesResult.result.raw.data
      }
      // 如果raw是对象且包含issueTypes数组，使用issueTypes
      else if (issueTypesResult.result.raw.issueTypes && Array.isArray(issueTypesResult.result.raw.issueTypes)) {
        issueTypes = issueTypesResult.result.raw.issueTypes
      }
      // 其他情况，尝试将对象转换为数组
      else if (typeof issueTypesResult.result.raw === 'object') {
        issueTypes = Object.values(issueTypesResult.result.raw).filter(item => 
          item && typeof item === 'object' && (item.id || item.uuid || item.name)
        )
      }
    }
    
    await logger.info('工作项类型数据处理完成', { 
      rawType: typeof issueTypesResult.result?.raw,
      isArray: Array.isArray(issueTypesResult.result?.raw),
      processedCount: issueTypes.length,
      sampleType: issueTypes[0] ? Object.keys(issueTypes[0]) : [],
      rawData: JSON.stringify(issueTypesResult.result?.raw).substring(0, 500) // 前500字符用于调试
    })
    
    const typeMapping = createTypeMapping(issueTypes)

    // 2.5. 获取工作项字段信息（用于创建工作项）
    await logger.step('正在获取工作项字段...', 'get_fields')
    const fieldsStartTime = Date.now()
    const fieldsResult = await retryToolCall(() => mcpClient.executeTask('get_fields', {}))
    const fieldsElapsedMs = Date.now() - fieldsStartTime
    await logger.step('工作项字段获取完成', 'get_fields', undefined, fieldsElapsedMs)
    
    // 处理字段数据，找到描述字段
    let descriptionFieldId = null
    if (fieldsResult.ok && fieldsResult.result?.raw) {
      const fields = Array.isArray(fieldsResult.result.raw) ? fieldsResult.result.raw : 
                    fieldsResult.result.raw.data ? fieldsResult.result.raw.data : []
      
      // 寻找描述字段
      const descField = fields.find((field: any) => 
        field.name?.includes('描述') || field.name?.includes('Description') || 
        field.fieldType === 'text' || field.type === 'text'
      )
      
      if (descField) {
        descriptionFieldId = descField.id || descField.fieldId || descField.uuid
      }
      
      await logger.info('字段信息获取完成', { 
        fieldsCount: fields.length,
        hasDescriptionField: !!descriptionFieldId,
        descriptionFieldId
      })
    }

    // 3. 创建工作项
    for (const issue of seedPlan.issues) {
      const typeId = typeMapping[issue.type]
      if (!typeId) {
        await logger.warn(`跳过工作项 "${issue.title}"：找不到类型 "${issue.type}"`)
        continue
      }

      await logger.step(`正在创建工作项: ${issue.title}`, 'create_issue')
      const issueStartTime = Date.now()
      
      // 构建工作项创建参数和上下文
      const issueParams = {
        title: issue.title,
        description: issue.description,
        assignees: issue.assignees,
        project_id: projectId,
        type_id: typeId
      }
      
      const issueContext = {
        projectId: projectId,
        issueTypeId: typeId,
        descriptionFieldId: descriptionFieldId,
        availableFields: fieldsResult.ok ? (
          Array.isArray(fieldsResult.result?.raw) ? fieldsResult.result.raw : 
          fieldsResult.result?.raw?.data || []
        ) : []
      }
      
      const issueResult = await retryToolCall(() => mcpClient.executeTask('create_issue', issueParams, issueContext))
      const issueElapsedMs = Date.now() - issueStartTime
      await logger.step(`工作项创建完成: ${issue.title}`, 'create_issue', undefined, issueElapsedMs)

      if (issueResult.ok) {
        // 处理不同的返回格式
        let issueId = issueResult.result?.id || issueResult.result?.issueId || issueResult.result?.uuid
        
        if (!issueId && issueResult.result?.raw) {
          issueId = issueResult.result.raw.id || issueResult.result.raw.issueId || issueResult.result.raw.uuid
        }
        
        if (issueId) {
          createdItems[issue.title] = issueId
        } else {
          await logger.warn(`工作项 "${issue.title}" 创建成功但无法获取ID`)
        }
        
        // 创建子工作项
        if (issue.children) {
          for (const child of issue.children) {
            const childTypeId = typeMapping[child.type]
            if (!childTypeId) continue

            await logger.step(`正在创建子工作项: ${child.title}`, 'create_issue')
            const childStartTime = Date.now()
            const childResult = await retryToolCall(() => mcpClient.executeTask('create_issue', {
              parent_issue_id: issueId,
              type_id: childTypeId,
              title: child.title,
              description: child.description
            }))
            const childElapsedMs = Date.now() - childStartTime
            await logger.step(`子工作项创建完成: ${child.title}`, 'create_issue', undefined, childElapsedMs)

            if (childResult.ok && childResult.result?.id) {
              createdItems[child.title] = childResult.result.id
            }
          }
        }
      } else {
        await logger.warn(`工作项创建失败: ${issue.title}`, { error: issueResult.error })
      }
    }

    // 4. 添加评论
    for (const comment of seedPlan.comments) {
      const issueId = createdItems[comment.issueTitle]
      if (!issueId) {
        await logger.warn(`跳过评论：找不到工作项 "${comment.issueTitle}"`)
        continue
      }

      await logger.step(`正在添加评论到: ${comment.issueTitle}`, 'add_comment')
      const commentStartTime = Date.now()
      await retryToolCall(() => mcpClient.executeTask('add_comment', {
        issue_id: issueId,
        body: comment.body
      }))
      const commentElapsedMs = Date.now() - commentStartTime
      await logger.step(`评论添加完成: ${comment.issueTitle}`, 'add_comment', undefined, commentElapsedMs)
    }

    // 5. 添加工时
    for (const worklog of seedPlan.worklogs) {
      const issueId = createdItems[worklog.issueTitle]
      if (!issueId) {
        await logger.warn(`跳过工时：找不到工作项 "${worklog.issueTitle}"`)
        continue
      }

      await logger.step(`正在添加工时到: ${worklog.issueTitle}`, 'log_work')
      const worklogStartTime = Date.now()
      await retryToolCall(() => mcpClient.executeTask('log_work', {
        issue_id: issueId,
        hours: worklog.hours,
        comment: worklog.comment
      }))
      const worklogElapsedMs = Date.now() - worklogStartTime
      await logger.step(`工时添加完成: ${worklog.issueTitle}`, 'log_work', undefined, worklogElapsedMs)
    }

    // 6. 创建 Wiki 页面
    let wikiSpaceId = null
    let homePageId = null
    
    if (seedPlan.wikiPages && seedPlan.wikiPages.length > 0) {
      // 6.1. 获取Wiki空间列表
      await logger.step('正在获取Wiki空间列表...', 'get_wiki_spaces')
      const spacesResult = await retryToolCall(() => mcpClient.executeTask('get_wiki_spaces', {}))
      
      if (spacesResult.ok && spacesResult.result?.raw) {
        const spaces = Array.isArray(spacesResult.result.raw) ? spacesResult.result.raw : 
                      spacesResult.result.raw.data || []
        
        // 选择第一个可用的空间
        if (spaces.length > 0) {
          wikiSpaceId = spaces[0].id || spaces[0].uuid || spaces[0].spaceId
          
          // 6.2. 获取空间详情以获取homePageID
          if (wikiSpaceId) {
            await logger.step('正在获取Wiki空间详情...', 'get_wiki_space_details')
            const spaceDetailsResult = await retryToolCall(() => mcpClient.executeTask('get_wiki_space_details', {
              spaceId: wikiSpaceId
            }))
            
            if (spaceDetailsResult.ok && spaceDetailsResult.result?.raw) {
              homePageId = spaceDetailsResult.result.raw.homePageID || 
                          spaceDetailsResult.result.raw.homePageId ||
                          spaceDetailsResult.result.raw.home_page_id
            }
          }
        }
      }
    }
    
    for (const wikiPage of seedPlan.wikiPages) {
      await logger.step(`正在创建 Wiki 页面: ${wikiPage.title}`, 'create_wiki')
      const wikiStartTime = Date.now()
      
      const wikiContext = {
        parentPageId: homePageId,
        homePageId: homePageId,
        spaceId: wikiSpaceId
      }
      
      await retryToolCall(() => mcpClient.executeTask('create_wiki', {
        title: wikiPage.title,
        content: wikiPage.content,
        description: wikiPage.description
      }, wikiContext))
      const wikiElapsedMs = Date.now() - wikiStartTime
      await logger.step(`Wiki 页面创建完成: ${wikiPage.title}`, 'create_wiki', undefined, wikiElapsedMs)
    }

  } catch (error) {
    await logger.error('执行创建计划失败', {
      error: error instanceof Error ? error.message : '未知错误'
    })
    throw error
  }
}

function createTypeMapping(issueTypes: any[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  
  if (!Array.isArray(issueTypes)) {
    console.warn('createTypeMapping: issueTypes is not an array:', typeof issueTypes)
    return mapping
  }
  
  console.log('createTypeMapping: Processing', issueTypes.length, 'issue types')
  
  for (const type of issueTypes) {
    if (!type || typeof type !== 'object') {
      console.warn('createTypeMapping: Invalid type object:', type)
      continue
    }
    
    // 尝试多种可能的字段名
    const name = type.name || type.displayName || type.title || type.typeName || type.label || ''
    const id = type.id || type.uuid || type.issueTypeId || type.typeId || type.key || ''
    
    console.log('createTypeMapping: Processing type:', { name, id, originalType: type })
    
    if (!id) {
      console.warn('createTypeMapping: type missing id:', type)
      continue
    }
    
    // 更宽泛的映射逻辑，支持更多变体
    const lowerName = name.toLowerCase()
    
    // 需求相关
    if (lowerName.includes('需求') || lowerName.includes('requirement') || 
        lowerName.includes('story') || lowerName.includes('feature') ||
        lowerName.includes('用户故事') || lowerName.includes('user story')) {
      mapping['需求'] = id
      console.log('createTypeMapping: Mapped 需求 to', id)
    } 
    // 缺陷相关
    else if (lowerName.includes('缺陷') || lowerName.includes('bug') || 
             lowerName.includes('defect') || lowerName.includes('问题') ||
             lowerName.includes('错误') || lowerName.includes('issue')) {
      mapping['缺陷'] = id
      console.log('createTypeMapping: Mapped 缺陷 to', id)
    } 
    // 任务相关
    else if (lowerName.includes('任务') || lowerName.includes('task') || 
             lowerName.includes('工作项') || lowerName.includes('work item') ||
             lowerName.includes('todo') || lowerName.includes('待办')) {
      mapping['任务'] = id
      console.log('createTypeMapping: Mapped 任务 to', id)
    }
    // 如果没有匹配到，但有名称，也记录下来用于调试
    else if (name) {
      console.log('createTypeMapping: Unmatched type:', { name, id })
    }
  }
  
  console.log('Type mapping created:', mapping)
  return mapping
}

/**
 * 异步分步创建演示数据
 * 先生成一个工作项，然后创建，再生成下一个
 */
async function executeAsyncCreationPlan(
  formData: any,
  mcpClient: MCPClient,
  aiClient: any,
  logger: any
) {
  // 创建整体指导实例
  const planGuide = new DemoPlanGuide(formData)
  
  try {
    // 第1步：创建项目
    await logger.step('正在创建项目...', 'create_project')
    const projectInfo = planGuide.getProjectInfo()
    
    const projectResult = await retryToolCall(() => mcpClient.executeTask('create_project', {
      name: projectInfo.name,
      template: 'project-t1'
    }))
    
    if (!projectResult.ok) {
      throw new Error(`项目创建失败: ${projectResult.error}`)
    }

    // 获取项目ID
    let projectId = projectResult.result?.id || projectResult.result?.projectId || projectResult.result?.uuid
    if (!projectId && projectResult.result?.raw) {
      projectId = projectResult.result.raw.id || projectResult.result.raw.projectId || projectResult.result.raw.uuid
    }
    if (!projectId) {
      throw new Error(`项目创建失败: 无法获取项目ID`)
    }

    await logger.step('项目创建完成', 'create_project')
    planGuide.recordCreatedItem(projectInfo.name, projectId, 'project')

    // 第2步：获取项目上下文信息
    await logger.step('正在获取项目上下文...', 'get_context')
    
    // 获取工作项类型
    const issueTypesResult = await retryToolCall(() => mcpClient.executeTask('get_types', { project_id: projectId }))
    if (!issueTypesResult.ok) {
      throw new Error(`获取工作项类型失败: ${issueTypesResult.error}`)
    }
    
    // 处理工作项类型数据
    let issueTypes = []
    if (issueTypesResult.result?.raw) {
      if (Array.isArray(issueTypesResult.result.raw)) {
        issueTypes = issueTypesResult.result.raw
      } else if (issueTypesResult.result.raw.data && Array.isArray(issueTypesResult.result.raw.data)) {
        issueTypes = issueTypesResult.result.raw.data
      } else if (issueTypesResult.result.raw.issueTypes && Array.isArray(issueTypesResult.result.raw.issueTypes)) {
        issueTypes = issueTypesResult.result.raw.issueTypes
      } else if (typeof issueTypesResult.result.raw === 'object') {
        issueTypes = Object.values(issueTypesResult.result.raw).filter(item => 
          item && typeof item === 'object' && (item.id || item.uuid || item.name)
        )
      }
    }
    
    const typeMapping = createTypeMapping(issueTypes)

    // 获取工作项字段
    const fieldsResult = await retryToolCall(() => mcpClient.executeTask('get_fields', {}))
    let descriptionFieldId = null
    let availableFields = []
    
    if (fieldsResult.ok && fieldsResult.result?.raw) {
      availableFields = Array.isArray(fieldsResult.result.raw) ? fieldsResult.result.raw : 
                       fieldsResult.result.raw.data ? fieldsResult.result.raw.data : []
      
      const descField = availableFields.find((field: any) => 
        field.name?.includes('描述') || field.name?.includes('Description') || 
        field.fieldType === 'text' || field.type === 'text'
      )
      
      if (descField) {
        descriptionFieldId = descField.id || descField.uuid || descField.fieldId
      }
    }

    // 设置项目上下文
    planGuide.setProjectContext({
      projectId,
      typeMapping,
      descriptionFieldId,
      availableFields
    })

    await logger.step('项目上下文获取完成', 'get_context')

    // 第3步：异步生成和创建工作项
    const targetWorkItems = 8
    for (let i = 0; i < targetWorkItems; i++) {
      await logger.step(`正在生成第${i + 1}个工作项...`, 'generate_work_item')
      
      try {
        // 生成单个工作项
        const workItemDetails = await planGuide.generateWorkItemDetails(i, aiClient)
        await logger.step(`第${i + 1}个工作项生成完成`, 'generate_work_item')

        // 立即创建这个工作项
        await logger.step(`正在创建工作项: ${workItemDetails.title}`, 'create_work_item')
        
        const context = planGuide.getProjectContext()
        const issueTypeId = context.typeMapping?.[workItemDetails.type]
        
        if (!issueTypeId) {
          await logger.warn(`跳过工作项 "${workItemDetails.title}": 未找到类型 "${workItemDetails.type}" 的映射`)
          continue
        }

        // 构建fieldValues
        const fieldValues = []
        if (workItemDetails.description && context.descriptionFieldId) {
          fieldValues.push({
            fieldID: context.descriptionFieldId,
            type: 1,
            value: workItemDetails.description
          })
        } else if (context.availableFields && context.availableFields.length > 0) {
          const textField = context.availableFields.find((field: any) => field.type === 1 || field.fieldType === 'text')
          if (textField) {
            fieldValues.push({
              fieldID: textField.id || textField.fieldId || textField.uuid,
              type: 1,
              value: workItemDetails.description || '自动生成的演示工作项'
            })
          }
        }

        // 创建主工作项
        const createResult = await retryToolCall(() => mcpClient.executeTask('create_issue', {
          title: workItemDetails.title,
          projectID: projectId,
          issueTypeID: issueTypeId,
          assignee: workItemDetails.assignees?.[0] || '',
          fieldValues: fieldValues,
          watchers: [],
          parentID: null
        }, context))

        if (createResult.ok) {
          const issueId = createResult.result?.id || createResult.result?.issueId || createResult.result?.uuid
          if (issueId) {
            planGuide.recordCreatedItem(workItemDetails.title, issueId, 'issue')
            await logger.step(`工作项创建完成: ${workItemDetails.title}`, 'create_work_item')

            // 创建子工作项
            if (workItemDetails.children && workItemDetails.children.length > 0) {
              for (const child of workItemDetails.children) {
                const childTypeId = context.typeMapping?.[child.type] || context.typeMapping?.['任务']
                if (childTypeId) {
                  const childFieldValues = []
                  if (child.description && context.descriptionFieldId) {
                    childFieldValues.push({
                      fieldID: context.descriptionFieldId,
                      type: 1,
                      value: child.description
                    })
                  }

                  const childResult = await retryToolCall(() => mcpClient.executeTask('create_issue', {
                    title: child.title,
                    projectID: projectId,
                    issueTypeID: childTypeId,
                    assignee: workItemDetails.assignees?.[0] || '',
                    fieldValues: childFieldValues,
                    watchers: [],
                    parentID: issueId
                  }, context))

                  if (childResult.ok) {
                    const childId = childResult.result?.id || childResult.result?.issueId || childResult.result?.uuid
                    if (childId) {
                      planGuide.recordCreatedItem(child.title, childId, 'child_issue')
                    }
                  }
                }
              }
            }

            // 创建评论
            const comments = planGuide.generateWorkItemComments(workItemDetails.title)
            for (const comment of comments) {
              await retryToolCall(() => mcpClient.executeTask('add_comment', {
                issue_id: issueId,
                text: comment.body
              }, context))
            }

            // 创建工时记录
            const worklogs = planGuide.generateWorkItemWorklogs(workItemDetails.title)
            for (const worklog of worklogs) {
              await retryToolCall(() => mcpClient.executeTask('log_work', {
                issue_id: issueId,
                hours: worklog.hours,
                description: worklog.comment,
                start_time: new Date().toISOString()
              }, context))
            }
          }
        } else {
          await logger.warn(`工作项创建失败: ${workItemDetails.title} - ${createResult.error}`)
        }

        // 显示进度
        const progress = planGuide.getProgress()
        await logger.info(`进度更新`, { 
          completed: progress.completed, 
          total: progress.total, 
          percentage: progress.percentage 
        })

        // 短暂延迟，避免请求过于频繁
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        await logger.error(`第${i + 1}个工作项生成失败`, { error: error instanceof Error ? error.message : '未知错误' })
        // 继续处理下一个工作项，不中断整个流程
        continue
      }
    }

    // 第4步：创建Wiki页面
    await logger.step('正在创建Wiki页面...', 'create_wiki')
    
    try {
      // 获取Wiki空间
      const wikiSpacesResult = await retryToolCall(() => mcpClient.executeTask('get_wiki_spaces', {}))
      if (wikiSpacesResult.ok && wikiSpacesResult.result?.raw) {
        const spaces = Array.isArray(wikiSpacesResult.result.raw) ? wikiSpacesResult.result.raw : 
                      wikiSpacesResult.result.raw.data ? wikiSpacesResult.result.raw.data : []
        
        if (spaces.length > 0) {
          const firstSpace = spaces[0]
          const spaceId = firstSpace.id || firstSpace.uuid
          
          if (spaceId) {
            // 获取空间详情
            const spaceDetailsResult = await retryToolCall(() => mcpClient.executeTask('get_wiki_space_details', { spaceId }))
            if (spaceDetailsResult.ok) {
              const homePageId = spaceDetailsResult.result?.homePageID || spaceDetailsResult.result?.raw?.homePageID
              
              if (homePageId) {
                // 创建Wiki页面
                const wikiPages = planGuide.getWikiPages()
                for (const page of wikiPages) {
                  const wikiResult = await retryToolCall(() => mcpClient.executeTask('create_wiki', {
                    parentPageID: homePageId,
                    title: page.title,
                    content: page.content
                  }))
                  
                  if (wikiResult.ok) {
                    const pageId = wikiResult.result?.id || wikiResult.result?.pageId || wikiResult.result?.uuid
                    if (pageId) {
                      planGuide.recordCreatedItem(page.title, pageId, 'wiki_page')
                    }
                  }
                  
                  // 短暂延迟
                  await new Promise(resolve => setTimeout(resolve, 500))
                }
              }
            }
          }
        }
      }
      
      await logger.step('Wiki页面创建完成', 'create_wiki')
    } catch (error) {
      await logger.warn('Wiki页面创建失败', { error: error instanceof Error ? error.message : '未知错误' })
    }

    // 最终进度报告
    const finalProgress = planGuide.getProgress()
    await logger.info('异步创建完成', {
      totalCreated: finalProgress.completed,
      targetTotal: finalProgress.total,
      successRate: `${finalProgress.percentage}%`,
      createdItems: Array.from(planGuide.getCreatedItems().keys())
    })

  } catch (error) {
    await logger.error('异步创建过程失败', { error: error instanceof Error ? error.message : '未知错误' })
    throw error
  }
}

