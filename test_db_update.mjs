// Test the full refresh flow including DB update
import { fetchStockMetrics } from './server/_core/stockDataApi.ts';
import { fetchEODHDFundamentals } from './server/_core/eodhdApi.ts';

console.log('\n🔍 Testing full refresh with DB update...\n');

// Import DB functions
const { getAllStocks, updateStock } = await import('./server/db.ts');

try {
  const stocks = await getAllStocks();
  console.log(`✅ Found ${stocks.length} stocks in database`);
  
  // Test with first stock
  const stock = stocks[0];
  console.log(`\n📊 Testing with: ${stock.ticker} (${stock.name})`);
  
  const region = stock.ticker.endsWith('.SW') ? 'CH' : 'US';
  
  // Fetch data
  console.log('1️⃣ Fetching Yahoo Finance...');
  const metrics = await fetchStockMetrics(stock.ticker, region);
  console.log(`   Sharpe: ${metrics.sharpeRatio}`);
  
  console.log('2️⃣ Fetching EODHD...');
  const fundamentals = await fetchEODHDFundamentals(stock.ticker);
  console.log(`   PEG: ${fundamentals.pegRatio}`);
  
  // Prepare update
  const updateData = {
    lastDataRefresh: new Date(),
  };
  
  if (metrics.sharpeRatio !== null) {
    updateData.sharpeRatio = metrics.sharpeRatio.toFixed(2);
  }
  if (metrics.volatility !== null) {
    updateData.volatility = metrics.volatility.toFixed(2);
  }
  if (fundamentals.pegRatio !== null && !isNaN(fundamentals.pegRatio)) {
    updateData.pegRatio = fundamentals.pegRatio.toFixed(2);
  }
  
  console.log('\n3️⃣ Updating database...');
  console.log('   Update data:', updateData);
  
  await updateStock(stock.ticker, updateData);
  console.log('✅ Database updated successfully!');
  
  // Verify
  const updated = await getAllStocks();
  const updatedStock = updated.find(s => s.ticker === stock.ticker);
  console.log('\n4️⃣ Verification:');
  console.log(`   sharpeRatio in DB: ${updatedStock.sharpeRatio}`);
  console.log(`   pegRatio in DB: ${updatedStock.pegRatio}`);
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
}
