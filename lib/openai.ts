import OpenAI from 'openai'
import { WizardFormData, SeedPlan, SeedPlanSchema } from './schema'

export class OpenAIClient {
  private openai: OpenAI

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: false,
      timeout: 120000, // 2分钟超时
      maxRetries: 2
    })
  }

  async generateWorkItem(prompt: string): Promise<any> {
    // 使用更快的模型生成单个工作项
    const models = ['gpt-4o-mini', 'gpt-3.5-turbo']
    let lastError: Error | null = null
    
    for (const model of models) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000, // 减少token数量以提高速度
          temperature: 0.7
        })

        const content = completion.choices[0]?.message?.content
        if (!content) {
          throw new Error('OpenAI 返回空内容')
        }

        return JSON.parse(content)
        
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
    
    // 优先使用 gpt-5，回退到 gpt-4o-mini
    const models = ['gpt-5', 'gpt-4o-mini']
    let lastError: Error | null = null
    
    for (const model of models) {
      try {
        const completion = await this.openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的项目管理助手，需要根据用户输入生成结构化的演示数据计划。请严格按照 JSON Schema 返回数据，不要包含任何其他文本。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' }
        })

        const content = completion.choices[0]?.message?.content
        if (!content) {
          throw new Error('OpenAI 返回空内容')
        }

        const jsonData = JSON.parse(content)
        const validatedPlan = SeedPlanSchema.parse(jsonData)
        
        return validatedPlan
      } catch (error) {
        lastError = error as Error
        console.warn(`模型 ${model} 调用失败:`, error)
        
        if (model === 'gpt-5') {
          console.info('gpt-5 不可用，回退到 gpt-4o-mini')
          continue
        }
      }
    }

    throw new Error(`所有模型调用失败。最后错误: ${lastError?.message}`)
  }

  private buildPrompt(formData: WizardFormData): string {
    const { companyName, projectModel, demoRequirements, businessType } = formData
    
    return `你是一个资深的项目管理专家和业务分析师，需要为 ONES 项目管理系统生成高质量的演示数据。

请根据以下信息生成一个完整且详细的演示数据计划：

**公司信息:**
- 公司名称: ${companyName}
- 项目管理模型: ${projectModel}
- 演示需求: ${demoRequirements.join('、')}
- 业务类型: ${businessType}

**核心要求:**
1. 生成一个符合${businessType}行业特点的真实项目场景
2. 严格采用${projectModel}的管理方式和最佳实践
3. 全面覆盖${demoRequirements.join('、')}相关的演示内容
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

请严格按照以下 JSON 格式输出，不要包含任何其他文字：

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

**特别注意:**
1. 必须生成 8 个主要工作项，体现项目的完整性
2. 每个工作项的描述要详细专业，体现${businessType}行业特色
3. Wiki页面要包含：项目概述、技术架构、开发规范、部署指南、FAQ
4. 所有内容要保持一致性，工作项标题在comments和worklogs中必须完全匹配
5. 体现${projectModel}管理模式的特点和流程
6. 严格按照 JSON 格式返回，不要包含任何解释文本`
  }

}

