import { WizardFormData, SeedPlan } from './schema'

/**
 * Demo数据计划指导类
 * 负责管理整体生成策略和上下文
 */
export class DemoPlanGuide {
  private formData: WizardFormData
  private overallPlan: {
    projectName: string
    projectDescription: string
    businessContext: string
    managementModel: string
    targetWorkItems: number
    workItemTypes: string[]
    wikiTopics: string[]
  }
  
  private createdItems: Map<string, any> = new Map()
  private projectContext: {
    projectId?: string
    typeMapping?: Record<string, string>
    descriptionFieldId?: string
    availableFields?: any[]
  } = {}

  constructor(formData: WizardFormData) {
    this.formData = formData
    this.overallPlan = this.createOverallPlan()
  }

  private createOverallPlan() {
    const { companyName, projectModel, demoRequirements, businessType } = this.formData
    
    return {
      projectName: `${companyName}-${businessType}协同管理平台`,
      projectDescription: `基于${projectModel}管理模式的${businessType}行业数字化协同平台，旨在提升团队协作效率，规范业务流程，实现项目全生命周期管理。`,
      businessContext: businessType,
      managementModel: projectModel,
      targetWorkItems: 8,
      workItemTypes: this.determineWorkItemTypes(demoRequirements),
      wikiTopics: this.determineWikiTopics(demoRequirements, businessType)
    }
  }

  private determineWorkItemTypes(requirements: string[]): string[] {
    const types = []
    
    if (requirements.includes('需求管理')) {
      types.push('需求', '需求', '需求') // 3个需求
    }
    if (requirements.includes('缺陷管理')) {
      types.push('缺陷', '缺陷') // 2个缺陷
    }
    
    // 填充剩余的任务类型
    while (types.length < 8) {
      types.push('任务')
    }
    
    return types.slice(0, 8)
  }

  private determineWikiTopics(requirements: string[], businessType: string): string[] {
    const topics = [
      `${businessType}项目概述`,
      '技术架构设计',
      '开发规范指南',
      '部署运维手册',
      '常见问题FAQ'
    ]
    
    return topics
  }

  /**
   * 获取整体项目信息
   */
  getProjectInfo() {
    return {
      name: this.overallPlan.projectName,
      description: this.overallPlan.projectDescription
    }
  }

  /**
   * 设置项目上下文（项目创建后调用）
   */
  setProjectContext(context: {
    projectId: string
    typeMapping?: Record<string, string>
    descriptionFieldId?: string
    availableFields?: any[]
  }) {
    this.projectContext = { ...this.projectContext, ...context }
  }

  /**
   * 获取项目上下文
   */
  getProjectContext() {
    return this.projectContext
  }

  /**
   * 生成单个工作项的详细信息
   */
  async generateWorkItemDetails(index: number, aiClient: any): Promise<{
    title: string
    type: string
    description: string
    assignees: string[]
    children: Array<{
      title: string
      type: string
      description: string
    }>
  }> {
    const workItemType = this.overallPlan.workItemTypes[index]
    const { businessContext, managementModel } = this.overallPlan
    
    // 构建针对单个工作项的prompt
    const prompt = this.buildSingleWorkItemPrompt(index + 1, workItemType, businessContext, managementModel)
    
    try {
      const response = await aiClient.generateWorkItem(prompt)
      return response
    } catch (error) {
      // 如果AI生成失败，返回默认的工作项
      return this.generateDefaultWorkItem(index, workItemType)
    }
  }

  private buildSingleWorkItemPrompt(itemNumber: number, itemType: string, businessContext: string, managementModel: string): string {
    return `你是一个资深的项目管理专家，正在为"${this.overallPlan.projectName}"项目生成第${itemNumber}个工作项。

**项目背景:**
- 项目名称: ${this.overallPlan.projectName}
- 业务类型: ${businessContext}
- 管理模式: ${managementModel}
- 项目描述: ${this.overallPlan.projectDescription}

**当前任务:**
生成一个${itemType}类型的工作项，要求：

1. 标题要具体明确，体现${businessContext}行业特色
2. 描述要详细专业（200-300字），包含背景、具体需求、验收标准
3. 包含2-3个相关的子工作项
4. 体现${managementModel}管理模式的特点

**输出格式:**
请严格按照以下JSON格式输出：

\`\`\`json
{
  "title": "具体明确的${itemType}标题",
  "type": "${itemType}",
  "description": "详细的${itemType}描述，包含背景、需求详情、验收标准、技术要点等（200-300字）",
  "assignees": ["负责人姓名"],
  "children": [
    {
      "title": "子工作项标题1",
      "type": "任务",
      "description": "子工作项详细描述（100-150字）"
    },
    {
      "title": "子工作项标题2", 
      "type": "任务",
      "description": "子工作项详细描述（100-150字）"
    }
  ]
}
\`\`\`

请确保内容专业、真实、符合${businessContext}行业实际业务场景。`
  }

  private generateDefaultWorkItem(index: number, itemType: string) {
    const { businessContext } = this.overallPlan
    
    return {
      title: `${businessContext}${itemType}-${index + 1}`,
      type: itemType,
      description: `这是一个${businessContext}行业的${itemType}工作项，用于演示系统功能。包含详细的需求描述、验收标准和实施方案。`,
      assignees: ['张三'],
      children: [
        {
          title: `${itemType}子任务1`,
          type: '任务',
          description: `${itemType}的具体实施任务，包含详细的执行步骤和交付物要求。`
        },
        {
          title: `${itemType}子任务2`,
          type: '任务', 
          description: `${itemType}的验证和测试任务，确保质量符合预期标准。`
        }
      ]
    }
  }

