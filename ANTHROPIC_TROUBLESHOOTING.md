# Anthropic Claude 模型故障排除指南

## 当前问题

系统在尝试使用Anthropic Claude模型时遇到"Invalid model name"错误，这表明当前使用的模型名称可能已经不可用。

## 可能的原因

1. **模型已弃用**：Anthropic定期更新和弃用模型
2. **API访问限制**：某些模型可能需要特定的账户等级
3. **地区限制**：某些地区可能无法访问特定模型
4. **API Key权限**：您的API Key可能没有访问某些模型的权限

## 解决方案

### 方案1：检查Anthropic控制台

1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 检查您的账户状态和可用模型
3. 确认您的API Key权限
4. 查看是否有可用的模型更新

### 方案2：切换回OpenAI（推荐）

如果Anthropic模型暂时不可用，您可以切换回OpenAI：

1. 在设置页面选择"OpenAI"
2. 输入您的OpenAI API Key
3. 保存设置

OpenAI模型（GPT-4o, GPT-4o-mini）目前稳定可用。

### 方案3：等待模型更新

Anthropic可能正在更新其模型列表。您可以：

1. 稍后重试
2. 关注Anthropic的官方更新
3. 检查模型弃用通知

## 技术细节

当前系统尝试的模型列表：
- claude-3-5-sonnet-20241022
- claude-3-5-haiku-20241022
- claude-3-opus-20240229
- claude-3-sonnet-20240229
- claude-3-haiku-20240307

如果这些模型都返回404或"Invalid model name"错误，说明它们可能已经不可用。

## 联系支持

如果问题持续存在，请：
1. 联系Anthropic支持团队
2. 检查Anthropic的状态页面
3. 查看官方文档的最新更新

## 临时解决方案

在Anthropic模型问题解决之前，建议使用OpenAI作为主要的AI服务提供商。
