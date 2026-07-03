import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import fetch from 'node-fetch';

const client = createTRPCProxyClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/trpc',
      fetch,
      headers: () => {
        // We need to set a valid session cookie here
        // For now, let's just call the procedure directly
        return {};
      },
    }),
  ],
});

// Since we can't easily authenticate, let's just import and call the function directly
import('./server/routers.js').then(async (module) => {
  console.log('Testing getHoldingsWithChfPerformance...');
  
  // We'll need to mock the context
  const mockCtx = {
    user: { id: 1, openId: 'test' }
  };
  
  try {
    const result = await module.appRouter.createCaller(mockCtx).savedPortfolios.getHoldingsWithChfPerformance({ id: 240001 });
    
    console.log('\n=== Result ===');
    const nvda = result.find(h => h.ticker === 'NVDA');
    if (nvda) {
      console.log('NVIDIA holding:');
      console.log(JSON.stringify(nvda, null, 2));
    } else {
      console.log('NVIDIA not found in results!');
      console.log('All tickers:', result.map(h => h.ticker));
    }
  } catch (error) {
    console.error('Error:', error);
  }
});
