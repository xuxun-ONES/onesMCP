import { NextRequest } from 'next/server'
import { streamManager } from '@/lib/stream-manager'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const streamId = searchParams.get('id') || Math.random().toString(36).substring(2)
  
  console.log(`新的 SSE 连接: ${streamId}`)

  const stream = new ReadableStream({
    start(controller) {
      // 发送连接成功消息
      const welcomeMessage = {
        level: 'info',
        step: 'SSE 连接已建立',
        timestamp: new Date().toISOString()
      }
      
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(welcomeMessage)}\n\n`))
      
      // 添加到流管理器
      streamManager.addStream(streamId, controller)
    },
    
    cancel() {
      console.log(`SSE 连接关闭: ${streamId}`)
      streamManager.removeStream(streamId)
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
