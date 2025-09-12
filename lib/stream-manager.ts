// 全局事件流管理
class StreamManager {
  private streams = new Map<string, ReadableStreamDefaultController<Uint8Array>>()
  private encoder = new TextEncoder()

  addStream(id: string, controller: ReadableStreamDefaultController<Uint8Array>) {
    this.streams.set(id, controller)
    console.log(`添加流: ${id}，当前流数量: ${this.streams.size}`)
  }

  removeStream(id: string) {
    this.streams.delete(id)
    console.log(`移除流: ${id}，当前流数量: ${this.streams.size}`)
  }

  broadcast(message: any) {
    const data = JSON.stringify(message)
    const chunk = this.encoder.encode(`data: ${data}\n\n`)
    
    console.log(`广播消息到 ${this.streams.size} 个流:`, message.step)
    
    for (const [id, controller] of this.streams) {
      try {
        controller.enqueue(chunk)
      } catch (error) {
        console.error(`流 ${id} 发送失败:`, error)
        this.streams.delete(id)
      }
    }
  }

  getStreamCount() {
    return this.streams.size
  }
}

// 全局流管理器实例
export const streamManager = new StreamManager()




