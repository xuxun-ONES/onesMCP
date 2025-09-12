'use client'

import { useState } from 'react'
import Link from 'next/link'
import { WizardForm } from '@/components/WizardForm'
import { StreamLogComponent } from '@/components/StreamLog'
import { ResultPanel } from '@/components/ResultPanel'
import { Button } from '@/components/ui/button'
import { WizardFormData } from '@/lib/schema'
import { Settings, Github } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

export default function HomePage() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentFormData, setCurrentFormData] = useState<WizardFormData | null>(null)
  const { toast } = useToast()

  const handleFormSubmit = async (formData: WizardFormData) => {
    setIsGenerating(true)
    setCurrentFormData(formData)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`
        throw new Error(errorMessage)
      }

      const result = await response.json()
      toast({
        title: '生成完成',
        description: result.message || '演示数据已成功生成'
      })
    } catch (error) {
      console.error('生成失败:', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      
      toast({
        title: '生成失败',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRetry = async (step: string) => {
    if (!currentFormData) return

    toast({
      title: '重试功能',
      description: `将重试步骤: ${step}`,
    })

    // 这里可以实现单步重试逻辑
    // 例如重新调用特定的 API 端点
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* 头部导航 */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  ONES Demo 数据生成器
                </h1>
                <p className="text-sm text-muted-foreground">
                  AI 驱动的演示数据自动创建工具
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Link href="/settings">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  设置
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open('https://github.com', '_blank')}
              >
                <Github className="h-4 w-4 mr-2" />
                GitHub
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 主要内容 */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左侧：表单 */}
          <div className="space-y-6">
            <WizardForm
              onSubmit={handleFormSubmit}
              isGenerating={isGenerating}
            />
            
            {/* 预览信息 */}
            {currentFormData && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                <h3 className="font-medium text-blue-900 mb-2">生成预览</h3>
                <div className="space-y-1 text-sm text-blue-800">
                  <p><strong>公司:</strong> {currentFormData.companyName}</p>
                  <p><strong>模型:</strong> {currentFormData.projectModel}</p>
                  <p><strong>需求:</strong> {currentFormData.demoRequirements.join('、')}</p>
                  <p><strong>业务:</strong> {currentFormData.businessType}</p>
                </div>
              </div>
            )}
          </div>

          {/* 右侧：日志和结果 */}
          <div className="space-y-6">
            <StreamLogComponent
              isActive={isGenerating}
              onRetry={handleRetry}
            />
            
            <ResultPanel isGenerating={isGenerating} />
          </div>
        </div>

        {/* 功能说明 */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6 bg-white rounded-2xl shadow-sm border">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎯</span>
            </div>
            <h3 className="font-semibold mb-2">智能规划</h3>
            <p className="text-sm text-muted-foreground">
              AI 根据业务场景自动生成结构化的演示数据计划
            </p>
          </div>
          
          <div className="text-center p-6 bg-white rounded-2xl shadow-sm border">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🚀</span>
            </div>
            <h3 className="font-semibold mb-2">自动执行</h3>
            <p className="text-sm text-muted-foreground">
              通过 MCP 协议自动调用 ONES 工具创建项目数据
            </p>
          </div>
          
          <div className="text-center p-6 bg-white rounded-2xl shadow-sm border">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="font-semibold mb-2">实时监控</h3>
            <p className="text-sm text-muted-foreground">
              流式日志显示创建进度，支持错误重试和结果预览
            </p>
          </div>
        </div>
      </main>

      {/* 页脚 */}
      <footer className="mt-16 border-t bg-white/50">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>由 AI Agent 驱动，基于 Next.js 14 + OpenAI + MCP 协议构建</p>
        </div>
      </footer>
    </div>
  )
}