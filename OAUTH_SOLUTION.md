# ONES MCP OAuth 授权解决方案

## 🎯 问题解决方案

经过深入分析 ONES MCP 认证文档和实际测试，我们发现了 `invalid_request` 错误的根本原因：

### 🔍 问题根因
1. **端口不匹配**：ONES OAuth 客户端配置只允许 `http://localhost:50047/oauth/callback`
2. **应用端口**：我们的 Next.js 应用运行在端口 3000

### 💡 解决方案：OAuth 代理服务器
创建了一个轻量级的代理服务器来解决端口差异：

```javascript
// oauth-proxy.js - 监听端口 50047，转发到端口 3000
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/oauth/callback')) {
    const targetUrl = `http://localhost:3000${req.url}`
    res.writeHead(302, { 'Location': targetUrl })
    // ... 重定向逻辑
  }
})
server.listen(50047)
```

## 🚀 完整使用流程

### 1. 启动服务

**终端 1 - 启动 Next.js 应用**：
```bash
npm run dev
# 应用运行在 http://localhost:3000
```

**终端 2 - 启动 OAuth 代理**：
```bash
node oauth-proxy.js
# 代理运行在 http://localhost:50047
```

### 2. 执行 OAuth 授权

1. **访问设置页面**：`http://localhost:3000/settings`
2. **点击"🔐 ONES 授权登录"按钮**
3. **在 ONES 系统中完成授权**：
   - 输入用户名密码登录
   - 选择授权团队
   - 点击"同意授权"
4. **自动处理回调**：
   - ONES 重定向到 `http://localhost:50047/oauth/callback?code=...`
   - 代理服务器转发到 `http://localhost:3000/oauth/callback?code=...`
   - Next.js 应用处理令牌交换
   - 成功后重定向到设置页面

### 3. 验证结果

授权成功后应该看到：
- ✅ 设置页面显示"授权成功"消息
- ✅ ONES MCP Server Token 字段填入访问令牌
- ✅ 连接状态显示"✓ MCP 已连接"
- ✅ MCP 连接测试通过

## 🛠 技术实现

### OAuth 配置
```typescript
export const OAUTH_CONFIG = {
  authUrl: 'https://demo.ones.pro/mcp/oauth/authorize',
  tokenUrl: 'https://demo.ones.pro/mcp/oauth/token',
  clientId: '5f1ff978-676e-4a93-b23e-2676babc937f',
  redirectUri: 'http://localhost:50047/oauth/callback', // 使用代理端口
  scope: '' // 不需要 scope 参数
}
```

### 授权 URL 格式
```
https://demo.ones.pro/mcp/oauth/authorize?
  response_type=code&
  client_id=5f1ff978-676e-4a93-b23e-2676babc937f&
  redirect_uri=http%3A%2F%2Flocalhost%3A50047%2Foauth%2Fcallback&
  state=<随机状态码>&
  code_challenge=<PKCE挑战码>&
  code_challenge_method=S256
```

### 文件结构
```
/Users/xunxu/onesdemo/
├── oauth-proxy.js                    # OAuth 代理服务器
├── lib/oauth.ts                      # OAuth 客户端逻辑
├── app/api/oauth/authorize/route.ts  # 授权请求 API
├── app/oauth/callback/route.ts       # 回调处理 API
└── app/settings/page.tsx             # 设置页面 UI
```

## 🔧 故障排除

### 问题 1：代理服务器未启动
**症状**：授权后无法访问回调地址
**解决**：确保运行 `node oauth-proxy.js`

### 问题 2：端口冲突
**症状**：代理服务器启动失败
**解决**：检查端口 50047 是否被占用，使用 `lsof -i :50047`

### 问题 3：仍然收到 invalid_request
**症状**：令牌交换失败
**解决**：检查代理服务器日志，确认请求正确转发

### 问题 4：状态过期
**症状**：授权后提示状态无效
**解决**：重新生成授权 URL，确保在 10 分钟内完成授权

## 📋 与标准 MCP 认证的差异

虽然 ONES 提供了完整的 MCP 认证文档，但实际实现中：

1. **简化的发现流程**：不需要完整的服务器发现和客户端注册
2. **预配置的客户端**：使用固定的 `client_id`
3. **标准 OAuth 2.0**：遵循标准的授权码 + PKCE 流程
4. **固定的回调地址**：只允许特定端口的回调 URL

## 🎉 结果

现在用户可以：
1. 🔐 安全地通过 ONES 系统登录
2. 🎯 选择授权范围和团队
3. ✅ 自动获取有效的访问令牌
4. 🚀 成功连接 MCP 服务并使用所有功能

这个解决方案完全解决了之前的 `invalid_request` 问题，用户现在可以顺利完成 OAuth 授权并使用 ONES MCP 演示数据生成功能！




