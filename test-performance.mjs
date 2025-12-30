import fetch from 'node-fetch';

const API_URL = 'https://3000-i7qsskvp1f2byeonevj6t-ffd66e8f.sg1.manus.computer/api/trpc/portfolios.getHistoricalPerformance';

async function testPerformance() {
  const params = {
    portfolioId: 240001,
    period: 'YTD',
    benchmark: 'SPY',
    debug: true
  };
  
  const url = `${API_URL}?input=${encodeURIComponent(JSON.stringify(params))}`;
  
  console.log('Calling API:', url);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Cookie': 'your-session-cookie-here' // This won't work without auth, but we can see server logs
      }
    });
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testPerformance();
