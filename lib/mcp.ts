import { ToolResult, ToolResultSchema } from './schema'

// MCP 工具定义接口
export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<string, any>
    required?: string[]
  }
}

// MCP 服务器能力信息
export interface MCPServerInfo {
  name: string
  version: string
  tools: MCPTool[]
}

export class MCPClient {
  private baseUrl: string
  private token?: string
  private serverInfo: MCPServerInfo | null = null
  private availableTools: MCPTool[] = []

  constructor(baseUrl: string, token?: string) {
    // 确保URL不以斜杠结尾，避免重定向导致Authorization头丢失
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.token = token
  }

  // 初始化连接并获取服务器信息
  async initialize(): Promise<void> {
    try {
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10秒超时
      
      const response = await fetch(`${this.baseUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'User-Agent': 'ONES-Demo-Generator/1.0.0',
          'mcp-protocol-version': '2025-06-18',
          ...(this.token && { 'Authorization': `Bearer ${this.token}` })
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {
              tools: {}
            },
            clientInfo: {
              name: 'ones-demo-generator',
              version: '1.0.0'
            }
          }
        }),
        signal: controller.signal,
        redirect: 'follow'
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`初始化失败: HTTP ${response.status}`)
      }

      // ONES MCP 使用 Server-Sent Events 格式
      const responseText = await response.text()
      // 解析 SSE 格式的响应
      const lines = responseText.split('\n')
      let jsonData = ''
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          jsonData = line.substring(6) // 移除 "data: " 前缀
          break
        }
      }
      
      if (!jsonData) {
        throw new Error('无效的 SSE 响应格式')
      }
      const data = JSON.parse(jsonData)
      
      if (data.error) {
        throw new Error(`MCP 错误: ${data.error.message}`)
      }
      
      // 适配 ONES MCP 的响应结构
      this.serverInfo = {
        name: data.result?.serverInfo?.name || 'ONES MCP Server',
        version: data.result?.serverInfo?.version || '1.0.0',
        tools: []
      }
      
      // 初始化后立即获取工具列表
      await this.loadTools()
      
      console.log(`MCP 服务器已连接: ${this.serverInfo?.name} v${this.serverInfo?.version}`)
      console.log(`可用工具数量: ${this.availableTools.length}`)
    } catch (error) {
      console.error('MCP 服务器初始化失败:', error)
      
      // 提供更具体的错误信息
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('连接超时: MCP 服务器响应时间过长，请检查网络连接或稍后重试')
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
          throw new Error('DNS 解析失败: 无法解析服务器地址，请检查网络连接和服务器地址')
        } else if (error.message.includes('ECONNREFUSED')) {
          throw new Error('连接被拒绝: 服务器拒绝连接，请检查服务器是否正常运行')
        } else if (error.message.includes('fetch failed')) {
          throw new Error('网络请求失败: 无法连接到 MCP 服务器，请检查网络连接')
        }
      }
      
      throw error
    }
  }

  // 加载工具列表
  private async loadTools(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'User-Agent': 'ONES-Demo-Generator/1.0.0',
          'mcp-protocol-version': '2025-06-18',
          ...(this.token && { 'Authorization': `Bearer ${this.token}` })
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {}
        }),
        redirect: 'follow'
      })

      if (!response.ok) {
        throw new Error(`工具列表获取失败: HTTP ${response.status}`)
      }

      const responseText = await response.text()
      const lines = responseText.split('\n')
      let jsonData = ''
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          jsonData = line.substring(6)
          break
        }
      }
      
      if (!jsonData) {
        throw new Error('无效的工具列表响应格式')
      }
      
      const data = JSON.parse(jsonData)
      
      if (data.error) {
        throw new Error(`获取工具列表失败: ${data.error.message}`)
      }
      
      // 转换 ONES MCP 工具格式为内部格式
      this.availableTools = (data.result?.tools || []).map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
      
      console.log(`成功加载 ${this.availableTools.length} 个工具`)
    } catch (error) {
      console.error('加载工具列表失败:', error)
      this.availableTools = []
    }
  }

  // 获取可用工具列表
  getAvailableTools(): MCPTool[] {
    return this.availableTools
  }

  // 精确工具映射表
  private static readonly EXACT_TOOL_MAPPING: Record<string, string> = {
    // 项目相关
    'create_project': 'create_new_project',
    'get_projects': 'get_project_list',
    'get_project_details': 'get_project_details_by_project_id',
    'update_project': 'update_project_by_project_id',
    
    // 工作项相关
    'create_issue': 'create_new_issue',
    'get_issues': 'get_list_of_issues',
    'get_issue_details': 'get_issue_details',
    'update_issue': 'update_issue',
    'get_types': 'get_list_of_issue_types',
    'get_fields': 'get_list_of_issue_fields',
    
    // 评论相关
    'add_comment': 'post_issue_comment',
    'get_comments': 'get_list_of_issue_comments',
    
    // 工作流相关
    'get_workflows': 'get_issue_executable_workflows',
    'execute_workflow': 'execute_issue_workflow',
    
    // Wiki相关
    'create_wiki': 'create_page',
    'get_wiki_spaces': 'get_space_list',
    'get_wiki_space_details': 'get_space_details',
    'get_wiki_pages': 'get_list_of_space_pages',
    'get_wiki_page_details': 'get_page_details',
    'search_wiki': 'search_for_references_in_wiki',
    
    // 工时相关（优先使用简单模式）
    'log_work': 'add_workhour_in_simple_mode',
    'add_workhour': 'add_workhour_in_simple_mode',
    'update_workhour': 'update_workhour_in_simple_mode',
    'set_estimated_hours': 'set_manhour_estimated_in_simple_mode',
    'set_remaining_hours': 'set_manhour_remaining_in_simple_mode',
    'get_workhours': 'get_manhour_list_in_simple_mode',
    
    // 用户相关
    'search_users': 'search_for_users',
    
    // 系统相关
    'get_manhour_mode': 'get_manhour_mode'
  }

  // 工具依赖关系
  private static readonly TOOL_DEPENDENCIES: Record<string, string[]> = {
    'create_new_issue': ['get_project_list', 'get_list_of_issue_types', 'get_list_of_issue_fields'],
    'create_page': ['get_space_list', 'get_space_details'],
    'post_issue_comment': ['get_list_of_issues'],
    'add_workhour_in_simple_mode': ['get_list_of_issues'],
    'update_issue': ['get_list_of_issue_types', 'get_list_of_issue_fields'],
    'execute_issue_workflow': ['get_issue_executable_workflows']
  }

  // 参数构建器
  private buildParameters(toolName: string, data: any, context?: any): any {
    switch (toolName) {
      case 'create_new_project':
        return {
          name: data.name,
          templateID: data.template || data.templateID || 'project-t1', // 默认敏捷模板
          members: data.members || null
        }
      
      case 'create_new_issue':
        const fieldValues = []
        
        // 如果有描述且有描述字段ID，添加描述字段
        if (data.description && context?.descriptionFieldId) {
          fieldValues.push({
            fieldID: context.descriptionFieldId,
            type: 1, // 文本类型
            value: data.description
          })
        }
        
        // 如果没有任何字段值，添加一个默认字段（避免API要求fieldValues不能为空）
        if (fieldValues.length === 0) {
          // 尝试使用第一个可用的文本字段
          if (context?.availableFields && context.availableFields.length > 0) {
            const textField = context.availableFields.find((field: any) => 
              field.type === 1 || field.fieldType === 'text' || field.type === 'text'
            )
            if (textField) {
              fieldValues.push({
                fieldID: textField.id || textField.fieldId || textField.uuid,
                type: 1,
                value: data.description || '自动生成的演示工作项'
              })
            }
          }
        }
        
        return {
          title: data.title,
          projectID: (data.project_id || data.projectID || context?.projectId)?.toString(),
          issueTypeID: data.type_id || data.issueTypeID || context?.issueTypeId,
          assignee: data.assignee || data.assignees?.[0] || '', // 默认当前用户
          fieldValues: fieldValues,
          watchers: data.watchers || [],
          parentID: data.parent_id || data.parentID || null
        }
      
      case 'post_issue_comment':
        return {
          issueID: data.issue_id || data.issueID,
          text: data.text || data.content || data.comment,
          repliedMessageID: data.replied_message_id || data.repliedMessageID || null
        }
      
      case 'create_page':
        return {
          parentPageID: data.parent_page_id || data.parentPageID || context?.parentPageId || context?.homePageId,
          title: data.title,
          content: data.content || `# ${data.title}\n\n这是自动生成的Wiki页面内容。\n\n## 概述\n\n${data.description || '待补充详细内容...'}`
        }
      
      case 'add_workhour_in_simple_mode':
        return {
          issueID: data.issue_id || data.issueID,
          hours: parseFloat(data.hours || data.duration || 0),
          description: data.description || data.comment || '工时记录',
          startTime: data.start_time || data.startTime || new Date().toISOString(),
          owner: data.owner || null // 默认当前用户
        }
      
      case 'get_list_of_issue_types':
        return {
          cursor: data.cursor || null
        }
      
      case 'get_list_of_issue_fields':
        return {
          cursor: data.cursor || null
        }
      
      case 'get_project_list':
        return {
          cursor: data.cursor || null
        }
      
      default:
        // 对于其他工具，直接返回原始数据
        return data
    }
  }

