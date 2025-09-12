# API Key 配置指南

## 🔑 Anthropic API Key 配置

### 1. 获取 Anthropic API Key

1. **访问 Anthropic Console**
   - 打开 [https://console.anthropic.com/](https://console.anthropic.com/)
   - 使用邮箱注册或登录账户

2. **创建 API Key**
   - 在控制台中找到 "API Keys" 或 "Keys" 部分
   - 点击 "Create Key" 或 "New Key" 按钮
   - 为 API Key 设置一个描述性名称（如："ONES Demo Generator"）
   - 复制生成的 API Key（格式：`sk-ant-api03-...`）

3. **重要提醒**
   - ⚠️ API Key 只会显示一次，请立即复制并保存
   - 🔒 不要在公共场所或代码中暴露 API Key
   - 💰 使用 API 会产生费用，请查看 Anthropic 的定价

### 2. 在应用中配置 API Key

1. **打开设置页面**
   - 在应用中点击 "设置" 或访问 `/settings` 页面

2. **选择 AI 服务提供商**
   - 选择 "Anthropic" 选项

3. **输入 API Key**
   - 在 "Anthropic API Key" 输入框中粘贴您的 API Key
   - 确保 API Key 格式正确（以 `sk-ant-api03-` 开头）

4. **保存设置**
   - 点击 "保存设置" 按钮
   - 看到 "✓ 已保存" 标签确认成功

## 🔄 OpenAI API Key 配置（备选方案）

如果您暂时无法获取 Anthropic API Key，也可以使用 OpenAI：

### 1. 获取 OpenAI API Key

1. **访问 OpenAI Platform**
   - 打开 [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - 登录您的 OpenAI 账户

2. **创建 API Key**
   - 点击 "Create new secret key"
   - 设置名称并复制 API Key（格式：`sk-...`）

### 2. 配置 OpenAI API Key

1. 在设置页面选择 "OpenAI"
2. 输入您的 OpenAI API Key
3. 保存设置

## 🚨 常见问题

### API Key 无效错误

**错误信息**：`401 Invalid API key format` 或 `Anthropic API Key 无效`

**解决方案**：
1. 检查 API Key 格式是否正确
2. 确认 API Key 没有过期
3. 验证账户是否有足够的余额
4. 重新生成新的 API Key

### API Key 未配置错误

**错误信息**：`Anthropic API Key 未配置`

**解决方案**：
1. 在设置页面配置有效的 API Key
2. 确保选择了正确的 AI 服务提供商
3. 检查 API Key 是否正确保存

### 配额不足错误

**错误信息**：`Anthropic API 配额不足`

**解决方案**：
1. 检查 Anthropic 账户余额
2. 添加付款方式或充值
3. 查看使用限制和定价

## 💡 使用建议

1. **API Key 安全**
   - 定期轮换 API Key
   - 不要在代码中硬编码 API Key
   - 监控 API 使用情况

2. **成本控制**
   - 设置使用限制
   - 监控每月费用
   - 选择合适的模型

3. **备用方案**
   - 配置多个 AI 服务提供商
   - 准备备用 API Key
   - 了解各服务的特点和定价

## 📞 获取帮助

如果您在配置过程中遇到问题：

1. **查看错误信息**：应用会提供详细的错误描述
2. **检查网络连接**：确保能访问 Anthropic/OpenAI 服务
3. **查看官方文档**：
   - [Anthropic API 文档](https://docs.anthropic.com/)
   - [OpenAI API 文档](https://platform.openai.com/docs/)
4. **联系支持**：如果问题持续存在，请联系相应服务的技术支持
