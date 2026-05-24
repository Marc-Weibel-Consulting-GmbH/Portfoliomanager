/**
 * Backfill 15 years of historical data for all portfolio tickers + benchmarks
 * Run via: npx tsx server/scripts/backfill15y.ts
 */
import { backfillHistoricalPrices } from "../backfillHistoricalPrices";
import { getDb } from "../db";
import { historicalPrices } from "../../drizzle/schema";
import { sql } from "drizzle-orm";

const BENCHMARK_TICKERS = ['SPY.US', 'QQQ.US', 'SSMI.SW', 'URTH.US']; // S&P500, NASDAQ, SMI, MSCI World

async function getAllTickers(): Promise<string[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  
  const result = await db
    .select({ ticker: historicalPrices.ticker })
    .from(historicalPrices)
    .groupBy(historicalPrices.ticker);
  
  return result.map(r => r.ticker);
}

async function getTickersNeedingBackfill(): Promise<string[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  
  // Find tickers that don't have data going back 10+ years
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
  const cutoffDate = tenYearsAgo.toISOString().split('T')[0];
  
  const allTickers = await getAllTickers();
  const needsBackfill: string[] = [];
  
  for (const ticker of allTickers) {
    const earliest = await db
      .select({ minDate: sql<string>`MIN(date)` })
      .from(historicalPrices)
      .where(sql`ticker = ${ticker}`);
    
    const minDate = earliest[0]?.minDate;
    if (!minDate || minDate > cutoffDate) {
      needsBackfill.push(ticker);
    }
  }
  
  return needsBackfill;
}

async function main() {
  console.log("[Backfill15Y] Starting 15-year backfill...");
  
  const today = new Date();
  const toDate = today.toISOString().split('T')[0];
  
  const fifteenYearsAgo = new Date();
  fifteenYearsAgo.setFullYear(fifteenYearsAgo.getFullYear() - 15);
  const fromDate = fifteenYearsAgo.toISOString().split('T')[0];
  
  console.log(`[Backfill15Y] Date range: ${fromDate} to ${toDate}`);
  
  // First: Backfill benchmarks (highest priority)
  console.log(`[Backfill15Y] Backfilling benchmarks: ${BENCHMARK_TICKERS.join(', ')}`);
  const benchmarkResult = await backfillHistoricalPrices(BENCHMARK_TICKERS, fromDate, toDate);
  console.log(`[Backfill15Y] Benchmarks done: ${benchmarkResult.pricesInserted} prices inserted`);
  
  // Second: Find tickers needing backfill
  const tickersNeedingBackfill = await getTickersNeedingBackfill();
  console.log(`[Backfill15Y] Found ${tickersNeedingBackfill.length} tickers needing backfill`);
  
  if (tickersNeedingBackfill.length > 0) {
    // Process in batches of 10 to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < tickersNeedingBackfill.length; i += batchSize) {
      const batch = tickersNeedingBackfill.slice(i, i + batchSize);
      console.log(`[Backfill15Y] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(tickersNeedingBackfill.length/batchSize)}: ${batch.join(', ')}`);
      
      const result = await backfillHistoricalPrices(batch, fromDate, toDate);
      console.log(`[Backfill15Y] Batch result: ${result.pricesInserted} inserted, ${result.missingTickers.length} missing`);
      
      // Wait between batches
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log("[Backfill15Y] Backfill complete!");
  process.exit(0);
}

main().catch(err => {
  console.error("[Backfill15Y] Fatal error:", err);
  process.exit(1);
});
