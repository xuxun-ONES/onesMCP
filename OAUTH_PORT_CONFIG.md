# OAuth 端口配置说明

## 📖 参考文档

根据 `app/api/mcp/ONES MCP 认证.md` 文档，ONES MCP 服务器支持多种重定向 URI 配置。

## 🔧 支持的端口配置

### 1. **默认配置（当前使用）**
```
http://localhost:3000/oauth/callback
```
- ✅ Next.js 默认开发端口
- ✅ 无需额外配置

### 2. **MCP 文档建议配置**
```
http://localhost:33418/oauth/callback
http://127.0.0.1:33418/oauth/callback
```
- 📖 参考文档中的示例端口
- 🔧 需要修改开发服务器端口

### 3. **其他支持的配置**
```
http://localhost/oauth/callback
http://127.0.0.1/oauth/callback
```
- 🔧 需要使用 80 端口（可能需要管理员权限）

## ⚙️ 配置方法

### 方法1：环境变量配置
创建 `.env.local` 文件：
```bash
OAUTH_REDIRECT_URI=http://localhost:33418/oauth/callback
```

### 方法2：修改开发端口
在 `package.json` 中修改：
```json
{
  "scripts": {
    "dev": "next dev -p 33418"
  }
}
```

## 🚨 重要提醒

1. **客户端 ID 匹配**：确保重定向 URI 与 ONES 服务器注册的客户端 ID (`5f1ff978-676e-4a93-b23e-2676babc937f`) 匹配

2. **端口一致性**：开发服务器端口必须与 OAuth 重定向 URI 中的端口一致

3. **生产环境**：生产环境需要使用 HTTPS 和正确的域名

## 🔄 当前实现

代码已优化为支持环境变量配置：
```typescript
redirectUri: process.env.NODE_ENV === 'production' 
  ? 'https://your-app-domain.com/oauth/callback'
  : process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/oauth/callback'
```

## 📝 建议

- **开发环境**：使用默认的 3000 端口，简单可靠
- **特殊需求**：如需使用 MCP 文档建议的 33418 端口，设置 `OAUTH_REDIRECT_URI` 环境变量
- **测试验证**：修改端口后，记得重新测试 OAuth 授权流程
