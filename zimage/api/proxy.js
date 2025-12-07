export default async function handler(req, res) {
  // 获取请求路径
  // 在 Vercel Rewrite 后，req.url 可能保持原样或变为重写后的路径
  // 我们优先使用 req.query.path (由 vercel.json 传入)，如果没有则尝试解析 req.url
  
  let pathStr = '';
  
  if (req.query && req.query.path) {
    // 如果 path 是数组（多级路径），拼接回去
    pathStr = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path;
  } else {
    // Fallback: 尝试从 url 中提取
    // 假设 url 是 /api/proxy/v1/images/generations
    pathStr = req.url.replace(/^\/api\/proxy\/?/, '');
    // 去掉查询参数（如果 fetch targetUrl 时会自动附加的话，或者我们需要手动保留）
    pathStr = pathStr.split('?')[0];
  }

  // 移除开头斜杠，防止双斜杠
  if (pathStr.startsWith('/')) pathStr = pathStr.substring(1);

  // 拼接目标地址
  const baseUrl = 'https://api-inference.modelscope.cn';
  const targetUrl = new URL(pathStr, baseUrl);
  
  // 复制查询参数
  const query = req.query || {};
  Object.keys(query).forEach(key => {
    if (key !== 'path') {
      targetUrl.searchParams.append(key, query[key]);
    }
  });

  const finalUrl = targetUrl.toString();
  console.log(`[Proxy] Request Method: ${req.method}`);
  console.log(`[Proxy] Target URL: ${finalUrl}`);

  // 2. 转发所有请求
  try {
    const body = (req.method === "GET" || req.method === "HEAD") 
      ? undefined 
      : (typeof req.body === 'object' ? JSON.stringify(req.body) : req.body);

    // 清理 headers
    const headers = { ...req.headers };
    delete headers.host; // 彻底删除 host，让 fetch 自动生成正确的 Host 头
    delete headers['content-length'];
    delete headers['connection'];
    headers['Content-Type'] = 'application/json';

    // Vercel Node 18+ 环境内置了 fetch，无需 import
    const response = await fetch(finalUrl, {
      method: req.method,
      headers: headers,
      body: body,
    });

    console.log(`[Proxy] Response Status: ${response.status}`);

    // 获取响应 arrayBuffer (替代 node-fetch 的 buffer())
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 设置响应头
    response.headers.forEach((value, key) => {
      if (key === 'content-encoding' || key === 'content-length') return;
      res.setHeader(key, value);
    });

    res.status(response.status).send(buffer);
  } catch (error) {
    console.error('[Proxy] Error:', error);
    res.status(500).json({ 
      error: 'Proxy Request Failed', 
      details: error.message,
      cause: error.cause ? error.cause.message : 'Unknown'
    });
  }
}

export const config = {
  maxDuration: 60,
  memory: 1024
};
