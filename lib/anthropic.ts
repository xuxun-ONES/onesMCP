import Anthropic from '@anthropic-ai/sdk'
import { WizardFormData, SeedPlan } from './schema'

export class AnthropicClient {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey: apiKey,
      timeout: 120000, // 2分钟超时
      maxRetries: 2
    })
  }

  async generateWorkItem(prompt: string): Promise<any> {
    // 使用更快的模型生成单个工作项
    const models = ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229']
    let lastError: Error | null = null
    
    for (const model of models) {
      try {
        const message = await this.client.messages.create({
          model: model,
          max_tokens: 2000, // 减少token数量以提高速度
          messages: [{
            role: 'user',
            content: prompt
          }]
        })

        const content = message.content[0]?.type === 'text' ? message.content[0].text : ''
        if (!content) {
          throw new Error('Anthropic 返回空内容')
        }

        // 解析JSON响应
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
        if (!jsonMatch) {
          const trimmed = content.trim()
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            return JSON.parse(trimmed)
          }
          throw new Error('响应中未找到有效的 JSON 格式')
        }
        
        const jsonStr = jsonMatch[1].trim()
        return JSON.parse(jsonStr)
        
      } catch (error) {
        lastError = error as Error
        console.warn(`模型 ${model} 调用失败:`, error)
        continue
      }
    }
    
    throw new Error(`单个工作项生成失败: ${lastError?.message}`)
  }

  async generateSeedPlan(formData: WizardFormData): Promise<SeedPlan> {
    const prompt = this.buildPrompt(formData)
    
    // 首先尝试获取可用模型列表
    let models: string[] = []
    try {
      const availableModels = await this.getAvailableModels()
      models = availableModels
      console.log('获取到可用模型:', models)
    } catch (error) {
      console.log('获取模型列表失败，使用默认模型列表:', error)
      // 回退到可能可用的模型列表
      // 基于2024年底的Anthropic模型情况
      models = [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022', 
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
        // 尝试不带日期的格式
        'claude-3-5-sonnet',
        'claude-3-5-haiku',
        'claude-3-opus',
        'claude-3-sonnet',
        'claude-3-haiku'
      ]
    }
    
    let lastError: Error | null = null
    
    for (const model of models) {
      try {
        console.log(`尝试使用模型: ${model}`)
        
        const response = await this.client.messages.create({
          model: model,
          max_tokens: 4000,
          temperature: 0.7,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
        
        const content = response.content[0]
        if (content.type !== 'text') {
          throw new Error('Unexpected response type from Anthropic')
        }
        
        console.log(`模型 ${model} 调用成功`)
        return this.parseSeedPlan(content.text)
        
      } catch (error) {
        console.log(`模型 ${model} 调用失败:`, error instanceof Error ? error.message : error)
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        // 如果是可以重试的错误，继续尝试下一个模型
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase()
          const shouldRetry = (
            errorMessage.includes('rate_limit') ||
            errorMessage.includes('insufficient_quota') ||
            errorMessage.includes('model_not_found') ||
            errorMessage.includes('not_found_error') ||
            errorMessage.includes('permission_denied') ||
            errorMessage.includes('invalid_api_key') ||
            error.message.includes('404') ||
            error.message.includes('401')
          )
          
          if (shouldRetry) {
            console.log(`${model} 不可用，尝试下一个模型`)
            continue
          }
        }
        
        // 其他错误直接抛出
        throw error
      }
    }
    
    // 所有模型都失败了
    const errorMessage = lastError?.message || '未知错误'
    console.error('所有Anthropic模型调用失败:', errorMessage)
    
    // 根据错误类型提供更有用的错误信息
    if (errorMessage.includes('Invalid API key') || errorMessage.includes('401') || errorMessage.includes('Invalid API key format')) {
      throw new Error('Anthropic API Key 无效或格式错误。\n\n请确保：\n1. 访问 https://console.anthropic.com/ 获取有效的API Key\n2. API Key格式为 sk-ant-api03-...\n3. 在设置页面正确配置API Key')
    } else if (errorMessage.includes('rate_limit') || errorMessage.includes('429')) {
      throw new Error('Anthropic API 请求频率过高。请稍后重试。')
    } else if (errorMessage.includes('insufficient_quota') || errorMessage.includes('402')) {
      throw new Error('Anthropic API 配额不足。请检查您的账户余额。')
    } else if (errorMessage.includes('not_found_error') || errorMessage.includes('404') || errorMessage.includes('Invalid model name')) {
      throw new Error('当前没有可用的Anthropic模型。可能的原因：\n1. 模型已弃用或不再可用\n2. API Key权限不足\n3. 需要升级账户等级\n\n建议：请访问 https://console.anthropic.com 检查您的账户状态和可用模型。')
    } else {
      throw new Error(`Anthropic模型调用失败: ${errorMessage}\n\n如果问题持续存在，请检查您的API Key是否有效，或尝试切换回OpenAI服务。`)
    }
  }

  private async getAvailableModels(): Promise<string[]> {
    try {
      // 使用Anthropic API获取可用模型列表
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': this.client.apiKey,
          'anthropic-version': '2023-06-01'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // 提取模型ID并按优先级排序
      const modelIds = data.data.map((model: any) => model.id)
      
      // 优先使用Sonnet模型，然后是Opus，最后是Haiku
      const sortedModels = modelIds.sort((a: string, b: string) => {
        if (a.includes('sonnet') && !b.includes('sonnet')) return -1
        if (!a.includes('sonnet') && b.includes('sonnet')) return 1
        if (a.includes('opus') && b.includes('haiku')) return -1
        if (a.includes('haiku') && b.includes('opus')) return 1
        return b.localeCompare(a) // 按字母顺序倒序，新版本在前
      })
      
      return sortedModels
    } catch (error) {
      console.error('获取Anthropic模型列表失败:', error)
      throw error
    }
  }

  private buildPrompt(formData: WizardFormData): string {
    return `你是一个资深的项目管理专家和业务分析师，需要为 ONES 项目管理系统生成高质量的演示数据。

请根据以下信息生成一个完整且详细的演示数据计划：

**公司信息:**
- 公司名称: ${formData.companyName}
- 项目管理模型: ${formData.projectModel}
- 演示需求: ${formData.demoRequirements.join('、')}
- 业务类型: ${formData.businessType}

**核心要求:**
1. 生成一个符合${formData.businessType}行业特点的真实项目场景
2. 严格采用${formData.projectModel}的管理方式和最佳实践
3. 全面覆盖${formData.demoRequirements.join('、')}相关的演示内容
4. 所有数据必须真实可信，体现实际业务复杂度和专业性
5. 工作项标题要具体明确，描述要详细完整（至少100-200字）
6. Wiki页面内容要丰富专业，包含完整的项目文档结构

**数据规模要求:**
- 主要工作项：8 个（包含需求、任务、缺陷等不同类型）
- 每个主要工作项包含 2-3 个子工作项
- 每个工作项 2 条评论
- 每个工作项 1 条工时记录
- Wiki页面：5 个，涵盖项目核心方面

**内容质量标准:**
- 工作项标题：具体、专业、可执行
- 工作项描述：详细的需求说明、验收标准、技术要点（150-300字）
- 评论内容：真实的沟通记录、问题讨论、进度更新
- Wiki内容：完整的Markdown格式文档，包含标题、列表、代码块等

**输出格式:**
请严格按照以下 JSON 格式输出，不要包含任何其他文字：

\`\`\`json
{
  "project": {
    "name": "具体的项目名称（体现业务特点）",
    "description": "详细的项目背景、目标、范围和价值描述（200-400字）"
  },
  "issues": [
    {
      "title": "具体明确的工作项标题",
      "type": "需求|缺陷|任务",
      "description": "详细的工作项描述，包含背景、需求详情、验收标准、技术要点等（150-300字）",
      "assignees": ["具体的负责人姓名"],
      "children": [
        {
          "title": "具体的子工作项标题",
          "type": "需求|缺陷|任务", 
          "description": "详细的子工作项描述，说明具体要完成的工作内容（100-200字）"
        }
      ]
    }
  ],
  "comments": [
    {
      "issueTitle": "对应的工作项标题（完全匹配）",
      "body": "真实的评论内容，如进度更新、问题讨论、解决方案等（50-150字）"
    }
  ],
  "worklogs": [
    {
      "issueTitle": "对应的工作项标题（完全匹配）",
      "hours": 实际工时数字（如2.5、4、8等）,
      "comment": "具体的工作内容说明"
    }
  ],
  "wikiPages": [
    {
      "title": "专业的Wiki页面标题",
      "content": "完整的Markdown格式内容，包含：\\n# 主标题\\n\\n## 二级标题\\n\\n详细内容描述，包含列表、代码块、表格等（500-1000字）"
    }
  ]
}
\`\`\`

**特别注意:**
1. 必须生成 8 个主要工作项，体现项目的完整性
2. 每个工作项的描述要详细专业，体现${formData.businessType}行业特色
3. Wiki页面要包含：项目概述、技术架构、开发规范、部署指南、FAQ
4. 所有内容要保持一致性，工作项标题在comments和worklogs中必须完全匹配
5. 体现${formData.projectModel}管理模式的特点和流程`
  }

  private parseSeedPlan(response: string): SeedPlan {
    try {
      // 提取 JSON 部分
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
      if (!jsonMatch) {
        // 如果没有找到代码块，尝试直接解析整个响应
        const trimmed = response.trim()
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          return JSON.parse(trimmed)
        }
        throw new Error('响应中未找到有效的 JSON 格式')
      }
      
      const jsonStr = jsonMatch[1].trim()
      const parsed = JSON.parse(jsonStr)
      
      // 验证必需字段
      if (!parsed.project || !parsed.issues || !Array.isArray(parsed.issues)) {
        throw new Error('响应格式不正确：缺少必需字段')
      }
      
      // 设置默认值
      return {
        project: parsed.project,
        issues: parsed.issues,
        comments: parsed.comments || [],
        worklogs: parsed.worklogs || [],
        wikiPages: parsed.wikiPages || []
      }
      
    } catch (error) {
      console.error('解析 Anthropic 响应失败:', error)
      console.error('原始响应:', response)
      throw new Error(`解析 AI 响应失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }
}
