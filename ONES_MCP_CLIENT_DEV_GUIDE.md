# ONES MCP 客户端开发文档

> 本文档介绍如何在代码中连接和使用 ONES MCP Server，包括授权机制、API 调用、最佳实践等。

## 📚 目录

- [概述](#概述)
- [快速开始](#快速开始)
- [连接 ONES MCP Server](#连接-ones-mcp-server)
- [授权机制](#授权机制)
- [工具调用](#工具调用)
- [错误处理](#错误处理)
- [最佳实践](#最佳实践)
- [故障排除](#故障排除)
- [API 参考](#api-参考)

---

## 概述

### 什么是 ONES MCP？

ONES MCP (Model Context Protocol) 是一个基于标准化协议的接口，允许第三方应用通过工具（Tools）与 ONES 项目管理系统交互。MCP 协议遵循 JSON-RPC 2.0 规范，使用 Server-Sent Events (SSE) 进行响应传输。

### 核心特性

- ✅ **标准化协议**: 基于 MCP 2025-06-18 协议版本
- 🔐 **OAuth 2.0 认证**: 支持 RFC 9728 和 RFC 8414 标准
- 🛠️ **丰富的工具集**: 支持项目、工作项、评论、Wiki、工时等操作
- 📡 **SSE 响应格式**: 使用 Server-Sent Events 传输响应数据
- 🔄 **Token 刷新机制**: 自动处理访问令牌过期和刷新

### 前置要求

- **Node.js**: >= 18.17.0
- **TypeScript**: >= 5.0（推荐）
- **ONES 系统访问权限**: 需要有效的用户账户

---

## 快速开始

### 安装依赖

```bash
npm install zod  # 用于数据验证（可选）
```

### 最小化示例

```typescript
import { MCPClient } from './lib/mcp'

// 创建 MCP 客户端实例
const client = new MCPClient(
  'https://your-domain.com/openapi/mcp',  // MCP 服务器 URL
  'your-access-token'                      // OAuth 访问令牌
)

// 初始化连接
await client.initialize()

// 调用工具
const result = await client.callTool('get_project_list', {
  cursor: null
})

console.log(result)
```

---

## 连接 ONES MCP Server

### 1. 创建 MCP 客户端

```typescript
import { MCPClient } from './lib/mcp'

// 方式 1: 使用访问令牌
const client = new MCPClient(
  'https://your-domain.com/openapi/mcp',
  'your-access-token'
)

// 方式 2: 不带令牌（仅用于初始发现）
const discoveryClient = new MCPClient(
  'https://your-domain.com/openapi/mcp'
)
```

### 2. 初始化连接

```typescript
try {
  // 初始化会执行以下操作：
  // 1. 发送 initialize 方法请求
  // 2. 获取服务器信息
  // 3. 加载可用工具列表
  await client.initialize()
  
  console.log('✓ MCP 服务器已连接')
  console.log(`可用工具: ${client.getAvailableTools().length} 个`)
} catch (error) {
  console.error('连接失败:', error)
}
```

### 3. 获取服务器信息

```typescript
// 获取可用工具列表
const tools = client.getAvailableTools()

tools.forEach(tool => {
  console.log(`工具名称: ${tool.name}`)
  console.log(`描述: ${tool.description}`)
  console.log(`输入参数:`, tool.inputSchema)
})
```

### 4. 测试连接

```typescript
const testResult = await client.testConnection()

if (testResult.success) {
  console.log('✓', testResult.message)
} else {
  console.error('✗', testResult.message)
}
```

---

## 授权机制

ONES MCP Server 支持两种授权方式：

### 方式 1: OAuth 2.0 授权码流程（推荐）

OAuth 2.0 是最安全和推荐的授权方式，遵循 RFC 6749、RFC 9728 和 RFC 8414 标准。

#### 流程图

```
┌────────────┐                                           ┌──────────────┐
│  客户端应用 │                                           │ ONES 系统     │
└─────┬──────┘                                           └──────┬───────┘
      │                                                          │
      │ 1. 访问受保护资源（无令牌）                                │
      │─────────────────────────────────────────────────────────>│
      │                                                          │
      │ 2. 返回 401 + WWW-Authenticate header                    │
      │<─────────────────────────────────────────────────────────│
      │    （包含 resource_metadata URL）                         │
      │                                                          │
      │ 3. 请求受保护资源元数据                                    │
      │─────────────────────────────────────────────────────────>│
      │                                                          │
      │ 4. 返回资源元数据（包含授权服务器地址）                       │
      │<─────────────────────────────────────────────────────────│
      │                                                          │
      │ 5. 请求授权服务器元数据                                    │
      │─────────────────────────────────────────────────────────>│
      │                                                          │
      │ 6. 返回授权端点、令牌端点、注册端点                          │
      │<─────────────────────────────────────────────────────────│
      │                                                          │
      │ 7. 注册客户端（可选）                                       │
      │─────────────────────────────────────────────────────────>│
      │                                                          │
      │ 8. 返回 client_id                                        │
      │<─────────────────────────────────────────────────────────│
      │                                                          │
      │ 9. 重定向用户到授权页面                                     │
      │─────────────────────────────────────────────────────────>│
      │                                                          │
      │ 10. 用户登录并授权                                         │
      │                                                          │
      │ 11. 重定向回客户端（带授权码）                              │
      │<─────────────────────────────────────────────────────────│
      │                                                          │
      │ 12. 用授权码交换访问令牌                                    │
      │─────────────────────────────────────────────────────────>│
      │                                                          │
      │ 13. 返回访问令牌 + 刷新令牌                                │
      │<─────────────────────────────────────────────────────────│
      │                                                          │
      │ 14. 使用访问令牌访问受保护资源                              │
      │─────────────────────────────────────────────────────────>│
      │                                                          │
      │ 15. 返回数据                                              │
      │<─────────────────────────────────────────────────────────│
```

#### 代码示例

```typescript
import { MCPAuthClient } from './lib/mcp-auth'

// 1. 创建认证客户端
const authClient = new MCPAuthClient('https://your-domain.com')

// 2. 执行完整的授权流程
const authData = await authClient.authenticate()

console.log('请在浏览器中打开以下 URL 并完成授权:')
console.log(authData.authUrl)

// 3. 用户在浏览器中完成授权后，会重定向回你的回调地址
// 从回调 URL 中提取授权码
const urlParams = new URLSearchParams(window.location.search)
const code = urlParams.get('code')
const returnedState = urlParams.get('state')

// 4. 验证 state（防止 CSRF 攻击）
if (returnedState !== authData.state) {
  throw new Error('State mismatch - possible CSRF attack')
}

// 5. 用授权码交换访问令牌
const tokenData = await authClient.exchangeCodeForToken(
  code!,
  authData.codeVerifier,
  'http://localhost:3000/oauth/callback'  // 必须与注册时的 redirect_uri 一致
)

console.log('访问令牌:', tokenData.access_token)

// 6. 使用访问令牌创建 MCP 客户端
const mcpClient = new MCPClient(
  'https://your-domain.com/openapi/mcp',
  tokenData.access_token
)

await mcpClient.initialize()
```

#### OAuth 授权详细步骤

**步骤 1: 发现授权服务器**

```typescript
// 自动发现授权服务器元数据
const { resourceMetadata, serverMetadata } = await authClient.discoverAuthServer()

console.log('受保护资源:', resourceMetadata.resource)
console.log('授权服务器:', resourceMetadata.authorization_servers)
console.log('授权端点:', serverMetadata.authorization_endpoint)
console.log('令牌端点:', serverMetadata.token_endpoint)
```

**步骤 2: 注册客户端（首次使用）**

```typescript
// 动态注册客户端
const registration = await authClient.registerClient()

console.log('Client ID:', registration.client_id)
console.log('Redirect URIs:', registration.redirect_uris)

// 保存 client_id 以供后续使用
localStorage.setItem('mcp_client_id', registration.client_id)
```

**步骤 3: 生成授权 URL**

```typescript
// 生成带 PKCE 的授权 URL
const { url, state, codeVerifier } = await authClient.generateAuthUrl(
  'http://localhost:3000/oauth/callback'
)

// 保存 state 和 codeVerifier（用于后续验证）
sessionStorage.setItem('oauth_state', state)
sessionStorage.setItem('code_verifier', codeVerifier)

// 重定向用户到授权页面
window.location.href = url
```

**步骤 4: 处理授权回调**

```typescript
// 在回调页面（如 /oauth/callback）
const urlParams = new URLSearchParams(window.location.search)
const code = urlParams.get('code')
const state = urlParams.get('state')
const error = urlParams.get('error')

// 检查错误
if (error) {
  console.error('授权失败:', error)
  return
}

// 验证 state
const savedState = sessionStorage.getItem('oauth_state')
if (state !== savedState) {
  console.error('State 不匹配 - 可能的 CSRF 攻击')
  return
}

// 交换令牌
const codeVerifier = sessionStorage.getItem('code_verifier')!
const tokenData = await authClient.exchangeCodeForToken(
  code!,
  codeVerifier,
  window.location.origin + '/oauth/callback'
)

// 保存访问令牌
localStorage.setItem('mcp_access_token', tokenData.access_token)

// 清理临时数据
sessionStorage.removeItem('oauth_state')
sessionStorage.removeItem('code_verifier')
```

### 方式 2: Token 直接授权（简单但不推荐）

如果你已经通过其他方式获得了有效的访问令牌，可以直接使用：

```typescript
const client = new MCPClient(
  'https://your-domain.com/openapi/mcp',
  'your-existing-access-token'
)

await client.initialize()
```

⚠️ **注意**: 这种方式需要你自行管理令牌的刷新和过期处理。

### Token 刷新机制

访问令牌通常有过期时间，需要定期刷新：

```typescript
import { TokenRefreshManager } from './lib/token-refresh'

const refreshManager = new TokenRefreshManager({
  tokenEndpoint: 'https://your-domain.com/oauth2/token',
  clientId: 'your-client-id',
  refreshToken: 'your-refresh-token',
  onTokenRefreshed: (newTokenData) => {
    // 保存新的访问令牌
    localStorage.setItem('mcp_access_token', newTokenData.access_token)
    localStorage.setItem('mcp_refresh_token', newTokenData.refresh_token)
  }
})

// 自动刷新令牌（在过期前 5 分钟）
refreshManager.startAutoRefresh()
```

---

## 工具调用

### 可用工具概览

ONES MCP Server 提供以下类别的工具：

| 类别 | 工具示例 | 说明 |
|------|---------|------|
| **项目管理** | `create_new_project`, `get_project_list` | 创建和管理项目 |
| **工作项** | `create_new_issue`, `get_list_of_issues` | 创建和查询工作项 |
| **工作项类型** | `get_list_of_issue_types` | 获取工作项类型 |
| **评论** | `post_issue_comment`, `get_list_of_issue_comments` | 添加和获取评论 |
| **工时** | `add_workhour_in_simple_mode` | 记录工时 |
| **Wiki** | `create_page`, `get_space_list` | 创建和管理 Wiki 页面 |
| **工作流** | `execute_issue_workflow` | 执行工作流转换 |
| **用户** | `search_for_users` | 搜索用户 |

### 基本工具调用

```typescript
// 直接调用工具
const result = await client.callTool('tool_name', {
  param1: 'value1',
  param2: 'value2'
})

// 检查结果
if (result.ok) {
  console.log('成功:', result.result)
} else {
  console.error('失败:', result.error)
}
```

### 项目相关操作

#### 创建项目

```typescript
const result = await client.callTool('create_new_project', {
  name: '演示项目',
  templateID: 'project-t1',  // 敏捷模板
  members: null  // null 表示使用默认成员
})

if (result.ok) {
  const projectId = result.result.raw.project.uuid
  console.log('项目创建成功，ID:', projectId)
}
```

#### 获取项目列表

```typescript
const result = await client.callTool('get_project_list', {
  cursor: null  // null 表示获取第一页
})

if (result.ok) {
  const projects = result.result.raw.projects
  projects.forEach(project => {
    console.log(`项目: ${project.name} (${project.uuid})`)
  })
}
```

### 工作项相关操作

#### 获取工作项类型

```typescript
// 获取所有工作项类型
const typesResult = await client.callTool('get_list_of_issue_types', {
  cursor: null
})

if (typesResult.ok) {
  const issueTypes = typesResult.result.raw.issueTypes
  console.log('可用工作项类型:')
  issueTypes.forEach(type => {
    console.log(`- ${type.name} (${type.uuid})`)
  })
}
```

#### 创建工作项

```typescript
const result = await client.callTool('create_new_issue', {
  title: '实现新功能',
  projectID: 'project-uuid',
  issueTypeID: 'issue-type-uuid',
  assignee: 'user-uuid',  // 可选，负责人
  fieldValues: [
    {
      fieldID: 'field-uuid',
      type: 1,  // 文本类型
      value: '这是工作项的描述内容'
    }
  ],
  watchers: [],  // 关注者列表
  parentID: null  // 父工作项 ID（用于创建子任务）
})

if (result.ok) {
  const issueId = result.result.raw.issue.uuid
  console.log('工作项创建成功，ID:', issueId)
}
```

#### 创建子工作项

```typescript
const result = await client.callTool('create_new_issue', {
  title: '子任务：设计数据库',
  projectID: 'project-uuid',
  issueTypeID: 'subtask-type-uuid',
  assignee: 'user-uuid',
  fieldValues: [],
  parentID: 'parent-issue-uuid'  // 指定父工作项
})
```

#### 获取工作项列表

```typescript
const result = await client.callTool('get_list_of_issues', {
  projectID: 'project-uuid',
  cursor: null
})

if (result.ok) {
  const issues = result.result.raw.issues
  issues.forEach(issue => {
    console.log(`${issue.title} - ${issue.status}`)
  })
}
```

### 评论相关操作

#### 添加评论

```typescript
const result = await client.callTool('post_issue_comment', {
  issueID: 'issue-uuid',
  text: '这是一条评论内容',
  repliedMessageID: null  // 如果是回复评论，传入被回复评论的 ID
})

if (result.ok) {
  console.log('评论添加成功')
}
```

#### 获取评论列表

```typescript
const result = await client.callTool('get_list_of_issue_comments', {
  issueID: 'issue-uuid',
  cursor: null
})

if (result.ok) {
  const comments = result.result.raw.comments
  comments.forEach(comment => {
    console.log(`${comment.author}: ${comment.text}`)
  })
}
```

### 工时相关操作

#### 记录工时

```typescript
const result = await client.callTool('add_workhour_in_simple_mode', {
  issueID: 'issue-uuid',
  hours: 4.5,  // 工时（小时）
  description: '完成了功能开发',
  startTime: new Date().toISOString(),
  owner: null  // null 表示当前用户
})

if (result.ok) {
  console.log('工时记录成功')
}
```

### Wiki 相关操作

#### 获取 Wiki 空间列表

```typescript
const result = await client.callTool('get_space_list', {
  cursor: null
})

if (result.ok) {
  const spaces = result.result.raw.spaces
  spaces.forEach(space => {
    console.log(`Wiki 空间: ${space.name} (${space.uuid})`)
  })
}
```

#### 创建 Wiki 页面

```typescript
const result = await client.callTool('create_page', {
  parentPageID: 'parent-page-uuid',  // 父页面 ID
  title: '开发文档',
  content: `# 开发文档

## 概述

这是自动生成的 Wiki 页面。

## 详细内容

待补充...`
})

if (result.ok) {
  const pageId = result.result.raw.page.uuid
  console.log('Wiki 页面创建成功，ID:', pageId)
}
```

### 工作流相关操作

#### 获取可执行的工作流

```typescript
const result = await client.callTool('get_issue_executable_workflows', {
  issueID: 'issue-uuid'
})

if (result.ok) {
  const workflows = result.result.raw.workflows
  workflows.forEach(workflow => {
    console.log(`可用工作流: ${workflow.name}`)
  })
}
```

#### 执行工作流转换

```typescript
const result = await client.callTool('execute_issue_workflow', {
  issueID: 'issue-uuid',
  workflowID: 'workflow-uuid'
})

if (result.ok) {
  console.log('工作流执行成功')
}
```

### 智能任务执行

MCP 客户端提供了一个高级 API，可以根据任务类型自动选择合适的工具：

```typescript
// 自动选择工具并执行任务
const result = await client.executeTask('create_project', {
  name: '新项目',
  template: 'project-t1'
}, {
  // 可选的上下文信息
  userId: 'current-user-uuid'
})

if (result.ok) {
  console.log('任务执行成功')
}
```

支持的任务类型：
- `create_project` - 创建项目
- `create_issue` - 创建工作项
- `add_comment` - 添加评论
- `log_work` - 记录工时
- `create_wiki` - 创建 Wiki

---

## 错误处理

### 错误类型

MCP 客户端可能遇到以下类型的错误：

| 错误类型 | 说明 | 处理方式 |
|---------|------|---------|
| **网络错误** | DNS 解析失败、连接超时、连接被拒绝 | 重试、检查网络连接 |
| **认证错误** | HTTP 401、令牌过期、权限不足 | 重新授权、刷新令牌 |
| **参数错误** | HTTP 400、参数缺失或格式错误 | 检查参数格式 |
| **业务错误** | 资源不存在、操作不允许 | 检查业务逻辑 |
| **服务器错误** | HTTP 500、服务不可用 | 重试、联系管理员 |

### 错误处理示例

```typescript
import { retryToolCall } from './lib/mcp'

// 方式 1: 基本错误处理
try {
  const result = await client.callTool('create_new_issue', params)
  
  if (!result.ok) {
    console.error('工具调用失败:', result.error)
    
    // 根据错误类型处理
    if (result.error.includes('HTTP 401')) {
      // 令牌过期，需要重新授权
      await refreshToken()
    } else if (result.error.includes('timeout')) {
      // 超时错误，可以重试
      console.log('超时，正在重试...')
    }
  }
} catch (error) {
  console.error('发生异常:', error)
}

// 方式 2: 使用重试机制
const result = await retryToolCall(
  () => client.callTool('create_new_issue', params),
  2,        // 最多重试 2 次
  1000      // 初始延迟 1 秒（指数退避）
)

// 方式 3: 自定义错误处理
async function safeCallTool(toolName: string, params: any) {
  try {
    const result = await client.callTool(toolName, params)
    
    if (!result.ok) {
      // 记录错误日志
      logError({
        tool: toolName,
        params,
        error: result.error,
        timestamp: new Date().toISOString()
      })
      
      // 显示用户友好的错误消息
      showNotification({
        type: 'error',
        message: getUserFriendlyError(result.error)
      })
      
      return null
    }
    
    return result.result
  } catch (error) {
    // 处理未预期的异常
    console.error('Unexpected error:', error)
    return null
  }
}
```

### 常见错误及解决方案

#### 1. HTTP 401 Unauthorized

```
错误: MCP 错误: HTTP 401: Unauthorized
```

**原因**: 访问令牌无效或已过期

**解决方案**:
```typescript
// 刷新令牌
const newToken = await refreshAccessToken()

// 重新创建客户端
const client = new MCPClient(mcpUrl, newToken)
await client.initialize()
```

#### 2. DNS 解析失败

```
错误: DNS 解析失败，无法连接到 MCP 服务器
```

**原因**: 网络问题或服务器地址错误

**解决方案**:
- 检查服务器 URL 是否正确
- 验证网络连接
- 尝试使用 IP 地址代替域名

#### 3. 连接超时

```
错误: 连接超时: MCP 服务器响应时间过长
```

**原因**: 服务器响应慢或网络不稳定

**解决方案**:
```typescript
// 增加超时时间（修改 mcp.ts 中的超时配置）
const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 秒
```

#### 4. 工具不存在

```
错误: 工具 "xxx" 不存在
```

**原因**: 工具名称错误或服务器不支持该工具

**解决方案**:
```typescript
// 查看可用工具列表
const tools = client.getAvailableTools()
console.log('可用工具:', tools.map(t => t.name))
```

---

## 最佳实践

### 1. 令牌管理

```typescript
// ✅ 推荐：使用安全的存储方式
class SecureTokenStorage {
  private static readonly TOKEN_KEY = 'mcp_token'
  
  static saveToken(token: string, expiresIn: number) {
    const expiresAt = Date.now() + expiresIn * 1000
    
    // 在生产环境使用 httpOnly cookie 或加密存储
    localStorage.setItem(this.TOKEN_KEY, token)
    localStorage.setItem(`${this.TOKEN_KEY}_expires`, expiresAt.toString())
  }
  
  static getToken(): string | null {
    const token = localStorage.getItem(this.TOKEN_KEY)
    const expiresAt = localStorage.getItem(`${this.TOKEN_KEY}_expires`)
    
    if (!token || !expiresAt) return null
    
    // 检查是否过期
    if (Date.now() > parseInt(expiresAt)) {
      this.clearToken()
      return null
    }
    
    return token
  }
  
  static clearToken() {
    localStorage.removeItem(this.TOKEN_KEY)
    localStorage.removeItem(`${this.TOKEN_KEY}_expires`)
  }
}

// ❌ 不推荐：在代码中硬编码令牌
const token = 'hardcoded-token-123456'  // 不要这样做！
```

### 2. 连接复用

```typescript
// ✅ 推荐：复用客户端实例
class MCPClientManager {
  private static instance: MCPClient | null = null
  
  static async getClient(): Promise<MCPClient> {
    if (!this.instance) {
      const token = SecureTokenStorage.getToken()
      if (!token) {
        throw new Error('未授权: 请先完成 OAuth 授权流程')
      }
      
      this.instance = new MCPClient(
        process.env.ONES_MCP_URL!,
        token
      )
      await this.instance.initialize()
    }
    
    return this.instance
  }
  
  static resetClient() {
    this.instance = null
  }
}

// 使用
const client = await MCPClientManager.getClient()

// ❌ 不推荐：每次都创建新实例
async function doSomething() {
  const client = new MCPClient(url, token)  // 浪费资源
  await client.initialize()
  // ...
}
```

### 3. 批量操作

```typescript
// ✅ 推荐：批量处理，减少网络请求
async function createMultipleIssues(issues: IssueData[]) {
  const results = []
  
  // 并发执行（控制并发数）
  const concurrency = 5
  for (let i = 0; i < issues.length; i += concurrency) {
    const batch = issues.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(issue => client.callTool('create_new_issue', issue))
    )
    results.push(...batchResults)
    
    // 添加延迟，避免触发限流
    await delay(1000)
  }
  
  return results
}

// ❌ 不推荐：串行执行
async function createMultipleIssuesSlowly(issues: IssueData[]) {
  const results = []
  for (const issue of issues) {
    const result = await client.callTool('create_new_issue', issue)
    results.push(result)
  }
  return results
}
```

### 4. 错误日志

```typescript
// ✅ 推荐：详细的错误日志
class ErrorLogger {
  static log(error: any, context: Record<string, any>) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href
    }
    
    // 发送到日志服务
    console.error('MCP Error:', errorLog)
    
    // 生产环境：发送到服务器
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/log-error', {
        method: 'POST',
        body: JSON.stringify(errorLog)
      })
    }
  }
}

// 使用
try {
  await client.callTool('create_new_issue', params)
} catch (error) {
  ErrorLogger.log(error, {
    operation: 'create_issue',
    params: params
  })
}
```

### 5. 参数验证

```typescript
import { z } from 'zod'

// ✅ 推荐：在调用前验证参数
const CreateIssueSchema = z.object({
  title: z.string().min(1).max(200),
  projectID: z.string().uuid(),
  issueTypeID: z.string().uuid(),
  assignee: z.string().uuid().optional(),
  fieldValues: z.array(z.object({
    fieldID: z.string().uuid(),
    type: z.number(),
    value: z.any()
  }))
})

async function createIssue(data: any) {
  // 验证参数
  const validData = CreateIssueSchema.parse(data)
  
  // 调用 API
  return await client.callTool('create_new_issue', validData)
}

// ❌ 不推荐：直接传递未验证的数据
async function createIssueBad(data: any) {
  return await client.callTool('create_new_issue', data)  // 可能失败
}
```

### 6. 超时处理

```typescript
// ✅ 推荐：为长时间操作添加超时和进度提示
async function longRunningOperation() {
  const timeout = 30000  // 30 秒超时
  
  const operationPromise = client.callTool('some_long_operation', params)
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('操作超时')), timeout)
  )
  
  try {
    // 显示加载指示器
    showLoadingIndicator('正在处理，请稍候...')
    
    const result = await Promise.race([operationPromise, timeoutPromise])
    
    hideLoadingIndicator()
    return result
  } catch (error) {
    hideLoadingIndicator()
    if (error.message === '操作超时') {
      showNotification('操作超时，请稍后重试')
    }
    throw error
  }
}
```

---

## 故障排除

### 诊断工具

#### 1. 连接测试

```typescript
async function diagnoseConnection() {
  console.log('🔍 开始诊断 MCP 连接...\n')
  
  // 1. 检查令牌
  const token = SecureTokenStorage.getToken()
  console.log('✓ 令牌状态:', token ? '已设置' : '❌ 未设置')
  
  if (!token) {
    console.log('❌ 错误: 未找到访问令牌')
    console.log('解决方案: 请先完成 OAuth 授权流程')
    return
  }
  
  // 2. 测试网络连接
  console.log('\n🌐 测试网络连接...')
  try {
    const response = await fetch('https://your-domain.com')
    console.log('✓ 网络连接正常')
  } catch (error) {
    console.log('❌ 网络连接失败:', error.message)
    return
  }
  
  // 3. 测试 MCP 连接
  console.log('\n🔌 测试 MCP 服务器连接...')
  const client = new MCPClient('https://your-domain.com/openapi/mcp', token)
  
  const testResult = await client.testConnection()
  if (testResult.success) {
    console.log('✓', testResult.message)
    
    // 4. 列出可用工具
    console.log('\n🛠️ 可用工具:')
    const tools = client.getAvailableTools()
    tools.forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.name}`)
    })
  } else {
    console.log('❌', testResult.message)
  }
}

// 运行诊断
diagnoseConnection()
```

#### 2. 工具测试

```typescript
async function testTool(toolName: string, params: any) {
  console.log(`\n🧪 测试工具: ${toolName}`)
  console.log('参数:', JSON.stringify(params, null, 2))
  
  const startTime = Date.now()
  
  try {
    const result = await client.callTool(toolName, params)
    const duration = Date.now() - startTime
    
    console.log(`✓ 执行成功 (耗时: ${duration}ms)`)
    console.log('结果:', JSON.stringify(result, null, 2))
    
    return result
  } catch (error) {
    const duration = Date.now() - startTime
    console.log(`❌ 执行失败 (耗时: ${duration}ms)`)
    console.error('错误:', error)
    
    return null
  }
}

// 测试项目列表工具
await testTool('get_project_list', { cursor: null })
```

### 常见问题

#### Q1: 为什么初始化总是失败？

**A**: 检查以下几点：
1. 服务器 URL 是否正确（应该是 `https://your-domain.com/openapi/mcp`）
2. 访问令牌是否有效（可以使用 `testConnection()` 验证）
3. 网络是否畅通
4. 是否有防火墙或代理阻止连接

```typescript
// 详细的初始化日志
try {
  console.log('正在连接到:', client.baseUrl)
  await client.initialize()
} catch (error) {
  console.error('初始化失败:', error)
  
  // 尝试不带令牌连接（检查服务器可达性）
  const testClient = new MCPClient(client.baseUrl)
  try {
    await testClient.initialize()
    console.log('服务器可达，但认证失败 - 请检查令牌')
  } catch (e) {
    console.log('服务器不可达 - 请检查 URL 和网络')
  }
}
```

#### Q2: 工具调用返回 "工具不存在" 错误？

**A**: 这可能是由于：
1. 工具名称拼写错误
2. 服务器版本不支持该工具

```typescript
// 查找正确的工具名称
const tools = client.getAvailableTools()
const matchingTools = tools.filter(t => 
  t.name.toLowerCase().includes('project') ||
  t.description.toLowerCase().includes('project')
)

console.log('匹配的工具:')
matchingTools.forEach(tool => {
  console.log(`- ${tool.name}: ${tool.description}`)
})
```

#### Q3: OAuth 授权流程卡在回调页面？

**A**: 检查：
1. redirect_uri 是否与注册时一致
2. state 参数是否正确传递
3. 授权码是否在 URL 参数中

```typescript
// 在回调页面添加调试信息
console.log('当前 URL:', window.location.href)
console.log('URL 参数:', Object.fromEntries(new URLSearchParams(window.location.search)))

const params = new URLSearchParams(window.location.search)
console.log('code:', params.get('code'))
console.log('state:', params.get('state'))
console.log('error:', params.get('error'))
```

#### Q4: 令牌刷新失败？

**A**: 可能的原因：
1. refresh_token 已过期
2. token_endpoint 配置错误
3. client_id 不匹配

```typescript
// 调试令牌刷新
async function debugTokenRefresh(refreshToken: string) {
  const tokenEndpoint = 'https://your-domain.com/oauth2/token'
  const clientId = 'your-client-id'
  
  console.log('Token Endpoint:', tokenEndpoint)
  console.log('Client ID:', clientId)
  console.log('Refresh Token:', refreshToken.substring(0, 20) + '...')
  
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken
  })
  
  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    })
    
    console.log('响应状态:', response.status)
    const data = await response.json()
    console.log('响应数据:', data)
    
    if (!response.ok) {
      console.error('刷新失败:', data.error_description || data.error)
    }
    
    return data
  } catch (error) {
    console.error('请求失败:', error)
  }
}
```

---

## API 参考

### MCPClient 类

#### 构造函数

```typescript
constructor(baseUrl: string, token?: string)
```

**参数**:
- `baseUrl`: MCP 服务器 URL（如 `https://your-domain.com/openapi/mcp`）
- `token`: 可选的访问令牌

#### 方法

##### initialize()

初始化客户端连接并加载工具列表。

```typescript
async initialize(): Promise<void>
```

**抛出**: 连接失败时抛出错误

##### getAvailableTools()

获取可用工具列表。

```typescript
getAvailableTools(): MCPTool[]
```

**返回**: 工具数组

##### callTool()

调用指定的工具。

```typescript
async callTool(toolName: string, args: Record<string, any>): Promise<ToolResult>
```

**参数**:
- `toolName`: 工具名称
- `args`: 工具参数

**返回**: 工具执行结果

##### executeTask()

智能任务执行（自动选择工具）。

```typescript
async executeTask(
  taskType: string,
  args: Record<string, any>,
  context?: any
): Promise<ToolResult>
```

**参数**:
- `taskType`: 任务类型
- `args`: 参数
- `context`: 可选的上下文信息

##### testConnection()

测试连接状态。

```typescript
async testConnection(): Promise<{ success: boolean; message: string }>
```

**返回**: 连接测试结果

### MCPAuthClient 类

#### 构造函数

```typescript
constructor(baseUrl: string)
```

**参数**:
- `baseUrl`: ONES 系统的基础 URL（如 `https://your-domain.com`）

#### 方法

##### authenticate()

执行完整的 OAuth 授权流程。

```typescript
async authenticate(): Promise<{
  authUrl: string
  state: string
  codeVerifier: string
  clientId: string
}>
```

**返回**: 授权 URL 和相关参数

##### discoverAuthServer()

发现授权服务器元数据。

```typescript
async discoverAuthServer(): Promise<{
  resourceMetadata: ProtectedResourceMetadata
  serverMetadata: OAuthServerMetadata
}>
```

##### registerClient()

注册 OAuth 客户端。

```typescript
async registerClient(): Promise<ClientRegistration>
```

##### generateAuthUrl()

生成授权 URL。

```typescript
async generateAuthUrl(redirectUri?: string): Promise<{
  url: string
  state: string
  codeVerifier: string
}>
```

##### exchangeCodeForToken()

用授权码交换访问令牌。

```typescript
async exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{ access_token: string; token_type: string }>
```

### 类型定义

#### MCPTool

```typescript
interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties: Record<string, any>
    required?: string[]
  }
}
```

#### ToolResult

```typescript
interface ToolResult {
  ok: boolean
  result?: {
    id: string
    raw: any
  }
  error?: string
}
```

#### OAuthServerMetadata

```typescript
interface OAuthServerMetadata {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  registration_endpoint?: string
  response_types_supported: string[]
  code_challenge_methods_supported?: string[]
}
```

---

## 附录

### A. 环境变量配置

在 `.env.local` 文件中配置以下变量：

```env
# ONES MCP Server Configuration
ONES_MCP_SERVER_URL=https://your-domain.com/openapi/mcp
ONES_MCP_SERVER_TOKEN=your-access-token-here

# OAuth Configuration (可选)
ONES_OAUTH_CLIENT_ID=your-client-id
ONES_OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback

# Development
NODE_ENV=development
```

### B. 完整示例

查看以下完整示例：

- **基础示例**: `/examples/basic-usage.ts`
- **OAuth 流程**: `/examples/oauth-flow.ts`
- **批量操作**: `/examples/batch-operations.ts`
- **错误处理**: `/examples/error-handling.ts`

### C. 相关链接

- [MCP 协议规范](https://spec.modelcontextprotocol.io/)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [OAuth 2.0 Protected Resource Metadata RFC 9728](https://tools.ietf.org/html/rfc9728)
- [OAuth 2.0 Authorization Server Metadata RFC 8414](https://tools.ietf.org/html/rfc8414)
- [ONES 官方文档](https://docs.ones.com/)

### D. 更新日志

#### v1.0.0 (2025-11-12)
- ✨ 初始版本发布
- 📝 完整的开发文档
- 🔐 OAuth 2.0 授权支持
- 🛠️ 基础工具调用功能

---

## 📞 获取帮助

如果您在使用过程中遇到问题：

1. 查看[故障排除](#故障排除)章节
2. 运行[诊断工具](#诊断工具)
3. 查看项目 Issues: [GitHub Issues](https://github.com/xuxun-ONES/onesMCP/issues)
4. 联系技术支持

---

**最后更新**: 2025-11-12  
**文档版本**: 1.0.0  
**适用 MCP 版本**: 2025-06-18
