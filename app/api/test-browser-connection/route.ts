import { NextRequest, NextResponse } from 'next/server'

// 这个API端点用于在浏览器端测试连接
export async function GET() {
  return NextResponse.json({
    message: '请在浏览器控制台中运行连接测试',
    testScript: `
// 在浏览器控制台中运行这个脚本来测试 ONES 服务器连接
async function testOnesConnection(serverUrl = 'https://demo.ones.pro') {
  console.log('开始测试 ONES 服务器连接...');
  
  const testUrls = [
    serverUrl,
    serverUrl + '/.well-known/oauth-authorization-server/mcp',
    serverUrl + '/mcp',
    serverUrl + '/api/health'
  ];
  
  const results = [];
  
  for (const url of testUrls) {
    try {
      console.log('测试:', url);
      const startTime = Date.now();
      
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json, text/html, */*'
        }
      });
      
      const duration = Date.now() - startTime;
      
      const result = {
        url,
        status: response.status,
        statusText: response.statusText,
        success: response.ok,
        duration,
        headers: Object.fromEntries(response.headers.entries())
      };
      
      results.push(result);
      console.log('✅', url, result);
      
    } catch (error) {
      const result = {
        url,
        success: false,
        error: error.message,
        errorType: error.name
      };
      
      results.push(result);
      console.log('❌', url, result);
    }
  }
  
  console.log('测试结果汇总:', results);
  
  const analysis = {
    serverReachable: results.some(r => r.success),
    oauthSupported: results.some(r => r.url.includes('oauth-authorization-server') && r.success),
    mcpEndpointAvailable: results.some(r => r.url.includes('/mcp') && r.success)
  };
  
  console.log('分析结果:', analysis);
  
  return { results, analysis };
}

// 运行测试
testOnesConnection();
    `
  })
}

export async function POST(request: NextRequest) {
  try {
    const { serverUrl } = await request.json()
    
    return NextResponse.json({
      success: true,
      message: '请在浏览器中测试连接',
      instructions: [
        '1. 打开浏览器开发者工具 (F12)',
        '2. 切换到 Console 标签页',
        '3. 复制下面的代码并粘贴运行',
        '4. 查看测试结果'
      ],
      testCode: `
// 测试 ONES 服务器连接
async function testOnesConnection() {
  const serverUrl = '${serverUrl}';
  console.log('开始测试服务器:', serverUrl);
  
  const testUrls = [
    serverUrl,
    serverUrl + '/.well-known/oauth-authorization-server/mcp',
    serverUrl + '/mcp',
    serverUrl + '/api/health'
  ];
  
  for (const url of testUrls) {
    try {
      const response = await fetch(url, { 
        method: 'GET',
        mode: 'cors'
      });
      console.log('✅', url, 'Status:', response.status, response.statusText);
    } catch (error) {
      console.log('❌', url, 'Error:', error.message);
    }
  }
}

testOnesConnection();
      `
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '请求处理失败'
    }, { status: 500 })
  }
}
