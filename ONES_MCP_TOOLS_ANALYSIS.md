# ONES MCP 工具完整分析

## 📋 **工具分类总览**

### **1. 工作项 (Issues) 相关工具** 🎯
- `get_list_of_issues` - 获取工作项列表
- `get_issue_details` - 获取工作项详情
- `create_new_issue` - 创建新工作项 ⭐
- `update_issue` - 更新工作项
- `get_list_of_issue_fields` - 获取工作项字段列表
- `get_list_of_issue_types` - 获取工作项类型列表 ⭐
- `get_list_of_issue_comments` - 获取工作项评论列表
- `post_issue_comment` - 发布工作项评论 ⭐
- `get_issue_executable_workflows` - 获取工作项可执行工作流
- `execute_issue_workflow` - 执行工作项工作流

### **2. 项目 (Projects) 相关工具** 🏗️
- `get_project_list` - 获取项目列表 ⭐
- `create_new_project` - 创建新项目 ⭐
- `get_project_details_by_project_id` - 根据ID获取项目详情
- `update_project_by_project_id` - 根据ID更新项目

### **3. 用户 (Users) 相关工具** 👥
- `search_for_users` - 搜索用户

### **4. Wiki 相关工具** 📚
- `get_space_list` - 获取Wiki空间列表
- `get_space_details` - 获取Wiki空间详情
- `get_list_of_space_pages` - 获取空间页面列表
- `create_page` - 创建Wiki页面 ⭐
- `get_page_details` - 获取页面详情
- `search_for_references_in_wiki` - 在Wiki中搜索引用

### **5. 工时 (Manhour) 相关工具** ⏰
#### **简单模式 (Simple Mode)**
- `get_manhour_list_in_simple_mode` - 获取工时列表
- `set_manhour_estimated_in_simple_mode` - 设置预估工时
- `set_manhour_remaining_in_simple_mode` - 设置剩余工时
- `add_workhour_in_simple_mode` - 添加工时记录 ⭐
- `update_workhour_in_simple_mode` - 更新工时记录

#### **汇总模式 (Summary Mode)**
- `get_manhour_list_in_summary_mode` - 获取工时汇总列表
- `add_manhour_estimated_in_summary_mode` - 添加预估工时
- `update_manhour_estimated_in_summary_mode` - 更新预估工时
- `add_workhour_in_summary_mode` - 添加工时记录
- `update_workhour_in_summary_mode` - 更新工时记录

### **6. 系统工具** ⚙️
- `get_manhour_mode` - 获取工时模式

⭐ = 演示数据生成中常用的工具

## 🎯 **关键工具详细分析**

### **1. create_new_project**
```json
{
  "required": ["name"],
  "optional": ["templateID", "members"],
  "templates": {
    "project-t1": "Agile project management",
    "project-t2": "General task management", 
    "project-t4": "Waterfall project planning",
    "project-t5": "Agile project management_v2",
    "project-t6": "Kanban task management",
    "comagile": "Agile project management",
    "comwater": "Waterfall project planning"
  }
}
```

### **2. create_new_issue**
```json
{
  "required": ["assignee", "title", "projectID", "issueTypeID", "fieldValues", "watchers"],
  "critical_notes": [
    "fieldValues cannot be empty",
    "assignee can be empty string for default user",
    "projectID from get_project_list",
    "issueTypeID from get_list_of_issue_types",
    "fieldID from get_list_of_issue_fields"
  ]
}
```

### **3. post_issue_comment**
```json
{
  "required": ["issueID", "text"],
  "optional": ["repliedMessageID"],
  "notes": "text must be plain text format"
}
```

### **4. create_page**
```json
{
  "required": ["parentPageID", "title", "content"],
  "notes": [
    "content in markdown format",
    "parentPageID from get_space_details homePageID or get_list_of_space_pages pageID"
  ]
}
```

### **5. add_workhour_in_simple_mode**
```json
{
  "required": ["issueID", "hours", "description", "startTime"],
  "optional": ["owner"],
  "notes": [
    "hours can be decimal",
    "startTime in ISO 8601 format",
    "owner defaults to current user if not provided"
  ]
}
```

