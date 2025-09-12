'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StreamLog } from '@/lib/schema'
import { formatDuration, truncateText, sanitizeData } from '@/lib/utils'
import { ChevronDown, ChevronRight, Copy, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface StreamLogProps {
  isActive: boolean
  onRetry?: (step: string) => void
}

export function StreamLogComponent({ isActive, onRetry }: StreamLogProps) {
  const [logs, setLogs] = useState<StreamLog[]>([])
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set())
  const [isConnected, setIsConnected] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const { toast } = useToast()

  // 清理日志功能
  const clearLogs = () => {
    setLogs([])
    setExpandedLogs(new Set())
  }

  useEffect(() => {
    if (isActive && !isConnected) {
      connectToStream()
    } else if (!isActive && isConnected) {
      disconnectFromStream()
    }

    return () => {
      disconnectFromStream()
    }
  }, [isActive])

  const connectToStream = () => {
    // 防止重复连接
    if (eventSourceRef.current) {
      console.log('SSE 连接已存在，跳过重复连接')
      return
    }

    try {
      console.log('正在建立 SSE 连接...')
      const eventSource = new EventSource('/api/stream')
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setIsConnected(true)
        console.log('SSE 连接已建立')
        
        // 发送一个测试消息确认连接
        setTimeout(() => {
          console.log('SSE 连接确认完成')
        }, 100)
      }

      eventSource.onmessage = (event) => {
        try {
          const log: StreamLog = JSON.parse(event.data)
          setLogs(prev => [...prev, log])
          
          // 自动滚动到底部
          setTimeout(() => {
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight
            }
          }, 100)
        } catch (error) {
          console.error('解析日志数据失败:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE 连接错误:', error)
        setIsConnected(false)
        // 不要立即关闭，让浏览器自动重连
        if (eventSource.readyState === EventSource.CLOSED) {
          eventSourceRef.current = null
        }
      }
    } catch (error) {
      console.error('创建 SSE 连接失败:', error)
      toast({
        title: '连接失败',
        description: '无法建立流式连接',
        variant: 'destructive'
      })
    }
  }

  const disconnectFromStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsConnected(false)
  }

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedLogs)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedLogs(newExpanded)
  }

  const copyAllLogs = async () => {
    try {
      const logText = logs.map(log => 
        `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.step}` +
        (log.tool ? ` (${log.tool})` : '') +
        (log.elapsedMs ? ` - ${formatDuration(log.elapsedMs)}` : '') +
        (log.data ? `\n数据: ${JSON.stringify(sanitizeData(log.data), null, 2)}` : '')
      ).join('\n\n')
      
      await navigator.clipboard.writeText(logText)
      toast({
        title: '复制成功',
        description: '日志已复制到剪贴板'
      })
    } catch (error) {
      toast({
        title: '复制失败',
        description: '无法复制日志到剪贴板',
        variant: 'destructive'
      })
    }
  }

  const getLogIcon = (level: StreamLog['level']) => {
    switch (level) {
      case 'error':
        return '❌'
      case 'warn':
        return '⚠️'
      case 'step':
        return '🔄'
      default:
        return 'ℹ️'
    }
  }

  const getLogColor = (level: StreamLog['level']) => {
    switch (level) {
      case 'error':
        return 'text-red-600 border-red-200 bg-red-50'
      case 'warn':
        return 'text-yellow-600 border-yellow-200 bg-yellow-50'
      case 'step':
        return 'text-blue-600 border-blue-200 bg-blue-50'
      default:
        return 'text-gray-600 border-gray-200 bg-gray-50'
    }
  }

  return (
    <Card className="w-full h-96">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">实时日志</CardTitle>
            <CardDescription>
              {isConnected ? '🟢 已连接' : '🔴 未连接'} · {logs.length} 条日志
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {logs.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={clearLogs}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  清理日志
                </Button>
                <Button variant="outline" size="sm" onClick={copyAllLogs}>
                  <Copy className="h-4 w-4 mr-1" />
                  复制全部
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={containerRef}
          className="h-80 overflow-y-auto px-6 pb-6 space-y-2"
        >
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {isActive ? '等待日志数据...' : '点击"开始生成 Demo"查看日志'}
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={`border rounded-lg p-3 ${getLogColor(log.level)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-lg">{getLogIcon(log.level)}</span>
                    <span className="font-medium">{log.step}</span>
                    {log.tool && (
                      <span className="px-2 py-1 bg-white bg-opacity-70 rounded text-xs font-mono">
                        {log.tool}
                      </span>
                    )}
                    {log.elapsedMs && (
                      <span className="text-xs opacity-70">
                        {formatDuration(log.elapsedMs)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {log.level === 'error' && onRetry && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRetry(log.step)}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        重试
                      </Button>
                    )}
                    {log.data && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(index)}
                      >
                        {expandedLogs.has(index) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="text-xs opacity-70 mt-1">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>

                {log.data && expandedLogs.has(index) && (
                  <div className="mt-3 p-3 bg-white bg-opacity-70 rounded border">
                    <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(sanitizeData(log.data), null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
