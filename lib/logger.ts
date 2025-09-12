import { StreamLog } from './schema'

export class StreamLogger {
  private encoder = new TextEncoder()

  constructor(private writer: WritableStreamDefaultWriter<Uint8Array>) {}

  private async writeLog(log: StreamLog) {
    const line = JSON.stringify(log) + '\n'
    await this.writer.write(this.encoder.encode(`data: ${line}\n\n`))
  }

  async info(step: string, data?: any) {
    await this.writeLog({
      level: 'info',
      step,
      data,
      timestamp: new Date().toISOString()
    })
  }

  async warn(step: string, data?: any) {
    await this.writeLog({
      level: 'warn',
      step,
      data,
      timestamp: new Date().toISOString()
    })
  }

  async error(step: string, data?: any) {
    await this.writeLog({
      level: 'error',
      step,
      data,
      timestamp: new Date().toISOString()
    })
  }

  async step(step: string, tool?: string, data?: any, elapsedMs?: number) {
    await this.writeLog({
      level: 'step',
      step,
      tool,
      data,
      elapsedMs,
      timestamp: new Date().toISOString()
    })
  }

  async close() {
    await this.writer.close()
  }
}

export function createSSEResponse(): { response: Response; logger: StreamLogger } {
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  
  const response = new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  })

  const logger = new StreamLogger(writer)
  
  return { response, logger }
}

// 工具调用计时装饰器
export function withTiming<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  logger: StreamLogger,
  stepName: string,
  toolName?: string
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now()
    
    try {
      const result = await fn(...args)
      const elapsedMs = Date.now() - startTime
      
      await logger.step(
        stepName,
        toolName,
        { success: true, result: result?.result || result },
        elapsedMs
      )
      
      return result
    } catch (error) {
      const elapsedMs = Date.now() - startTime
      
      await logger.step(
        `${stepName} - 失败`,
        toolName,
        { success: false, error: error instanceof Error ? error.message : '未知错误' },
        elapsedMs
      )
      
      throw error
    }
  }) as T
}


