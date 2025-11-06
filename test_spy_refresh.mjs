// Test SPY.US data fetching
const ticker = "SPY.US";
const apiKey = process.env.EODHD_API_KEY;

console.log('Testing SPY.US data fetching...\n');

// 1. Test EODHD Real-Time Price
console.log('1. EODHD Real-Time Price:');
try {
  const priceUrl = `https://eodhd.com/api/real-time/${ticker}?api_token=${apiKey}&fmt=json`;
  const priceResponse = await fetch(priceUrl);
  const priceData = await priceResponse.json();
  console.log('  Status:', priceResponse.status);
  console.log('  Close:', priceData.close);
  console.log('  Previous Close:', priceData.previousClose);
} catch (e) {
  console.error('  Error:', e.message);
}

// 2. Test EODHD Fundamentals
console.log('\n2. EODHD Fundamentals:');
try {
  const fundUrl = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${apiKey}`;
  const fundResponse = await fetch(fundUrl);
  const fundData = await fundResponse.json();
  console.log('  Status:', fundResponse.status);
  console.log('  Has ETF_Data:', !!fundData.ETF_Data);
  console.log('  Has Technicals:', !!fundData.Technicals);
  if (fundData.ETF_Data?.Valuations_Growth?.Valuations_Rates_Portfolio) {
    console.log('  Dividend Yield Factor:', fundData.ETF_Data.Valuations_Growth.Valuations_Rates_Portfolio['Dividend-Yield Factor']);
  }
  if (fundData.Technicals) {
    console.log('  Beta:', fundData.Technicals.Beta);
  }
} catch (e) {
  console.error('  Error:', e.message);
}
