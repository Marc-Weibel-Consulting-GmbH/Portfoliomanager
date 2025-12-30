import { importHistoricalPrices } from './server/jobs/importHistoricalPrices.ts';

/**
 * Test script to validate the backfill process for historical prices
 * This script will:
 * 1. Get all unique tickers from portfolios and transactions
 * 2. Fetch historical prices for the last 3 years
 * 3. Report on success/failures
 */

async function testBackfill() {
  console.log('='.repeat(60));
  console.log('BACKFILL TEST SCRIPT');
  console.log('='.repeat(60));
  console.log('');

  // Calculate date range: last 3 years
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setFullYear(fromDate.getFullYear() - 3);

  const from = fromDate.toISOString().split('T')[0];
  const to = toDate.toISOString().split('T')[0];

  console.log(`Date Range: ${from} to ${to}`);
  console.log('');

  try {
    console.log('Starting backfill process...');
    console.log('');

    const result = await importHistoricalPrices(from, to, false);

    console.log('');
    console.log('='.repeat(60));
    console.log('BACKFILL RESULTS');
    console.log('='.repeat(60));
    console.log(`Success: ${result.success}`);
    console.log(`Tickers Processed: ${result.tickersProcessed}`);
    console.log(`Prices Imported: ${result.pricesImported}`);
    console.log(`Errors: ${result.errors.length}`);
    console.log('');

    if (result.errors.length > 0) {
      console.log('Errors encountered:');
      result.errors.forEach((error, idx) => {
        console.log(`  ${idx + 1}. ${error}`);
      });
      console.log('');
    }

    if (result.success) {
      console.log('✅ Backfill completed successfully!');
    } else {
      console.log('❌ Backfill failed!');
      process.exit(1);
    }

  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('FATAL ERROR');
    console.error('='.repeat(60));
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testBackfill().then(() => {
  console.log('');
  console.log('Test completed. Exiting...');
  process.exit(0);
}).catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