  /**
   * 生成工作项的评论
   */
  generateWorkItemComments(workItemTitle: string): Array<{ issueTitle: string, body: string }> {
    return [
      {
        issueTitle: workItemTitle,
        body: `已开始处理此${this.getWorkItemTypeByTitle(workItemTitle)}，预计按计划完成。如有问题会及时沟通。`
      },
      {
        issueTitle: workItemTitle,
        body: `进度更新：当前已完成初步分析，正在进行详细设计。预计本周内完成主要开发工作。`
      }
    ]
  }

  /**
   * 生成工作项的工时记录
   */
  generateWorkItemWorklogs(workItemTitle: string): Array<{ issueTitle: string, hours: number, comment: string }> {
    return [
      {
        issueTitle: workItemTitle,
        hours: 4,
        comment: `完成${this.getWorkItemTypeByTitle(workItemTitle)}的需求分析和设计工作`
      }
    ]
  }

  /**
   * 获取Wiki页面信息
   */
  getWikiPages(): Array<{ title: string, content: string }> {
    return this.overallPlan.wikiTopics.map((topic, index) => ({
      title: topic,
      content: this.generateWikiContent(topic, index)
    }))
  }

  private generateWikiContent(topic: string, index: number): string {
    const { projectName, businessContext, managementModel } = this.overallPlan
    
    const templates = {
      0: `# ${topic}

## 项目背景

${projectName}是一个基于${managementModel}管理模式的${businessContext}行业数字化协同平台。

## 项目目标

- 提升团队协作效率
- 规范业务流程管理
- 实现项目全生命周期管理
- 支持${businessContext}行业特色需求

## 项目范围

本项目涵盖${businessContext}行业的核心业务流程，包括需求管理、任务分配、进度跟踪、质量控制等关键环节。

## 预期收益

通过实施本项目，预计可以提升30%的工作效率，减少50%的沟通成本，实现100%的流程标准化。`,

      1: `# ${topic}

## 系统架构概述

本系统采用微服务架构设计，支持高并发、高可用的业务需求。

## 技术栈选择

### 前端技术
- React 18 + TypeScript
- Next.js 框架
- Tailwind CSS 样式框架

### 后端技术  
- Node.js + Express
- PostgreSQL 数据库
- Redis 缓存

### 部署架构
- Docker 容器化部署
- Kubernetes 集群管理
- CI/CD 自动化流水线

## 数据流设计

系统采用事件驱动架构，通过消息队列实现服务间解耦，保证数据一致性和系统稳定性。`,

      2: `# ${topic}

## 代码规范

### 命名规范
- 变量名使用驼峰命名法
- 常量使用大写字母和下划线
- 函数名要体现具体功能

### 代码结构
- 单一职责原则
- 模块化设计
- 注释完整清晰

## Git 工作流

### 分支策略
- main: 主分支，用于生产环境
- develop: 开发分支，用于集成测试
- feature/*: 功能分支，用于新功能开发

### 提交规范
- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码格式调整

## 代码审查

所有代码必须经过同行评审，确保代码质量和团队知识共享。`,

      3: `# ${topic}

## 环境准备

### 开发环境
- Node.js >= 18.0.0
- PostgreSQL >= 14.0
- Redis >= 6.0

### 部署环境
- Docker >= 20.0
- Kubernetes >= 1.24
- Nginx >= 1.20

## 部署流程

### 1. 构建镜像
\`\`\`bash
docker build -t ${businessContext}-platform:latest .
\`\`\`

### 2. 推送镜像
\`\`\`bash
docker push registry.company.com/${businessContext}-platform:latest
\`\`\`

### 3. 部署应用
\`\`\`bash
kubectl apply -f k8s/deployment.yaml
\`\`\`

## 监控告警

系统集成了完整的监控体系，包括应用性能监控、业务指标监控和基础设施监控。`,

      4: `# ${topic}

## 常见问题

### Q1: 如何重置用户密码？
A: 管理员可以在用户管理页面重置密码，用户也可以通过邮箱自助重置。

### Q2: 系统支持多少并发用户？
A: 当前系统设计支持1000+并发用户，可根据业务需求进行扩容。

### Q3: 数据备份策略是什么？
A: 系统采用每日增量备份+每周全量备份的策略，确保数据安全。

### Q4: 如何集成第三方系统？
A: 系统提供标准REST API接口，支持与主流第三方系统集成。

### Q5: 移动端支持情况？
A: 系统采用响应式设计，完美支持手机、平板等移动设备访问。

## 技术支持

如遇到其他问题，请联系技术支持团队：
- 邮箱: support@company.com  
- 电话: 400-123-4567
- 工作时间: 周一至周五 9:00-18:00`
    }
    
    return templates[index as keyof typeof templates] || `# ${topic}\n\n这是关于${topic}的详细说明文档。`
  }

  private getWorkItemTypeByTitle(title: string): string {
    if (title.includes('需求')) return '需求'
    if (title.includes('缺陷')) return '缺陷'
    return '任务'
  }

  /**
   * 记录已创建的项目
   */
  recordCreatedItem(title: string, id: string, type: string) {
    this.createdItems.set(title, { id, type, createdAt: new Date() })
  }

  /**
   * 获取已创建的项目
   */
  getCreatedItems() {
    return this.createdItems
  }

  /**
   * 获取进度信息
   */
  getProgress() {
    const totalItems = this.overallPlan.targetWorkItems + this.overallPlan.wikiTopics.length + 1 // +1 for project
    const createdItems = this.createdItems.size
    
    return {
      total: totalItems,
      completed: createdItems,
      percentage: Math.round((createdItems / totalItems) * 100)
    }
  }
}
