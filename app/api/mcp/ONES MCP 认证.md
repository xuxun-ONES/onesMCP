MCP的URL
使用OpenAPI的子URL
https://your-domain/openapi/mcp

用这个URL作为受保护资源
认证流程
![](/asset/认证流程.png)

访问受保护资源shou'quan'wan'hen
按MCP Authorization的要求，当用户没有任何认证访问以上资源的时候，返回一个符合RFC 9728的WWW-Authenticate header
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata=
  "https://your-domain/.well-known/oauth-protected-resource/mcp"

返回带issuer的as (authorization server)
按RFC 9728 (OAuth 2.0 Protected Resource Metadata)的要求，客户端在请求 https://your-domain/.well-known/oauth-protected-resource/mcp 这个地址的时候，返回如下数据：
{
  "resource": "https://your-domain/openapi/mcp",
  "authorization_servers": [ "https://your-domain/mcp" ]
}

authorization server后面的 /mcp 叫做 issuer 
请求server metadata
按RFC 8414 (OAuth 2.0 Authorization Server Metadata)的定义，由于返回的authorization_servers是 /mcp 结尾的，所以客户端会请求
https://your-domain/.well-known/oauth-authorization-server/mcp

这时要返回：
{
      "issuer": "https://your-domain/mcp",
      "authorization_endpoint": "https://your-domain/oauth2/authorize", 
      "token_endpoint": "https://your-domain/oauth2/token", // 生成token的URL
      "registration_endpoint": "https://your-domain/oauth2/register", // 注册并生成client_id的URL
      "response_types_supported": ["code"],
      "code_challenge_methods_supported": ["plain", "S256"]
}

cursor在这里的实现不规范，没有请求带有issuer的URL，而是只请求了 .well-known/oauth-authorization-server ，但在header中包含了
"mcp-protocol-version": "2025-06-18",

这个行为是上一个mcp protocol版本的行为，在实现过程中，看cursor的bug修复情况，确定是否要兼容。
注册client_id
客户端请求 registration_endpoint ，并携带以下信息：
{
  client_name: "Visual Studio Code",
  client_uri: "https://code.visualstudio.com",
  grant_types: [ "authorization_code", "refresh_token", "urn:ietf:params:oauth:grant-type:device_code" ],
  response_types: [ "code" ],
  redirect_uris: [ "https://insiders.vscode.dev/redirect", "https://vscode.dev/redirect",
    "http://localhost/", "http://127.0.0.1/", "http://localhost:33418/", "http://127.0.0.1:33418/"
  ],
  token_endpoint_auth_method: "none",
}

服务器生成client_id，并记录redirect_uris，返回：
{
  client_id: "genrated id"
  client_name: "Visual Studio Code",
  client_uri: "https://code.visualstudio.com",
  grant_types: [ "authorization_code", "refresh_token", "urn:ietf:params:oauth:grant-type:device_code" ],
  response_types: [ "code" ],
  redirect_uris: [ "https://insiders.vscode.dev/redirect", "https://vscode.dev/redirect",
    "http://localhost/", "http://127.0.0.1/", "http://localhost:33418/", "http://127.0.0.1:33418/"
  ],
  token_endpoint_auth_method: "none",
}

请求authorize接口
authorize接口根据传入的resource，可以显示专门为MCP优化的授权页面并完成授权，
以上面的数据为例：
对于vscode和mcp-remote，请求的resource是都正确的resource (/openapi/mcp)
请求token接口，得到token并重新访问受保护接口