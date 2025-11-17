// Simulate the refreshData mutation
import { fetchStockMetrics } from './server/_core/stockDataApi.ts';
import { fetchEODHDFundamentals } from './server/_core/eodhdApi.ts';

console.log('\n🔍 Testing refreshData mutation logic...\n');

// Test with one stock
const testTicker = 'NESN.SW';
const region = 'CH';

try {
  console.log(`1️⃣ Fetching Yahoo Finance data for ${testTicker}...`);
  const metrics = await fetchStockMetrics(testTicker, region);
  console.log('✅ Yahoo Finance:', {
    sharpeRatio: metrics.sharpeRatio,
    currentPrice: metrics.currentPrice,
    volatility: metrics.volatility
  });
  
  console.log(`\n2️⃣ Fetching EODHD data for ${testTicker}...`);
  const fundamentals = await fetchEODHDFundamentals(testTicker);
  console.log('✅ EODHD:', {
    pegRatio: fundamentals.pegRatio,
    peRatio: fundamentals.peRatio,
    dividendYield: fundamentals.dividendYield
  });
  
  console.log('\n✅ Both APIs work! The problem must be in the database update.');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
}
