'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

interface Settings {
  openaiApiKey: string
  anthropicApiKey: string
  aiProvider: 'openai' | 'anthropic'
  onesMcpServerUrl: string
}

interface MCPStatus {
  serverUrl: string
  hasToken: boolean
  isConnected: boolean
  availableTools: Array<{ name: string; description: string }>
}

function SettingsPageContent() {
  const [formData, setFormData] = useState<Settings>({
    openaiApiKey: '',
    anthropicApiKey: '',
    aiProvider: 'anthropic',
    onesMcpServerUrl: 'https://demo.ones.pro/mcp'
  })
  
  const [mcpStatus, setMcpStatus] = useState<MCPStatus>({
    serverUrl: '',
    hasToken: false,
    isConnected: false,
    availableTools: []
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle')
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  // 处理 OAuth 回调结果
  const handleOAuthCallback = async () => {
    const oauthSuccess = searchParams.get('oauth_success')
    const oauthError = searchParams.get('oauth_error')
    
    if (oauthSuccess === 'true') {
      toast({
        title: '授权成功',
        description: '已成功获取访问令牌，MCP连接已配置',
        variant: 'default'
      })
      
      // 清理 URL 参数
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('oauth_success')
      window.history.replaceState({}, '', newUrl.toString())
      
      // 自动测试连接
      setTimeout(() => handleTestConnection(), 1000)
    } else if (oauthError) {
      toast({
        title: '授权失败',
        description: decodeURIComponent(oauthError),
        variant: 'destructive'
      })
      
      // 清理 URL 参数
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('oauth_error')
      window.history.replaceState({}, '', newUrl.toString())
    }
  }

  // 浏览器端测试连接
  const handleTestBrowserConnection = async () => {
    try {
      const serverUrl = formData.onesMcpServerUrl
      
      toast({
        title: '浏览器端连接测试',
        description: (
          <div className="space-y-2">
            <p>请打开浏览器开发者工具 (F12) 查看测试结果</p>
            <div className="text-xs bg-blue-50 p-2 rounded border border-blue-200">
              <p className="font-medium text-blue-800">测试步骤：</p>
              <ol className="list-decimal list-inside text-blue-700 mt-1">
                <li>按 F12 打开开发者工具</li>
                <li>切换到 Console 标签页</li>
                <li>查看自动运行的连接测试结果</li>
              </ol>
            </div>
          </div>
        ),
        variant: 'default'
      })
      
      // 在控制台运行测试代码
      const testCode = `
// ONES 服务器连接测试
(async function testOnesConnection() {
  const serverUrl = '${serverUrl}';
  console.log('🚀 开始测试 ONES 服务器连接:', serverUrl);
  
  const testUrls = [
    { name: '主页面', url: serverUrl },
    { name: 'OAuth 授权服务器', url: serverUrl + '/.well-known/oauth-authorization-server/mcp' },
    { name: 'MCP 端点', url: serverUrl + '/mcp' },
    { name: '健康检查', url: serverUrl + '/api/health' }
  ];
  
  const results = [];
  
  for (const test of testUrls) {
    try {
      console.log('🔍 测试:', test.name, '-', test.url);
      const startTime = Date.now();
      
      const response = await fetch(test.url, { 
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json, text/html, */*',
          'User-Agent': 'ONES-MCP-Client/1.0'
        }
      });
      
      const duration = Date.now() - startTime;
      const result = {
        name: test.name,
        url: test.url,
        status: response.status,
        statusText: response.statusText,
        success: response.ok,
        duration: duration + 'ms'
      };
      
      results.push(result);
      console.log('✅', test.name, '成功 -', 'Status:', response.status, response.statusText, '(' + duration + 'ms)');
      
    } catch (error) {
      const result = {
        name: test.name,
        url: test.url,
        success: false,
        error: error.message,
        errorType: error.name
      };
      
      results.push(result);
      console.log('❌', test.name, '失败 -', error.name + ':', error.message);
    }
  }
  
  console.log('📊 测试结果汇总:', results);
  
  const analysis = {
    serverReachable: results.some(r => r.success),
    oauthSupported: results.some(r => r.name === 'OAuth 授权服务器' && r.success),
    mcpEndpointAvailable: results.some(r => r.name === 'MCP 端点' && r.success),
    successCount: results.filter(r => r.success).length,
    totalCount: results.length
  };
  
  console.log('🎯 分析结果:', analysis);
  
  if (analysis.serverReachable) {
    console.log('🎉 服务器可访问！');
    if (analysis.oauthSupported) {
      console.log('🔐 OAuth 授权支持正常');
    }
    if (analysis.mcpEndpointAvailable) {
      console.log('🔗 MCP 端点可用');
    }
  } else {
    console.log('⚠️ 服务器无法访问，请检查网络连接和服务器地址');
  }
  
  return { results, analysis };
})();`
      
      // 在控制台执行测试代码
      console.log(testCode)
      eval(testCode)
      
    } catch (error) {
      toast({
        title: '测试失败',
        description: error instanceof Error ? error.message : '浏览器端测试失败',
        variant: 'destructive'
      })
    }
  }

  // 测试 ONES 服务器连接
  const handleTestOnesConnection = async () => {
    setIsTestingConnection(true)
    
    try {
      const response = await fetch('/api/test-ones-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl: formData.onesMcpServerUrl })
      })
      
      const data = await response.json()
      
      if (data.success) {
        const { analysis, results } = data
        
        if (analysis.serverReachable) {
          toast({
            title: '连接测试成功',
            description: (
              <div className="space-y-2">
                <p>✅ 服务器可访问</p>
                {analysis.oauthSupported && <p>✅ OAuth 授权支持</p>}
                {analysis.mcpEndpointAvailable && <p>✅ MCP 端点可用</p>}
                {analysis.recommendations.length > 0 && (
                  <div className="text-xs bg-yellow-50 p-2 rounded border border-yellow-200">
                    <p className="font-medium text-yellow-800">注意事项：</p>
                    {analysis.recommendations.map((rec, i) => (
                      <p key={i} className="text-yellow-700">• {rec}</p>
                    ))}
                  </div>
                )}
              </div>
            ),
            variant: 'default'
          })
        } else {
          throw new Error('服务器无法访问')
        }
      } else {
        throw new Error(data.error || '连接测试失败')
      }
    } catch (error) {
      toast({
        title: 'ONES 服务器连接失败',
        description: (
          <div className="space-y-2">
            <p>{error instanceof Error ? error.message : '连接测试失败'}</p>
            <div className="text-xs bg-red-50 p-2 rounded border border-red-200">
              <p className="font-medium text-red-800">请检查：</p>
              <ul className="list-disc list-inside text-red-700 mt-1">
                <li>服务器地址是否正确</li>
                <li>网络连接是否正常</li>
                <li>ONES 系统是否运行</li>
                <li>MCP 功能是否已启用</li>
              </ul>
            </div>
          </div>
        ),
        variant: 'destructive'
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  // 初始化 OAuth 授权流程
  const handleOAuthAuthorize = async () => {
    setOauthLoading(true)
    
    try {
      console.log('开始 OAuth 授权流程...')
      
      const response = await fetch('/api/oauth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      console.log('OAuth 授权响应:', data)
      
      if (data.success && data.authUrl) {
        console.log('跳转到授权URL:', data.authUrl)
        // 跳转到 ONES 授权页面
        window.location.href = data.authUrl
      } else {
        throw new Error(data.error || '授权请求失败')
      }
    } catch (error) {
      console.error('OAuth 授权错误:', error)
      
      const errorMessage = error instanceof Error ? error.message : '授权请求失败'
      
      toast({
        title: 'ONES 授权失败',
        description: (
          <div className="space-y-2">
            <p>{errorMessage}</p>
            {errorMessage.includes('demo.ones.pro') && (
              <div className="text-xs bg-yellow-50 p-2 rounded border border-yellow-200">
                <p className="font-medium text-yellow-800">可能的解决方案：</p>
                <ul className="list-disc list-inside text-yellow-700 mt-1">
                  <li>检查网络连接</li>
                  <li>确认 ONES 服务器地址是否正确</li>
                  <li>联系管理员确认服务器状态</li>
                </ul>
              </div>
            )}
          </div>
        ),
        variant: 'destructive'
      })
    } finally {
      setOauthLoading(false)
    }
  }

  // 加载当前设置
  const loadSettings = async () => {
    try {
      // 加载MCP设置
      const mcpResponse = await fetch('/api/mcp')
      const mcpData = await mcpResponse.json()
      
      setMcpStatus({
        ...mcpData,
        availableTools: mcpData.availableTools || []
      })
      
      // 加载应用设置
      const settingsResponse = await fetch('/api/settings')
      const settingsData = await settingsResponse.json()
      
      if (settingsData.success) {
        setFormData(prev => ({
          ...prev,
          onesMcpServerUrl: mcpData.serverUrl || 'https://demo.ones.pro/mcp',
          // 如果有保存的API Key，显示占位符；否则显示空字符串
          openaiApiKey: settingsData.settings.hasOpenaiApiKey ? settingsData.settings.openaiApiKey : '',
          anthropicApiKey: settingsData.settings.hasAnthropicApiKey ? settingsData.settings.anthropicApiKey : '',
          aiProvider: settingsData.settings.aiProvider || 'anthropic'
        }))
      } else {
        setFormData(prev => ({
          ...prev,
          onesMcpServerUrl: mcpData.serverUrl || 'https://demo.ones.pro/mcp'
        }))
      }
      
      if (mcpData.isConnected) {
        setConnectionStatus('connected')
      }
    } catch (error) {
      console.error('加载设置失败:', error)
    }
  }

  // 测试连接
  const handleTestConnection = async () => {
    setIsTesting(true)
    setConnectionStatus('testing')
    
    try {
      const response = await fetch('/api/mcp', { method: 'PATCH' })
      const result = await response.json()
      
      if (result.success) {
        setConnectionStatus('connected')
        toast({
          title: '连接成功',
          description: result.message || 'MCP 服务器连接正常',
          variant: 'default'
        })
        
        // 重新加载状态以获取工具列表
        await loadSettings()
      } else {
        setConnectionStatus('error')
        toast({
          title: '连接失败',
          description: result.message || '无法连接到 MCP 服务器',
          variant: 'destructive'
        })
      }
    } catch (error) {
      setConnectionStatus('error')
      toast({
        title: '连接失败',
        description: error instanceof Error ? error.message : '连接测试失败',
        variant: 'destructive'
      })
    } finally {
      setIsTesting(false)
    }
  }

  // 保存设置
  const handleSave = async () => {
    setIsLoading(true)
    
    try {
      // 构建要更新的设置对象
      const settingsUpdate: any = {
        aiProvider: formData.aiProvider
      }
      
      // 只有当API Key不是占位符时才包含在更新中
      if (formData.openaiApiKey && formData.openaiApiKey !== '••••••••••••••••') {
        settingsUpdate.openaiApiKey = formData.openaiApiKey
      }
      
      if (formData.anthropicApiKey && formData.anthropicApiKey !== '••••••••••••••••') {
        settingsUpdate.anthropicApiKey = formData.anthropicApiKey
      }
      
      // 保存应用设置（AI API Keys）
      const settingsResponse = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsUpdate)
      })

      if (!settingsResponse.ok) {
        throw new Error('保存应用设置失败')
      }

      // 保存 MCP 配置
      const mcpResponse = await fetch('/api/mcp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl: formData.onesMcpServerUrl
        })
      })

      if (!mcpResponse.ok) {
        throw new Error('保存MCP配置失败')
      }

      toast({
        title: '设置已保存',
        description: '所有配置已成功更新',
        variant: 'default'
      })
      
      // 重新加载状态
      await loadSettings()
    } catch (error) {
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '保存设置失败',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
    handleOAuthCallback()
  }, [])

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'testing': return '🔄'
      case 'connected': return '✅'
      case 'error': return '❌'
      default: return '⚪'
    }
  }

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'testing': return 'MCP 连接测试中'
      case 'connected': return 'MCP 已连接'
      case 'error': return 'MCP 连接失败'
      default: return 'MCP 未连接'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* 导航头部 */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/" 
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                返回首页
              </Link>
              <div className="w-px h-4 bg-border"></div>
              <h1 className="text-xl font-semibold">设置</h1>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">系统配置</h2>
          <p className="text-muted-foreground mt-2">配置 API 密钥和服务器连接以开始使用</p>
        </div>

        {/* AI 服务配置 */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              AI 服务配置
            </CardTitle>
            <CardDescription>
              选择 AI 服务提供商并配置相应的 API Key 来生成演示数据计划
              <br />
              <span className="text-xs text-blue-600 mt-1 inline-block">
                💡 系统将优先使用 Anthropic，如不可用则自动回退到 OpenAI
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* AI 提供商选择 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">AI 服务提供商</Label>
              <div className="grid grid-cols-2 gap-3">
                <div 
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.aiProvider === 'anthropic' 
                      ? 'border-purple-500 bg-purple-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setFormData({ ...formData, aiProvider: 'anthropic' })}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-purple-100 rounded flex items-center justify-center">
                      <span className="text-purple-600 font-bold text-xs">A</span>
                    </div>
                    <div>
                      <div className="font-medium text-sm">Anthropic</div>
                      <div className="text-xs text-muted-foreground">Claude 模型</div>
                    </div>
                  </div>
                </div>
                <div 
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.aiProvider === 'openai' 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setFormData({ ...formData, aiProvider: 'openai' })}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
                      <span className="text-green-600 font-bold text-xs">O</span>
                    </div>
                    <div>
                      <div className="font-medium text-sm">OpenAI</div>
                      <div className="text-xs text-muted-foreground">GPT 模型</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Anthropic API Key */}
            {formData.aiProvider === 'anthropic' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Anthropic API Key</Label>
                  {formData.anthropicApiKey === '••••••••••••••••' && (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">✓ 已保存</span>
                  )}
                </div>
                <input
                  type="password"
                  placeholder="sk-ant-..."
                  value={formData.anthropicApiKey}
                  onChange={(e) => setFormData({ ...formData, anthropicApiKey: e.target.value })}
                  className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                />
                <p className="text-xs text-muted-foreground">
                  从 <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-800 hover:underline font-medium">Anthropic Console</a> 获取 API Key
                  {formData.anthropicApiKey === '••••••••••••••••' && (
                    <span className="ml-2 text-green-600">• 留空以保持当前设置</span>
                  )}
                  {!formData.anthropicApiKey && (
                    <span className="ml-2 text-blue-600">• 需要有效的API Key才能使用Claude模型</span>
                  )}
                </p>
              </div>
            )}

            {/* OpenAI API Key */}
            {formData.aiProvider === 'openai' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">OpenAI API Key</Label>
                  {formData.openaiApiKey === '••••••••••••••••' && (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">✓ 已保存</span>
                  )}
                </div>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={formData.openaiApiKey}
                  onChange={(e) => setFormData({ ...formData, openaiApiKey: e.target.value })}
                  className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                />
                <p className="text-xs text-muted-foreground">
                  从 <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-800 hover:underline font-medium">OpenAI 平台</a> 获取 API Key
                  {formData.openaiApiKey === '••••••••••••••••' && (
                    <span className="ml-2 text-green-600">• 留空以保持当前设置</span>
                  )}
                  {!formData.openaiApiKey && (
                    <span className="ml-2 text-blue-600">• 需要有效的API Key才能使用GPT模型</span>
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ONES MCP 设置 */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <CardTitle className="text-lg">ONES MCP 服务器配置</CardTitle>
                  <CardDescription className="mt-1">
                    配置 ONES MCP 服务器连接以创建演示数据
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-gray-100">
                {getConnectionStatusIcon()} 
                <span>{getConnectionStatusText()}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">ONES MCP Server URL</Label>
              <input
                type="url"
                placeholder="https://demo.ones.pro/mcp"
                value={formData.onesMcpServerUrl}
                onChange={(e) => setFormData({ ...formData, onesMcpServerUrl: e.target.value })}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">ONES MCP 授权</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOAuthAuthorize}
                  disabled={oauthLoading}
                  className="text-xs px-3 py-1.5"
                >
                  {oauthLoading ? '授权中...' : '🔐 ONES 授权登录'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground bg-blue-50 p-3 rounded-lg border border-blue-100">
                💡 点击上方按钮进行ONES系统OAuth 2.0授权，系统将自动获取和管理访问令牌
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex gap-2">
                <Button 
                  onClick={handleTestOnesConnection} 
                  disabled={isTestingConnection} 
                  variant="outline"
                  size="sm"
                  className="text-xs px-3 py-1.5"
                >
                  {isTestingConnection ? '测试中...' : '🌐 服务器测试'}
                </Button>
                <Button 
                  onClick={handleTestBrowserConnection} 
                  disabled={!formData.onesMcpServerUrl}
                  variant="outline"
                  size="sm"
                  className="text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                >
                  🔍 浏览器测试
                </Button>
                <Button 
                  onClick={handleTestConnection} 
                  disabled={isTesting} 
                  variant="outline"
                  className="flex-1"
                >
                  {isTesting ? '测试中...' : '🔗 测试连接'}
                </Button>
              </div>
              <div className="text-xs text-gray-500">
                💡 浏览器测试直接从您的浏览器访问服务器，可以避免网络环境差异问题
              </div>
            </div>

            {mcpStatus.availableTools && mcpStatus.availableTools.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-green-100 rounded flex items-center justify-center">
                    <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <Label className="text-sm font-medium text-green-700">
                    可用工具 ({mcpStatus.availableTools.length})
                  </Label>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-h-40 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {mcpStatus.availableTools.map((tool, index) => (
                      <div key={index} className="bg-white rounded-md p-3 border border-green-100">
                        <div className="font-medium text-sm text-gray-900">{tool.name}</div>
                        {tool.description && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{tool.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
        </CardContent>
      </Card>

        {/* 使用说明 */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              使用说明
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                OAuth 授权流程
              </h4>
              <ol className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-medium">1</span>
                  点击"🔍 浏览器测试"确认ONES服务器可访问（推荐）
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-medium">2</span>
                  点击"ONES 授权登录"按钮
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-medium">3</span>
                  在 ONES 系统中输入用户名和密码
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-medium">4</span>
                  选择要授权的团队
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-medium">5</span>
                  点击"同意授权"
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center text-xs font-medium">6</span>
                  系统自动获取访问令牌并返回
                </li>
              </ol>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                注意事项
              </h4>
              <ul className="space-y-2 text-sm text-amber-800">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  OpenAI API Key 将用于生成演示数据计划
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  ONES MCP Token 需要有相应的项目和工作项权限
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  测试连接成功后才能开始生成演示数据
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  所有配置信息都保存在本地，不会上传到服务器
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 保存按钮 */}
        <div className="flex justify-center pt-4">
          <Button 
            onClick={handleSave} 
            disabled={isLoading}
            size="lg"
            className="px-8 py-3 text-base font-medium"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                保存中...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                保存设置
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-6"><p>加载中...</p></div>}>
      <SettingsPageContent />
    </Suspense>
  )
}
