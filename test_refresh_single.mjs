import { fetchStockMetrics } from './server/_core/stockDataApi.ts';
import { fetchEODHDFundamentals } from './server/_core/eodhdApi.ts';

const ticker = 'NESN.SW';
const region = 'CH';

console.log(`\n🔍 Testing API Integration for ${ticker}...\n`);

try {
  console.log('1️⃣ Fetching Yahoo Finance data...');
  const metrics = await fetchStockMetrics(ticker, region);
  console.log('   ✅ Yahoo Finance:', {
    currentPrice: metrics.currentPrice,
    sharpeRatio: metrics.sharpeRatio,
    volatility: metrics.volatility,
    week52High: metrics.week52High,
    week52Low: metrics.week52Low
  });
  
  console.log('\n2️⃣ Fetching EODHD fundamentals...');
  const fundamentals = await fetchEODHDFundamentals(ticker);
  console.log('   ✅ EODHD:', {
    pegRatio: fundamentals.pegRatio,
    peRatio: fundamentals.peRatio,
    dividendYield: fundamentals.dividendYield,
    beta: fundamentals.beta
  });
  
  console.log('\n✅ Integration test successful!\n');
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
}
