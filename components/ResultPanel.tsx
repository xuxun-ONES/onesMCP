'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Clock, AlertCircle } from 'lucide-react'

interface ResultPanelProps {
  isGenerating: boolean
}

export function ResultPanel({ isGenerating }: ResultPanelProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">生成结果</CardTitle>
        <CardDescription>
          演示数据生成状态和结果预览
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isGenerating ? (
          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Clock className="h-5 w-5 text-blue-600 animate-spin" />
            <div>
              <p className="font-medium text-blue-900">正在生成中...</p>
              <p className="text-sm text-blue-700">AI 正在创建演示数据，请稍候</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-gray-500" />
              <div>
                <p className="font-medium text-gray-700">等待开始</p>
                <p className="text-sm text-gray-600">填写表单并点击"开始生成 Demo"</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

