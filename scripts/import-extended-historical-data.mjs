/**
 * Script to import extended historical data (3 years back)
 * This ensures we have enough data for meaningful performance analysis
 */

const EODHD_API_KEY = process.env.EODHD_API_KEY;

if (!EODHD_API_KEY) {
  console.error("ERROR: EODHD_API_KEY environment variable is not set");
  process.exit(1);
}

// Calculate date 3 years ago
const now = new Date();
const threeYearsAgo = new Date(now);
threeYearsAgo.setFullYear(now.getFullYear() - 3);

const fromDate = threeYearsAgo.toISOString().split('T')[0];
const toDate = now.toISOString().split('T')[0];

console.log(`Importing historical data from ${fromDate} to ${toDate}...`);
console.log(`This will take several minutes depending on the number of tickers.`);

// Import the function dynamically
const { importHistoricalPrices } = await import('../server/jobs/importHistoricalPrices.js');

try {
  const result = await importHistoricalPrices(fromDate, toDate, false);
  
  console.log('\n=== Import Results ===');
  console.log(`Success: ${result.success}`);
  console.log(`Tickers processed: ${result.tickersProcessed}`);
  console.log(`Prices imported: ${result.pricesImported}`);
  
  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`);
    result.errors.forEach(err => console.log(`  - ${err}`));
  }
  
  console.log('\n✅ Historical data import completed');
  process.exit(0);
} catch (error) {
  console.error('❌ Fatal error during import:', error);
  process.exit(1);
}
