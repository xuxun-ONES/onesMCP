'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { WizardFormData, WizardFormSchema } from '@/lib/schema'
import { useToast } from '@/components/ui/use-toast'
import { Loader2 } from 'lucide-react'

interface WizardFormProps {
  onSubmit: (data: WizardFormData) => void
  isGenerating: boolean
}

export function WizardForm({ onSubmit, isGenerating }: WizardFormProps) {
  const [formData, setFormData] = useState<Partial<WizardFormData>>({
    companyName: '',
    projectModel: undefined,
    demoRequirements: [],
    businessType: ''
  })
  const { toast } = useToast()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const validatedData = WizardFormSchema.parse(formData)
      onSubmit(validatedData)
    } catch (error) {
      console.error('表单验证失败:', error)
      toast({
        title: '表单验证失败',
        description: '请检查所有必填字段',
        variant: 'destructive'
      })
    }
  }

  const handleRequirementChange = (requirement: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      demoRequirements: checked
        ? [...(prev.demoRequirements || []), requirement as any]
        : (prev.demoRequirements || []).filter(r => r !== requirement)
    }))
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">创建演示数据</CardTitle>
        <CardDescription>
          填写以下信息，AI 将为您生成符合需求的 ONES 演示数据
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 公司名称 */}
          <div className="space-y-2">
            <Label htmlFor="companyName">公司名称 *</Label>
            <Input
              id="companyName"
              placeholder="请输入公司名称"
              value={formData.companyName || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
              disabled={isGenerating}
            />
          </div>

          {/* 项目模式 */}
          <div className="space-y-2">
            <Label htmlFor="projectModel">项目模式 *</Label>
            <Select
              value={formData.projectModel}
              onValueChange={(value) => setFormData(prev => ({ ...prev, projectModel: value as any }))}
              disabled={isGenerating}
            >
              <SelectTrigger>
                <SelectValue placeholder="请选择项目模式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="敏捷研发">敏捷研发</SelectItem>
                <SelectItem value="瀑布研发">瀑布研发</SelectItem>
                <SelectItem value="混合研发">混合研发</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 演示需求 */}
          <div className="space-y-3">
            <Label>演示需求 *</Label>
            <div className="space-y-2">
              {['路线图管理', '需求管理', '缺陷管理'].map((requirement) => (
                <div key={requirement} className="flex items-center space-x-2">
                  <Checkbox
                    id={requirement}
                    checked={(formData.demoRequirements || []).includes(requirement as any)}
                    onCheckedChange={(checked) => handleRequirementChange(requirement, !!checked)}
                    disabled={isGenerating}
                  />
                  <Label htmlFor={requirement}>{requirement}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* 业务形态 */}
          <div className="space-y-2">
            <Label htmlFor="businessType">业务形态 *</Label>
            <Select
              value={formData.businessType}
              onValueChange={(value) => setFormData(prev => ({ ...prev, businessType: value }))}
              disabled={isGenerating}
            >
              <SelectTrigger>
                <SelectValue placeholder="请选择业务形态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="互联网产品">互联网产品</SelectItem>
                <SelectItem value="企业软件">企业软件</SelectItem>
                <SelectItem value="移动应用">移动应用</SelectItem>
                <SelectItem value="电商平台">电商平台</SelectItem>
                <SelectItem value="金融科技">金融科技</SelectItem>
                <SelectItem value="教育科技">教育科技</SelectItem>
                <SelectItem value="其他">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 提交按钮 */}
          <Button
            type="submit"
            className="w-full"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              '开始生成 Demo'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

