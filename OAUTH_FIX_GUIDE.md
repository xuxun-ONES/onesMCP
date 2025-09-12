# OAuth `invalid_request` 错误修复指南

## 🔍 问题诊断

根据服务器日志分析，发现 ONES 服务器返回了 `invalid_request` 错误：
```
/api/oauth/callback?error=invalid_request&state=0a9~.4o547KkB7DNL22rOWfQTt216ovF
```

## 🛠 已实施的修复

### 1. 回调 URL 路径修复
**问题**：使用了 `/api/oauth/callback` 而不是标准的 `/oauth/callback`
**修复**：
- 创建了新的回调路由：`/app/oauth/callback/route.ts`
- 更新了 OAuth 配置中的 `redirectUri`：
  ```typescript
  redirectUri: 'http://localhost:3000/oauth/callback'  // 之前是 /api/oauth/callback
  ```

### 2. Scope 参数修复
**问题**：包含了可能不被支持的 `scope` 参数
**修复**：
- 移除了 `scope: 'mcp:read mcp:write'` 参数
- 更新了授权 URL 生成逻辑，只在需要时才包含 scope

### 3. 参数格式优化
**修复前的 URL**：
```
https://demo.ones.pro/mcp/oauth/authorize?response_type=code&client_id=5f1ff978-676e-4a93-b23e-2676babc937f&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Foauth%2Fcallback&scope=mcp%3Aread+mcp%3Awrite&state=...&code_challenge=...&code_challenge_method=S256
```

**修复后的 URL**：
```
https://demo.ones.pro/mcp/oauth/authorize?response_type=code&client_id=5f1ff978-676e-4a93-b23e-2676babc937f&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Foauth%2Fcallback&state=...&code_challenge=...&code_challenge_method=S256
```

## 🧪 测试步骤

1. **生成新的授权 URL**：
   ```bash
   curl -X POST http://localhost:3000/api/oauth/authorize -H "Content-Type: application/json" -s | jq -r '.authUrl'
   ```

2. **在浏览器中访问授权 URL**：
   - 复制生成的 URL
   - 在浏览器中打开
   - 完成 ONES 登录和授权

3. **验证回调处理**：
   - 授权成功后应自动重定向到 `http://localhost:3000/oauth/callback`
   - 然后重定向到设置页面并显示成功消息
   - 检查 MCP 配置是否已更新令牌

## 📋 预期结果

授权成功后：
1. ✅ 不再出现 `invalid_request` 错误
2. ✅ 成功获取访问令牌
3. ✅ 令牌自动存储到 MCP 配置
4. ✅ 重定向到设置页面显示成功消息
5. ✅ MCP 连接测试通过

## 🔧 文件变更

- ✅ 创建：`/app/oauth/callback/route.ts`
- ✅ 修改：`/lib/oauth.ts` (redirectUri 和 scope)
- ✅ 保留：`/app/api/oauth/callback/route.ts` (作为备用)

## 🚀 下一步

现在请重新测试 OAuth 授权流程：
1. 访问设置页面：`http://localhost:3000/settings`
2. 点击"🔐 ONES 授权登录"按钮
3. 在 ONES 系统中完成登录和授权
4. 验证是否成功获取令牌并完成 MCP 连接

如果仍有问题，请检查浏览器开发者工具的网络选项卡和服务器日志以获取更多详细信息。




