# OAuth 调试指南

## 🚨 当前问题

授权完成后出现 `invalid_request` 错误，导致 MCP 连接失败。

## 📋 问题诊断

### 1. **检查授权 URL**
当前生成的授权 URL：
```
https://demo.ones.pro/mcp/oauth/authorize?response_type=code&client_id=5f1ff978-676e-4a93-b23e-2676babc937f&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Foauth%2Fcallback&state=...&code_challenge=...&code_challenge_method=S256
```

### 2. **配置检查**
- ✅ 客户端 ID: `5f1ff978-676e-4a93-b23e-2676babc937f`
- ✅ 重定向 URI: `http://localhost:3000/oauth/callback`
- ✅ PKCE 支持: S256
- ✅ MCP 配置文件已创建

### 3. **可能的解决方案**

#### **方案 A：检查客户端 ID 注册**
确认客户端 ID `5f1ff978-676e-4a93-b23e-2676babc937f` 在 ONES 服务器中是否正确注册了重定向 URI `http://localhost:3000/oauth/callback`。

#### **方案 B：使用不同的重定向 URI**
根据 MCP 文档，尝试使用以下重定向 URI：
- `http://localhost:33418/oauth/callback`
- `http://127.0.0.1:3000/oauth/callback`

#### **方案 C：检查 ONES 服务器状态**
确认 `https://demo.ones.pro/mcp` 服务器是否正常运行。

## 🔧 调试步骤

### 步骤 1：测试不同的重定向 URI
```bash
# 设置环境变量使用不同端口
export OAUTH_REDIRECT_URI=http://localhost:33418/oauth/callback

# 或使用 127.0.0.1
export OAUTH_REDIRECT_URI=http://127.0.0.1:3000/oauth/callback
```

### 步骤 2：检查服务器日志
查看 `/tmp/next-dev.log` 中的详细错误信息。

### 步骤 3：手动测试授权流程
1. 访问生成的授权 URL
2. 完成 ONES 登录
3. 观察回调 URL 中的参数

## 🚀 建议操作

1. **立即尝试**：使用 `http://127.0.0.1:3000/oauth/callback` 作为重定向 URI
2. **备选方案**：如果仍然失败，尝试端口 33418
3. **联系管理员**：如果问题持续，可能需要重新注册客户端 ID

## 📝 当前状态

- ✅ Node.js 已升级到 v22.19.0
- ✅ Next.js 服务器运行正常
- ✅ MCP 配置文件已创建
- ✅ OAuth 授权 URL 生成正常
- ❌ OAuth 回调出现 `invalid_request` 错误