  // 根据功能需求智能选择工具
  selectToolsForTask(taskType: string, context?: any): MCPTool[] {
    const selectedTools: MCPTool[] = []
    
    // 首先尝试精确映射
    const exactToolName = MCPClient.EXACT_TOOL_MAPPING[taskType]
    if (exactToolName) {
      const exactTool = this.availableTools.find(tool => tool.name === exactToolName)
      if (exactTool) {
        selectedTools.push(exactTool)
        
        // 添加依赖工具
        const dependencies = MCPClient.TOOL_DEPENDENCIES[exactToolName]
        if (dependencies) {
          for (const depToolName of dependencies) {
            const depTool = this.availableTools.find(tool => tool.name === depToolName)
            if (depTool && !selectedTools.some(t => t.name === depTool.name)) {
              selectedTools.push(depTool)
            }
          }
        }
        
        return selectedTools
      }
    }
    
    // 如果精确映射失败，回退到关键词匹配
    console.warn(`No exact mapping found for task type: ${taskType}, falling back to keyword matching`)
    
    switch (taskType) {
      case 'search':
        selectedTools.push(...this.findToolsByKeywords(['search', 'find', 'get']))
        break
      case 'list':
        selectedTools.push(...this.findToolsByKeywords(['list', 'get']))
        break
      default:
        // 最后的回退：返回所有工具
        return this.availableTools
    }
    
    return selectedTools.length > 0 ? selectedTools : this.availableTools
  }

