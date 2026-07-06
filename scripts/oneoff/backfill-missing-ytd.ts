#!/usr/bin/env tsx
/**
 * Backfill YTD 2026 prices for tickers missing from 2026-01-01
 */
import { importHistoricalPricesForTicker } from "../../server/jobs/importHistoricalPrices";

const TICKERS = ['HBAN.SW'];
const FROM = '2026-01-01';
const TO = new Date().toISOString().split('T')[0];

async function main() {
  console.log(`Backfilling ${TICKERS.join(', ')} from ${FROM} to ${TO}`);
  for (const ticker of TICKERS) {
    const result = await importHistoricalPricesForTicker(ticker, FROM, TO);
    console.log(`[${ticker}] success=${result.success} pricesImported=${result.pricesImported}`);
  }
  console.log('Done');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
