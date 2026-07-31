/**
 * One-time script: Backfill benchmark tickers (SPY, CHSPI.SW, ACWI.US, QQQ, FEZ)
 * from 2018-01-01 to today so the "Max" chart period shows full history.
 * Run: npx tsx server/scripts/backfillBenchmarks.ts
 */
import { backfillHistoricalPrices } from "../backfillHistoricalPrices";

const BENCHMARK_TICKERS = ['SPY', 'CHSPI.SW', 'ACWI.US', 'QQQ', 'FEZ'];
const FROM_DATE = '2018-01-01';
const TO_DATE = new Date().toISOString().split('T')[0];

async function main() {
  console.log(`[BackfillBenchmarks] Starting backfill for ${BENCHMARK_TICKERS.join(', ')}`);
  console.log(`[BackfillBenchmarks] Date range: ${FROM_DATE} to ${TO_DATE}`);
  
  const result = await backfillHistoricalPrices(BENCHMARK_TICKERS, FROM_DATE, TO_DATE);
  
  console.log('[BackfillBenchmarks] Result:', JSON.stringify({
    success: result.success,
    tickersProcessed: result.tickersProcessed,
    pricesInserted: result.pricesInserted,
    errors: result.errors.slice(0, 5),
  }, null, 2));
  
  process.exit(result.success ? 0 : 1);
}

main().catch(e => {
  console.error('[BackfillBenchmarks] Fatal error:', e);
  process.exit(1);
});
