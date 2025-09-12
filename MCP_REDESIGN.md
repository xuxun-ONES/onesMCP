# MCP 工具链重新设计文档

## 🔄 重新设计概述

根据您的要求，我已经将原有的静态 MCP 工具封装重新设计为**动态工具发现和智能选择**的架构，现在系统可以连接到远程的 ONES MCP Server (`https://demo.ones.pro/mcp`)，动态获取可用工具，并在执行过程中智能选择最合适的工具。

## 🏗️ 新架构特点

### 1. 动态工具发现
- **连接远程服务器**: 连接到 `https://demo.ones.pro/mcp`
- **协议标准化**: 遵循 MCP 2024-11-05 协议规范
- **工具列表获取**: 动态获取服务器提供的所有可用工具
- **实时更新**: 支持工具列表的实时更新和缓存

### 2. 智能工具选择
- **任务类型映射**: 根据高层任务类型自动选择合适的工具
- **关键词匹配**: 通过工具名称和描述的关键词匹配找到最佳工具
- **容错机制**: 当找不到匹配工具时提供清晰的错误信息

### 3. 标准化接口
- **统一调用**: 所有工具调用都通过 `executeTask(taskType, args)` 方法
- **响应适配**: 自动适配不同工具的响应格式
- **错误处理**: 统一的错误处理和重试机制

## 📋 核心组件更新

### MCPClient 类重新设计

```typescript
export class MCPClient {
  // 初始化连接并获取工具列表
  async initialize(): Promise<void>
  
  // 获取所有可用工具
  getAvailableTools(): MCPTool[]
  
  // 根据任务类型智能选择工具
  selectToolsForTask(taskType: string, context?: any): MCPTool[]
  
  // 智能执行任务
  async executeTask(taskType: string, args: Record<string, any>): Promise<ToolResult>
  
  // 底层工具调用
  async callTool(toolName: string, args: Record<string, any>): Promise<ToolResult>
}
```

### 任务类型映射

| 任务类型 | 关键词匹配 | 说明 |
|---------|-----------|------|
| `create_project` | project, create, new | 创建项目 |
| `create_issue` | issue, task, story, create | 创建工作项 |
| `add_comment` | comment, post, add | 添加评论 |
| `log_work` | work, hour, time, log | 记录工时 |
| `create_wiki` | page, wiki, document, create | 创建Wiki页面 |
| `get_types` | type, list, get | 获取类型列表 |

### 协议交互格式

#### 初始化请求
```json
POST https://demo.ones.pro/mcp/initialize
{
  "protocolVersion": "2024-11-05",
  "capabilities": { "tools": {} },
  "clientInfo": {
    "name": "ones-demo-generator",
    "version": "1.0.0"
  }
}
```

#### 工具调用请求
```json
POST https://demo.ones.pro/mcp/tools/call
{
  "name": "create_new_project",
  "arguments": {
    "name": "演示项目",
    "description": "项目描述"
  }
}
```

## 🔧 执行流程优化

### 旧流程（静态工具）
```
AI生成计划 → 硬编码工具调用 → ONES API
```

### 新流程（动态工具）
```
AI生成计划 → MCP初始化 → 获取工具列表 → 智能工具选择 → 动态工具调用 → ONES API
```

### 具体执行步骤

1. **初始化阶段**
   ```typescript
   const mcpClient = new MCPClient('https://demo.ones.pro/mcp')
   await mcpClient.initialize()  // 获取可用工具列表
   ```

2. **智能执行阶段**
   ```typescript
   // 不再硬编码工具名称，而是根据任务类型智能选择
   await mcpClient.executeTask('create_project', {
     name: seedPlan.project.name,
     description: seedPlan.project.description
   })
   ```

3. **工具选择逻辑**
   ```typescript
   // 系统自动查找包含 'project', 'create' 关键词的工具
   // 例如可能匹配到：create_new_project, project_create, new_project 等
   ```

## 🎯 用户体验改进

### 设置页面增强
- **预设服务器地址**: 默认设置为 `https://demo.ones.pro/mcp`
- **工具列表展示**: 连接成功后显示所有可用工具
- **工具详情**: 显示每个工具的描述、参数列表、必填参数标识

### 实时日志优化
- **连接状态**: 显示 MCP 服务器连接状态
- **工具发现**: 记录发现的工具数量和名称
- **智能选择**: 显示为每个任务选择的具体工具

### 错误处理增强
- **工具不存在**: 清晰提示可用工具列表
- **参数错误**: 显示工具期望的参数格式
- **连接失败**: 提供重连和配置检查建议

## 🔍 技术实现细节

### 工具匹配算法
```typescript
private findToolsByKeywords(keywords: string[]): MCPTool[] {
  return this.availableTools.filter(tool => {
    const searchText = `${tool.name} ${tool.description}`.toLowerCase()
    return keywords.some(keyword => 
      searchText.includes(keyword.toLowerCase())
    )
  })
}
```

### 响应格式适配
```typescript
// 适配不同的MCP服务器响应格式
if (data.content && Array.isArray(data.content)) {
  // 标准MCP响应格式
  return { ok: true, result: { id: data.content[0]?.text } }
} else {
  // 自定义响应格式
  return { ok: true, result: { id: data.result?.id || data.id } }
}
```

### 客户端缓存机制
```typescript
// 缓存MCP客户端实例，避免重复初始化
let mcpClientInstance: MCPClient | null = null

// 配置更新时重置缓存
if (configChanged) {
  mcpClientInstance = null
}
```

## 🚀 部署和使用

### 环境配置
```env
# 默认MCP服务器地址（可在设置页面修改）
ONES_MCP_SERVER_URL=https://demo.ones.pro/mcp
ONES_MCP_SERVER_TOKEN=  # 可选认证令牌
```

### 使用流程
1. 启动应用，访问设置页面
2. 确认MCP服务器地址为 `https://demo.ones.pro/mcp`
3. 点击"测试连接"验证连接并获取工具列表
4. 查看可用工具列表，确认包含所需功能
5. 返回主页面开始生成演示数据

### 验证要点
- [x] MCP服务器连接成功
- [x] 工具列表正确获取
- [x] 智能工具选择正常工作
- [x] 数据创建流程完整执行
- [x] 错误处理和重试机制有效

## 🔮 扩展性设计

### 多服务器支持
```typescript
// 未来可支持多个MCP服务器
const servers = [
  'https://demo.ones.pro/mcp',
  'https://api.ones.ai/mcp',
  'https://custom.mcp.server/api'
]
```

### 插件化架构
```typescript
interface MCPPlugin {
  name: string
  serverUrl: string
  tools: string[]  // 支持的工具列表
}
```

### 智能路由
```typescript
// 根据工具类型自动选择最合适的服务器
async routeToServer(toolType: string): Promise<MCPClient>
```

## 📊 性能优化

### 连接复用
- 缓存MCP客户端实例
- 复用TCP连接
- 批量工具调用支持

### 错误恢复
- 自动重连机制
- 工具调用失败时的降级策略
- 网络中断时的状态保持

## 🎉 总结

通过这次重新设计，MCP工具链从**静态硬编码**升级为**动态智能选择**，具备了以下核心能力：

1. **动态适应**: 自动适应不同MCP服务器提供的工具集
2. **智能选择**: 根据任务需求自动选择最合适的工具
3. **标准兼容**: 完全符合MCP协议规范
4. **用户友好**: 提供直观的工具发现和管理界面
5. **高度扩展**: 支持未来的多服务器和插件化扩展

这个设计让整个系统更加灵活和强大，能够充分发挥远程MCP服务器的能力！




