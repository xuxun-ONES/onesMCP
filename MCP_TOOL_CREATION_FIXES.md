# MCP 工具调用修复报告

## 🎯 **问题诊断**

### **原始问题**
用户报告：虽然系统提示 MCP 工具调用成功，但 ONES 系统中并没有成功创建数据。例如系统提示"创建项目成功"，但 ONES 中没看到该项目。

### **根本原因分析**
通过日志分析发现了以下关键问题：

1. **错误的工具选择**：
   ```
   执行任务 "create_project" 使用工具: create_new_issue  ❌
   ```
   系统错误地使用了 `create_new_issue` 工具来创建项目，而不是正确的 `create_new_project` 工具。

2. **关键词匹配不准确**：
   - `create_project` 任务使用关键词 `['project', 'create', 'new']` 匹配
   - 由于 `create_new_issue` 也包含 `create` 和 `new` 关键词，被错误选择

3. **API 参数不匹配**：
   - 项目创建传递了不支持的 `description` 参数
   - 工作项创建缺少必需的 `fieldValues`、`assignee`、`watchers` 参数

## 🔧 **实施的修复**

### **1. 精确工具选择** ✅

**修复前**（关键词匹配）：
```typescript
case 'create_project':
  selectedTools.push(...this.findToolsByKeywords(['project', 'create', 'new']))
  break
```

**修复后**（精确匹配）：
```typescript
case 'create_project':
  // 直接指定正确的工具名称
  const createProjectTool = this.availableTools.find(tool => tool.name === 'create_new_project')
  if (createProjectTool) {
    selectedTools.push(createProjectTool)
  }
  break
```

**修复的工具映射**：
- ✅ `create_project` → `create_new_project`
- ✅ `create_issue` → `create_new_issue`
- ✅ `add_comment` → `post_issue_comment`
- ✅ `log_work` → `add_workhour_in_simple_mode`
- ✅ `create_wiki` → `create_page`
- ✅ `get_types` → `get_list_of_issue_types`
- ✅ `get_fields` → `get_list_of_issue_fields`

### **2. 项目创建参数修复** ✅

**修复前**：
```typescript
const projectResult = await mcpClient.executeTask('create_project', {
  name: seedPlan.project.name,
  description: seedPlan.project.description  // ❌ 不支持的参数
})
```

**修复后**：
```typescript
const projectResult = await mcpClient.executeTask('create_project', {
  name: seedPlan.project.name,
  templateID: 'project-t1' // ✅ 使用敏捷项目管理模板
})
```

### **3. 工作项创建参数修复** ✅

**修复前**（简单参数）：
```typescript
const issueResult = await mcpClient.executeTask('create_issue', {
  project_id: projectId,
  type_id: typeId,
  title: issue.title,
  description: issue.description  // ❌ 参数格式错误
})
```

**修复后**（完整ONES API格式）：
```typescript
const issueParams = {
  title: issue.title,
  projectID: projectId.toString(),
  issueTypeID: typeId,
  assignee: '', // 使用默认分配人
  fieldValues: [
    // 动态添加描述字段
    {
      fieldID: descriptionFieldId,
      type: 1,
      value: issue.description
    }
  ],
  watchers: []
}
```

### **4. 字段信息获取** ✅

**新增功能**：
```typescript
// 获取工作项字段信息
const fieldsResult = await mcpClient.executeTask('get_fields', {})

// 智能查找描述字段
const descField = fields.find((field: any) => 
  field.name?.includes('描述') || field.name?.includes('Description') || 
  field.fieldType === 'text' || field.type === 'text'
)
```

### **5. 返回数据处理改进** ✅

**修复前**（单一ID字段）：
```typescript
const projectId = projectResult.result.id  // ❌ 可能不存在
```

**修复后**（多字段支持）：
```typescript
// 处理不同的返回格式
let projectId = projectResult.result?.id || 
                projectResult.result?.projectId || 
                projectResult.result?.uuid

if (!projectId && projectResult.result?.raw) {
  projectId = projectResult.result.raw.id || 
              projectResult.result.raw.projectId || 
              projectResult.result.raw.uuid
}
```

## 🎉 **修复效果验证**

### **工具选择验证**
```bash
# 修复前
执行任务 "create_project" 使用工具: create_new_issue  ❌

# 修复后（预期）
执行任务 "create_project" 使用工具: create_new_project  ✅
```

### **API调用格式验证**

#### **项目创建**：
```json
// 修复后的正确格式
{
  "name": "企业级SaaS协同管理平台",
  "templateID": "project-t1"
}
```

#### **工作项创建**：
```json
// 修复后的正确格式
{
  "title": "用户权限管理模块开发",
  "projectID": "1757215009612",
  "issueTypeID": "issue_type_001",
  "assignee": "",
  "fieldValues": [
    {
      "fieldID": "field_desc_001",
      "type": 1,
      "value": "开发完整的用户权限管理功能..."
    }
  ],
  "watchers": []
}
```

## 📊 **技术改进总结**

### **1. 工具选择策略**
- **从模糊匹配到精确匹配**：避免工具名称混淆
- **直接映射**：关键任务使用精确的工具名称
- **回退机制**：保持关键词匹配作为其他任务的回退

### **2. API参数适配**
- **符合ONES API规范**：使用正确的参数名称和格式
- **必需参数完整性**：确保所有必需参数都提供
- **字段动态获取**：根据实际字段信息构建参数

### **3. 数据处理健壮性**
- **多格式支持**：处理不同的API响应格式
- **智能字段查找**：自动识别描述等常用字段
- **详细日志记录**：便于调试和问题诊断

### **4. 错误处理改进**
- **参数验证**：在调用前验证参数完整性
- **返回值检查**：支持多种ID字段格式
- **失败回退**：优雅处理创建失败的情况

## 🚀 **预期效果**

修复后，系统应该能够：

1. **正确创建项目**：
   - 使用 `create_new_project` 工具
   - 传递正确的参数格式
   - 在ONES系统中真正创建项目

2. **正确创建工作项**：
   - 使用 `create_new_issue` 工具
   - 提供所有必需参数
   - 包含描述等字段信息

3. **正确创建其他资源**：
   - 评论、工时记录、Wiki页面
   - 使用对应的正确工具
   - 传递符合API规范的参数

## ⚠️ **注意事项**

1. **API Key要求**：
   - 需要有效的 Anthropic 或 OpenAI API Key
   - 测试时请使用真实的API Key

2. **ONES权限**：
   - 确保MCP访问令牌有创建项目和工作项的权限
   - 检查用户在ONES系统中的权限设置

3. **字段依赖**：
   - 描述字段ID需要从实际的ONES系统获取
   - 不同的ONES实例可能有不同的字段配置

4. **模板选择**：
   - 当前使用 `project-t1`（敏捷项目管理）模板
   - 可根据需要调整为其他模板

## 🎯 **下一步建议**

1. **使用真实API Key测试**：配置有效的Anthropic API Key进行完整测试
2. **验证ONES权限**：确保MCP令牌有足够的创建权限
3. **监控创建结果**：在ONES系统中验证实际创建的数据
4. **优化字段映射**：根据实际使用情况调整字段处理逻辑

通过这些修复，系统现在应该能够在ONES系统中真正创建项目、工作项和其他资源，而不仅仅是API调用成功的假象。
