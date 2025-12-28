// Test if the API modules can be imported
console.log('\n🔍 Testing API module imports...\n');

try {
  const { fetchStockMetrics } = await import('./server/_core/stockDataApi.ts');
  console.log('✅ stockDataApi imported successfully');
  console.log('   fetchStockMetrics:', typeof fetchStockMetrics);
  
  const { fetchEODHDFundamentals } = await import('./server/_core/eodhdApi.ts');
  console.log('✅ eodhdApi imported successfully');
  console.log('   fetchEODHDFundamentals:', typeof fetchEODHDFundamentals);
  
  // Test actual API call
  console.log('\n🧪 Testing API call for NESN.SW...\n');
  const metrics = await fetchStockMetrics('NESN.SW', 'CH');
  console.log('✅ API call successful!');
  console.log('   Sharpe Ratio:', metrics.sharpeRatio);
  console.log('   Current Price:', metrics.currentPrice);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
}
