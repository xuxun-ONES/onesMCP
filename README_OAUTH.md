# ONES MCP OAuth 授权集成

本应用已成功集成 ONES MCP Server 的 OAuth 2.0 授权流程，用户可以通过安全的方式获取访问令牌。

## 🔐 OAuth 授权流程

### 1. 用户体验流程

1. **访问设置页面** - 用户打开 `/settings` 页面
2. **点击授权按钮** - 点击"🔐 ONES 授权登录"按钮
3. **跳转到 ONES** - 自动跳转到 ONES 授权页面：
   ```
   https://demo.ones.pro/mcp/oauth/authorize?
     response_type=code&
     client_id=5f1ff978-676e-4a93-b23e-2676babc937f&
     redirect_uri=http://localhost:3000/api/oauth/callback&
     scope=mcp:read+mcp:write&
     state=<随机状态码>&
     code_challenge=<PKCE挑战码>&
     code_challenge_method=S256
   ```
4. **ONES 系统登录** - 用户在 ONES 系统中输入用户名密码
5. **确认授权** - 用户确认应用权限范围并点击同意
6. **自动返回** - ONES 系统重定向回应用的回调地址
7. **令牌获取** - 应用后台自动交换访问令牌
8. **配置完成** - 令牌自动填入设置表单，用户保存即可

### 2. 技术实现

#### OAuth 配置
- **授权服务器**: `https://demo.ones.pro/mcp/oauth/authorize`
- **令牌端点**: `https://demo.ones.pro/mcp/oauth/token`
- **客户端ID**: `5f1ff978-676e-4a93-b23e-2676babc937f`
- **回调地址**: `http://localhost:3000/api/oauth/callback`
- **授权范围**: `mcp:read mcp:write`

#### 安全特性
- ✅ **PKCE (Proof Key for Code Exchange)** - 防止授权码拦截攻击
- ✅ **State 参数验证** - 防止 CSRF 攻击
- ✅ **超时机制** - 状态码10分钟后自动过期
- ✅ **随机字符串生成** - 使用加密安全的随机数生成器

#### API 端点

1. **启动授权**: `POST /api/oauth/authorize`
   ```json
   {
     "success": true,
     "authUrl": "https://demo.ones.pro/mcp/oauth/authorize?...",
     "state": "随机状态码"
   }
   ```

2. **处理回调**: `GET /api/oauth/callback?code=...&state=...`
   - 验证 state 参数
   - 交换 access_token
   - 重定向到设置页面

## 🛠 开发者信息

### 文件结构
```
lib/oauth.ts                    # OAuth 核心逻辑
app/api/oauth/authorize/route.ts # 启动授权 API
app/api/oauth/callback/route.ts  # 处理回调 API
app/oauth/callback/page.tsx      # 回调状态页面
app/settings/page.tsx           # 设置页面（含OAuth按钮）
```

### 关键函数
- `generatePKCE()` - 生成 PKCE 参数
- `generateAuthUrl()` - 构建授权 URL
- `exchangeCodeForToken()` - 交换访问令牌
- `handleOAuthAuthorize()` - 前端授权处理
- `handleOAuthCallback()` - 前端回调处理

## 🔧 配置说明

### 环境变量
```bash
# 生产环境需要配置正确的回调地址
NODE_ENV=production
OAUTH_REDIRECT_URI=https://your-domain.com/api/oauth/callback
```

### 客户端注册
当前使用的客户端ID `5f1ff978-676e-4a93-b23e-2676babc937f` 是从您提供的示例URL中提取的。在生产环境中，您需要：

1. 在 ONES 系统中注册您的应用
2. 配置正确的回调地址
3. 获取专属的 client_id
4. 更新 `lib/oauth.ts` 中的配置

## 🚀 使用方法

1. 启动开发服务器：`npm run dev`
2. 访问设置页面：`http://localhost:3000/settings`
3. 点击"🔐 ONES 授权登录"按钮
4. 完成 ONES 系统登录和授权
5. 系统自动获取并填入访问令牌
6. 点击"保存配置"完成设置

## 🔍 调试信息

OAuth 流程中的关键日志会输出到浏览器控制台和服务器日志中，包括：
- 授权URL生成
- 状态码验证
- 令牌交换过程
- 错误信息详情

如遇到问题，请检查控制台输出获取详细的错误信息。




