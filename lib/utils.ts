import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 生成唯一 ID
export function generateId(): string {
  return `DEMO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// 脱敏处理敏感数据
export function sanitizeData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data
  }

  const sensitiveKeys = ['api_key', 'token', 'password', 'secret']
  const result: any = Array.isArray(data) ? [] : {}

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()
    
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      result[key] = '***'
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeData(value)
    } else {
      result[key] = value
    }
  }

  return result
}

// 业务形态选项
export const businessTypes = [
  '智能芯片制造',
  '整车研发',
  '软件外包',
  'SaaS 产品',
  '移动应用开发',
  '企业软件',
  '电商平台',
  '金融科技',
  '医疗健康',
  '教育科技',
  '自定义'
] as const

// 项目管理模型描述
export const projectModelDescriptions = {
  '敏捷研发': '采用敏捷开发方法，快速迭代，持续交付',
  '瀑布研发': '传统瀑布模型，阶段性开发，严格按计划执行',
  '混合研发': '结合敏捷和瀑布的优势，灵活应对项目需求'
} as const

// 演示需求描述
export const demoRequirementDescriptions = {
  '路线图管理': '展示项目路线图规划、里程碑管理和目标跟踪功能',
  '需求管理': '演示需求收集、分析、跟踪和变更管理流程',
  '缺陷管理': '展示缺陷发现、分配、修复和验证的完整生命周期'
} as const

// 格式化时间
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}min`
}

// 截断长文本
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// 验证 URL
export function isValidUrl(string: string): boolean {
  try {
    new URL(string)
    return true
  } catch (_) {
    return false
  }
}

// 深拷贝对象
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T
  if (typeof obj === 'object') {
    const cloned = {} as T
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key])
      }
    }
    return cloned
  }
  return obj
}