## 🔧 **工具选择策略优化**

### **当前问题分析**
1. **关键词匹配不准确**：容易选择错误的工具
2. **参数依赖关系**：某些工具需要先调用其他工具获取参数
3. **工具变体选择**：如工时工具有简单模式和汇总模式两种

### **优化策略**

#### **1. 精确工具映射**
```typescript
const EXACT_TOOL_MAPPING = {
  // 项目相关
  'create_project': 'create_new_project',
  'get_projects': 'get_project_list',
  'get_project_details': 'get_project_details_by_project_id',
  'update_project': 'update_project_by_project_id',
  
  // 工作项相关
  'create_issue': 'create_new_issue',
  'get_issues': 'get_list_of_issues',
  'get_issue_details': 'get_issue_details',
  'update_issue': 'update_issue',
  'get_issue_types': 'get_list_of_issue_types',
  'get_issue_fields': 'get_list_of_issue_fields',
  
  // 评论相关
  'add_comment': 'post_issue_comment',
  'get_comments': 'get_list_of_issue_comments',
  
  // 工作流相关
  'get_workflows': 'get_issue_executable_workflows',
  'execute_workflow': 'execute_issue_workflow',
  
  // Wiki相关
  'create_wiki': 'create_page',
  'get_wiki_spaces': 'get_space_list',
  'get_wiki_space_details': 'get_space_details',
  'get_wiki_pages': 'get_list_of_space_pages',
  'get_wiki_page_details': 'get_page_details',
  'search_wiki': 'search_for_references_in_wiki',
  
  // 工时相关（优先使用简单模式）
  'add_workhour': 'add_workhour_in_simple_mode',
  'update_workhour': 'update_workhour_in_simple_mode',
  'set_estimated_hours': 'set_manhour_estimated_in_simple_mode',
  'set_remaining_hours': 'set_manhour_remaining_in_simple_mode',
  'get_workhours': 'get_manhour_list_in_simple_mode',
  
  // 用户相关
  'search_users': 'search_for_users',
  
  // 系统相关
  'get_manhour_mode': 'get_manhour_mode'
}
```

#### **2. 工具依赖链**
```typescript
const TOOL_DEPENDENCIES = {
  'create_new_issue': [
    'get_project_list',      // 获取projectID
    'get_list_of_issue_types', // 获取issueTypeID
    'get_list_of_issue_fields' // 获取fieldID (可选)
  ],
  'create_page': [
    'get_space_list',        // 获取spaceID
    'get_space_details'      // 获取parentPageID
  ],
  'post_issue_comment': [
    'get_list_of_issues'     // 获取issueID
  ],
  'add_workhour_in_simple_mode': [
    'get_list_of_issues'     // 获取issueID
  ]
}
```

#### **3. 参数构建策略**
```typescript
const PARAMETER_BUILDERS = {
  'create_new_project': (data) => ({
    name: data.name,
    templateID: data.template || 'project-t1', // 默认敏捷模板
    members: data.members || null
  }),
  
  'create_new_issue': (data, context) => ({
    title: data.title,
    projectID: context.projectId?.toString(),
    issueTypeID: context.issueTypeId,
    assignee: data.assignee || '', // 默认当前用户
    fieldValues: buildFieldValues(data, context.fields),
    watchers: data.watchers || [],
    parentID: data.parentId || null
  }),
  
  'create_page': (data, context) => ({
    parentPageID: context.parentPageId,
    title: data.title,
    content: data.content // markdown格式
  })
}
```

## 🚀 **实施建议**

### **1. 立即修复**
- 替换当前的关键词匹配为精确工具映射
- 修复 `create_new_issue` 的参数构建逻辑
- 添加工具依赖链处理

### **2. 中期优化**
- 实现智能参数构建器
- 添加工具调用失败的回退机制
- 优化工时工具的模式选择

### **3. 长期改进**
- 实现工具调用的事务性处理
- 添加工具性能监控
- 支持批量操作优化

这个分析为完善工具匹配逻辑提供了全面的基础。
