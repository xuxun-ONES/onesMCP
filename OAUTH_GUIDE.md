# ONES MCP OAuth 授权指南

## 🚨 重要说明

您遇到的"MCP 连接失败"问题是因为需要通过 **真实的 OAuth 授权流程** 获取有效的访问令牌。测试令牌无法通过 ONES 服务器的认证。

## 📋 完整授权流程

### 1. 获取授权 URL


当前已为您生成的授权 URL：
```
https://demo.ones.pro/mcp/oauth/authorize?response_type=code&client_id=5f1ff978-676e-4a93-b23e-2676babc937f&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Foauth%2Fcallback&scope=mcp%3Aread+mcp%3Awrite&state=Ksl-K2J05iPfaRfvhOJ56PRsIBBs%7Euoh&code_challenge=g1RNLz6_MlTPASfwCnYe5wDC-34ndYConMC6_4cq_M8&code_challenge_method=S256
```

### 2. 用户操作步骤

1. **复制上面的 URL** 并在浏览器中打开
2. **登录 ONES 系统**：
   - 输入您的 ONES 用户名和密码
   - 如果没有账户，请联系 ONES 管理员
3. **选择授权团队**：
   - 选择您要授权的 ONES 团队/组织
   - 确认授权范围：`mcp:read mcp:write`
4. **点击"同意/授权"按钮**
5. **等待自动重定向**：
   - 系统会自动跳转回 `http://localhost:3000/api/oauth/callback`
   - 后台会自动交换访问令牌
   - 最终重定向到设置页面

### 3. 预期结果

授权成功后，您应该看到：
- 设置页面显示"授权成功"消息
- ONES MCP Server Token 字段自动填入访问令牌
- 连接状态显示为"✓ MCP 已连接"

## 🔧 故障排除

### 问题 1：授权页面无法访问
**解决方案**：
- 检查网络连接
- 确认 `demo.ones.pro` 服务器可访问
- 联系 ONES 管理员确认服务器状态

### 问题 2：登录失败
**解决方案**：
- 确认用户名密码正确
- 联系 ONES 管理员重置密码或创建账户
- 确认账户有访问 MCP 服务的权限

### 问题 3：授权后仍然连接失败
**解决方案**：
- 检查浏览器控制台是否有错误
- 确认回调 URL `http://localhost:3000/api/oauth/callback` 可访问
- 重新生成授权 URL 并重试

### 问题 4：令牌过期
**解决方案**：
- 重新执行完整的 OAuth 授权流程
- 获取新的访问令牌

## 🛠 开发者调试

如果需要调试授权流程，可以：

1. **检查 OAuth 状态存储**：
```bash
cat .tmp/oauth-states.json
```

2. **检查 MCP 配置**：
```bash
curl -s http://localhost:3000/api/mcp | jq .
```

3. **生成新的授权 URL**：
```bash
curl -X POST http://localhost:3000/api/oauth/authorize -H "Content-Type: application/json" -s | jq -r '.authUrl'
```

## 📞 获取帮助

如果您在授权过程中遇到问题，请：
1. 联系 ONES 系统管理员获取账户和权限
2. 确认 MCP 服务器配置正确
3. 检查网络连接和防火墙设置

---

**注意**：本应用仅用于演示目的。在生产环境中，请确保使用安全的令牌存储机制。