  // 通过关键词查找工具
  private findToolsByKeywords(keywords: string[]): MCPTool[] {
    return this.availableTools.filter(tool => {
      const searchText = `${tool.name} ${tool.description}`.toLowerCase()
      return keywords.some(keyword => searchText.includes(keyword.toLowerCase()))
    })
  }

  // 调用指定工具
  async callTool(toolName: string, args: Record<string, any>): Promise<ToolResult> {
    try {
      // 验证工具是否存在
      const tool = this.availableTools.find(t => t.name === toolName)
      if (!tool) {
        return {
          ok: false,
          error: `工具 "${toolName}" 不存在。可用工具: ${this.availableTools.map(t => t.name).join(', ')}`
        }
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30秒超时
      
      const response = await fetch(`${this.baseUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'User-Agent': 'ONES-Demo-Generator/1.0.0',
          'mcp-protocol-version': '2025-06-18',
          ...(this.token && { 'Authorization': `Bearer ${this.token}` })
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args
          }
        }),
        signal: controller.signal,
        redirect: 'follow'
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        return {
          ok: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }

      // ONES MCP 使用 Server-Sent Events 格式
      const responseText = await response.text()
      
      // 解析 SSE 格式的响应
      const lines = responseText.split('\n')
      let jsonData = ''
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          jsonData = line.substring(6)
          break
        }
      }
      
      if (!jsonData) {
        return {
          ok: false,
          error: '无效的 SSE 响应格式'
        }
      }
      
      const data = JSON.parse(jsonData)
      
      if (data.error) {
        return {
          ok: false,
          error: `工具调用失败: ${data.error.message}`
        }
      }

      return {
        ok: true,
        result: {
          id: data.id || '',
          raw: data.result
        }
      }
    } catch (error) {
      let errorMessage = '未知错误'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = '工具调用超时，请稍后重试'
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
          errorMessage = 'DNS 解析失败，无法连接到 MCP 服务器'
        } else if (error.message.includes('ECONNREFUSED')) {
          errorMessage = '连接被拒绝，MCP 服务器可能不可用'
        } else if (error.message.includes('fetch failed')) {
          errorMessage = '网络请求失败，请检查网络连接'
        } else {
          errorMessage = error.message
        }
      }
      
      return {
        ok: false,
        error: errorMessage
      }
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.initialize()
      return {
        success: true,
        message: `MCP 服务器连接成功，发现 ${this.availableTools.length} 个可用工具`
      }
    } catch (error) {
      let message = '连接测试失败'
      
      if (error instanceof Error) {
        if (error.message.includes('HTTP 401')) {
          message = '认证失败：需要有效的访问令牌。请在设置页面配置 ONES MCP Server Token，或联系管理员获取访问权限。'
        } else if (error.message.includes('HTTP 404')) {
          message = 'MCP 服务器端点不存在，请检查服务器地址是否正确。'
        } else if (error.message.includes('HTTP 500')) {
          message = 'MCP 服务器内部错误，请稍后重试或联系管理员。'
        } else if (error.message.includes('fetch')) {
          message = '网络连接失败，请检查服务器地址和网络连接。'
        } else {
          message = `连接失败: ${error.message}`
        }
      }
      
      return {
        success: false,
        message
      }
    }
  }

  // 智能工具执行 - 根据任务类型自动选择最合适的工具
  async executeTask(taskType: string, args: Record<string, any>, context?: any): Promise<ToolResult> {
    const candidateTools = this.selectToolsForTask(taskType, context)
    
    if (candidateTools.length === 0) {
      return {
        ok: false,
        error: `未找到适合执行 "${taskType}" 的工具`
      }
    }

    // 选择第一个匹配的工具（主要工具）
    const selectedTool = candidateTools[0]
    
    console.log(`执行任务 "${taskType}" 使用工具: ${selectedTool.name}`)
    
    // 使用参数构建器构建正确的参数格式
    const builtParameters = this.buildParameters(selectedTool.name, args, context)
    
    console.log(`工具 "${selectedTool.name}" 参数:`, JSON.stringify(builtParameters, null, 2))
    
    return await this.callTool(selectedTool.name, builtParameters)
  }
}

// 工具调用重试逻辑
export async function retryToolCall<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  backoffMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      if (i < maxRetries) {
        // 指数退避
        const delay = backoffMs * Math.pow(2, i)
        await new Promise(resolve => setTimeout(resolve, delay))
        console.warn(`工具调用失败，${delay}ms 后重试 (${i + 1}/${maxRetries}):`, error)
      }
    }
  }
  
  throw lastError
}
