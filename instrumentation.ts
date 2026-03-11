export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'development') {
    const { ProxyAgent, setGlobalDispatcher } = await import('undici');
    
    // 你刚才跑通的绝对正确的代理地址
    const proxyUrl = 'http://172.25.144.1:10808';
    const proxyAgent = new ProxyAgent(proxyUrl);
    
    // 第一层防御：设置全局调度器 (对付普通业务代码)
    setGlobalDispatcher(proxyAgent);

    // 第二层核弹防御：直接暴力劫持底层的 global.fetch (专门对付 NextAuth 这个刺头)
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      // 强行把代理 Agent 塞进每一个 fetch 请求的底层参数里
      return originalFetch(url, {
        ...options,
        dispatcher: proxyAgent, 
      } as any); // 用 as any 绕过 ts 类型检查
    };
    
    console.log(`\n🚀 [Dev] 核弹级全局代理已强行开启 (专治 NextAuth): ${proxyUrl}\n`);
  }
}