import { z } from 'zod'

// 种子计划 Schema
export const SeedPlanSchema = z.object({
  project: z.object({
    name: z.string(),
    description: z.string(),
    roadmap: z.array(z.object({
      name: z.string(),
      milestones: z.array(z.string())
    })).optional()
  }),
  issues: z.array(z.object({
    title: z.string(),
    type: z.enum(['需求', '缺陷', '任务']),
    description: z.string(),
    assignees: z.array(z.string()).optional(),
    children: z.array(z.object({
      title: z.string(),
      type: z.enum(['需求', '缺陷', '任务']),
      description: z.string()
    })).optional()
  })),
  comments: z.array(z.object({
    issueTitle: z.string(),
    body: z.string()
  })),
  worklogs: z.array(z.object({
    issueTitle: z.string(),
    hours: z.number(),
    comment: z.string()
  })),
  wikiPages: z.array(z.object({
    title: z.string(),
    content: z.string()
  }))
})

// 工具调用结果 Schema
export const ToolResultSchema = z.object({
  ok: z.boolean(),
  result: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    raw: z.any().optional()
  }).optional(),
  error: z.string().optional()
})

// 流式日志 Schema
export const StreamLogSchema = z.object({
  level: z.enum(['info', 'warn', 'error', 'step']),
  step: z.string(),
  tool: z.string().optional(),
  data: z.any().optional(),
  elapsedMs: z.number().optional(),
  timestamp: z.string()
})

// 表单数据 Schema
export const WizardFormSchema = z.object({
  companyName: z.string().min(1, '公司名称不能为空'),
  projectModel: z.enum(['敏捷研发', '瀑布研发', '混合研发']),
  demoRequirements: z.array(z.enum(['路线图管理', '需求管理', '缺陷管理'])).min(1, '请至少选择一个演示需求'),
  businessType: z.string().min(1, '请选择业务形态')
})

// 设置配置 Schema
export const SettingsSchema = z.object({
  openaiApiKey: z.string().min(1, 'OpenAI API Key 不能为空'),
  onesMcpServerUrl: z.string().url('请输入有效的 MCP 服务器 URL'),
  onesMcpServerToken: z.string().optional()
})

// 类型导出
export type SeedPlan = z.infer<typeof SeedPlanSchema>
export type ToolResult = z.infer<typeof ToolResultSchema>
export type StreamLog = z.infer<typeof StreamLogSchema>
export type WizardFormData = z.infer<typeof WizardFormSchema>
export type Settings = z.infer<typeof SettingsSchema>


