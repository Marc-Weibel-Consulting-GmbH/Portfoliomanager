#!/usr/bin/env tsx
import { getDb } from "../../server/db";
import { historicalPrices } from "../../drizzle/schema";
import { inArray, gte, sql } from "drizzle-orm";

const DEMO_TICKERS = ['NVDA','JNJ','GOOGL','MSFT','NESN.SW','ZURN.SW','TSM','HOLN.SW','NOVN.SW','CMBN.SW','FHZN.SW','HELN.SW','CHDVD.SW','META','ROG.SW','SGKN.SW','SCMN.SW','UBSG.SW','ABB.SW','SREN.SW','LVMUY'];

async function main() {
  const db = await getDb();
  if (!db) { console.error('No DB'); process.exit(1); }
  
  const rows = await db.select({
    ticker: historicalPrices.ticker,
    cnt: sql<number>`COUNT(*)`,
    latest: sql<string>`MAX(date)`,
  })
  .from(historicalPrices)
  .where(inArray(historicalPrices.ticker, DEMO_TICKERS))
  .groupBy(historicalPrices.ticker);

  const found = new Set(rows.map(r => r.ticker));
  const missing = DEMO_TICKERS.filter(t => !found.has(t));
  
  // Check which have 2026 data
  const rows2026 = await db.select({
    ticker: historicalPrices.ticker,
    cnt: sql<number>`COUNT(*)`,
    latest: sql<string>`MAX(date)`,
  })
  .from(historicalPrices)
  .where(inArray(historicalPrices.ticker, DEMO_TICKERS))
  .groupBy(historicalPrices.ticker)
  .having(sql`MAX(date) >= '2026-01-01'`);
  
  const has2026 = new Set(rows2026.map(r => r.ticker));
  const missing2026 = DEMO_TICKERS.filter(t => !has2026.has(t));
  
  console.log('All missing (no data at all):', missing.join(', ') || 'none');
  console.log('Missing 2026 data:', missing2026.join(', ') || 'none');
  rows.forEach(r => console.log(`  ${r.ticker}: ${r.cnt} rows, latest=${r.latest}`));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
