# AI 服务提供商优先级策略

## 🎯 **智能选择逻辑**

系统现在采用智能的AI服务提供商选择策略，**始终优先使用 Anthropic Claude 模型**，确保最佳的生成质量。

### 📋 **选择优先级**

1. **第一优先级：Anthropic Claude** 🥇
   - 如果配置了有效的 Anthropic API Key，系统将使用 Claude 模型
   - 无论用户界面中选择了哪个提供商，都会优先使用 Anthropic

2. **第二优先级：OpenAI GPT** 🥈
   - 仅在 Anthropic API Key 不可用时使用
   - 作为可靠的备用方案

3. **无可用服务** ❌
   - 如果两个 API Key 都未配置，系统将提示用户配置

### 🔄 **自动回退机制**

```
配置检查流程：
┌─────────────────┐
│ 检查 Anthropic  │ ──✅──► 使用 Claude 模型
│    API Key      │
└─────────────────┘
         │ ❌
         ▼
┌─────────────────┐
│ 检查 OpenAI     │ ──✅──► 使用 GPT 模型  
│    API Key      │
└─────────────────┘
         │ ❌
         ▼
┌─────────────────┐
│   提示用户      │
│  配置 API Key   │
└─────────────────┘
```

### 💡 **使用场景示例**

#### **场景1：只配置 Anthropic**
```
用户配置：
- Anthropic API Key: ✅ 已配置
- OpenAI API Key: ❌ 未配置
- UI选择: OpenAI

系统行为：
✅ 使用 Anthropic Claude（忽略UI选择）
📝 日志: "选择AI服务 Anthropic，原因：Anthropic API Key可用，优先使用"
```

#### **场景2：只配置 OpenAI**
```
用户配置：
- Anthropic API Key: ❌ 未配置  
- OpenAI API Key: ✅ 已配置
- UI选择: Anthropic

系统行为：
✅ 使用 OpenAI GPT（自动回退）
📝 日志: "选择AI服务 OpenAI，原因：Anthropic不可用，回退到OpenAI"
```

#### **场景3：两个都配置**
```
用户配置：
- Anthropic API Key: ✅ 已配置
- OpenAI API Key: ✅ 已配置  
- UI选择: OpenAI

系统行为：
✅ 使用 Anthropic Claude（优先级策略）
📝 日志: "选择AI服务 Anthropic，原因：Anthropic API Key可用，优先使用"
```

#### **场景4：都未配置**
```
用户配置：
- Anthropic API Key: ❌ 未配置
- OpenAI API Key: ❌ 未配置

系统行为：
❌ 返回错误提示
📝 错误: "未配置有效的AI API Key。请在设置页面配置 Anthropic 或 OpenAI API Key。"
```

### 🎨 **用户界面说明**

#### **设置页面提示**
```
AI 服务配置
选择 AI 服务提供商并配置相应的 API Key 来生成演示数据计划
💡 系统将优先使用 Anthropic，如不可用则自动回退到 OpenAI
```

#### **状态指示**
- ✅ **Anthropic 已配置**：显示"✓ 已保存"，系统将使用此服务
- ✅ **OpenAI 已配置**：显示"✓ 已保存"，作为备用服务
- ❌ **未配置**：显示"需要有效的API Key才能使用XXX模型"

### 📊 **日志和监控**

系统会记录详细的选择日志：

```javascript
// 成功选择 Anthropic
{
  "provider": "Anthropic", 
  "reason": "Anthropic API Key可用，优先使用"
}

// 回退到 OpenAI
{
  "provider": "OpenAI", 
  "reason": "Anthropic不可用，回退到OpenAI"
}

// 生成完成日志
{
  "providerUsed": "anthropic",
  "model": "claude-3-5-haiku-20241022",
  "duration": "3.2s"
}
```

### 🔧 **技术实现**

#### **选择逻辑代码**
```typescript
// 智能选择AI Provider：优先使用Anthropic
let selectedProvider = apiConfig.aiProvider
let selectedApiKey = ''

if (apiConfig.anthropicApiKey) {
  selectedProvider = 'anthropic'
  selectedApiKey = apiConfig.anthropicApiKey
  await logger.info('选择AI服务', { 
    provider: 'Anthropic', 
    reason: 'Anthropic API Key可用，优先使用' 
  })
} else if (apiConfig.openaiApiKey) {
  selectedProvider = 'openai'
  selectedApiKey = apiConfig.openaiApiKey
  await logger.info('选择AI服务', { 
    provider: 'OpenAI', 
    reason: 'Anthropic不可用，回退到OpenAI' 
  })
} else {
  // 返回错误
}
```

### 🎯 **最佳实践建议**

1. **推荐配置**：
   - 主要使用：配置 Anthropic API Key
   - 备用方案：同时配置 OpenAI API Key

2. **成本优化**：
   - Anthropic Claude 通常提供更好的生成质量
   - OpenAI GPT 可作为成本较低的备用选项

3. **监控使用**：
   - 查看日志了解实际使用的服务
   - 监控两个服务的API使用情况和费用

4. **故障恢复**：
   - 如果 Anthropic 服务不可用，系统会自动使用 OpenAI
   - 无需手动切换，保证服务连续性

### ⚠️ **注意事项**

1. **UI 选择vs实际使用**：
   - UI中的选择主要用于配置管理
   - 实际使用遵循优先级策略，可能与UI选择不同

2. **API Key 验证**：
   - 系统只检查API Key是否存在，不验证有效性
   - 无效的API Key会在实际调用时报错

3. **费用控制**：
   - 两个服务都可能产生费用
   - 建议设置使用限制和监控

这种智能选择策略确保了系统始终使用最优的AI服务，同时提供了可靠的备用方案。
