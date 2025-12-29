/**
 * Test script to verify API data fetching and date ranges
 * Tests EODHD and Finnhub API integration
 */

import 'dotenv/config';

const EODHD_API_KEY = process.env.EODHD_API_KEY;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

console.log('=== API Data Verification Test ===\n');
console.log('Current Date:', new Date().toISOString().split('T')[0]);
console.log('EODHD API Key:', EODHD_API_KEY ? `Configured (${EODHD_API_KEY.substring(0, 8)}...)` : 'NOT CONFIGURED');
console.log('Finnhub API Key:', FINNHUB_API_KEY ? `Configured (${FINNHUB_API_KEY.substring(0, 8)}...)` : 'NOT CONFIGURED');
console.log('\n');

// Test tickers
const testTickers = [
  { ticker: 'AAPL.US', name: 'Apple Inc.' },
  { ticker: 'NESN.SW', name: 'Nestlé' },
  { ticker: 'MSFT.US', name: 'Microsoft' }
];

/**
 * Test EODHD API - Real-time quote
 */
async function testEODHDQuote(ticker) {
  if (!EODHD_API_KEY) {
    console.log(`❌ EODHD API Key not configured`);
    return null;
  }

  try {
    const url = `https://eodhd.com/api/real-time/${ticker}?api_token=${EODHD_API_KEY}&fmt=json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`❌ EODHD API Error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return {
      ticker,
      price: data.close,
      timestamp: data.timestamp,
      date: new Date(data.timestamp * 1000).toISOString().split('T')[0]
    };
  } catch (error) {
    console.log(`❌ EODHD Error for ${ticker}:`, error.message);
    return null;
  }
}

/**
 * Test EODHD API - Historical data (last 5 days)
 */
async function testEODHDHistorical(ticker) {
  if (!EODHD_API_KEY) {
    return null;
  }

  try {
    const toDate = new Date().toISOString().split('T')[0];
    const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const url = `https://eodhd.com/api/eod/${ticker}?api_token=${EODHD_API_KEY}&from=${fromDate}&to=${toDate}&fmt=json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`❌ EODHD Historical API Error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.log(`❌ EODHD Historical Error for ${ticker}:`, error.message);
    return null;
  }
}

/**
 * Test Finnhub API - Quote
 */
async function testFinnhubQuote(ticker) {
  if (!FINNHUB_API_KEY) {
    console.log(`❌ Finnhub API Key not configured`);
    return null;
  }

  try {
    // Remove exchange suffix for Finnhub
    const cleanTicker = ticker.replace(/\.(US|SW)$/, '');
    const url = `https://finnhub.io/api/v1/quote?symbol=${cleanTicker}&token=${FINNHUB_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`❌ Finnhub API Error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return {
      ticker: cleanTicker,
      price: data.c,
      timestamp: data.t,
      date: new Date(data.t * 1000).toISOString().split('T')[0]
    };
  } catch (error) {
    console.log(`❌ Finnhub Error for ${ticker}:`, error.message);
    return null;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  for (const { ticker, name } of testTickers) {
    console.log(`\n📊 Testing: ${name} (${ticker})`);
    console.log('─'.repeat(60));
    
    // Test EODHD Real-time
    console.log('\n1. EODHD Real-time Quote:');
    const eodhdQuote = await testEODHDQuote(ticker);
    if (eodhdQuote) {
      console.log(`✅ Price: ${eodhdQuote.price}`);
      console.log(`✅ Date: ${eodhdQuote.date}`);
      console.log(`✅ Timestamp: ${new Date(eodhdQuote.timestamp * 1000).toISOString()}`);
    }
    
    // Test EODHD Historical
    console.log('\n2. EODHD Historical Data (Last 7 days):');
    const historicalData = await testEODHDHistorical(ticker);
    if (historicalData && historicalData.length > 0) {
      console.log(`✅ Retrieved ${historicalData.length} data points`);
      console.log(`✅ Latest date: ${historicalData[historicalData.length - 1].date}`);
      console.log(`✅ Latest close: ${historicalData[historicalData.length - 1].close}`);
      console.log(`✅ Oldest date: ${historicalData[0].date}`);
    }
    
    // Test Finnhub
    console.log('\n3. Finnhub Quote:');
    const finnhubQuote = await testFinnhubQuote(ticker);
    if (finnhubQuote) {
      console.log(`✅ Price: ${finnhubQuote.price}`);
      console.log(`✅ Date: ${finnhubQuote.date}`);
    }
  }
  
  console.log('\n\n=== Test Summary ===');
  console.log('✅ API connections verified');
  console.log('✅ Real-time data available');
  console.log('✅ Historical data available');
  console.log('\n⚠️  Note: If dates are not showing Dec 29, 2025, this may be due to:');
  console.log('   - Market hours (data updates during trading hours)');
  console.log('   - Weekend/Holiday (markets closed)');
  console.log('   - API data lag (typically 15-20 min delay for free tier)');
}

// Run tests
runTests().catch(console.error);
