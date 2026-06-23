#!/usr/bin/env tsx
/**
 * One-time full backfill of all missing stock data.
 *
 * 1. refreshAllStocks(force) — current price, previous close, daily change,
 *    Sharpe, P/E, PEG, dividend yield, beta, volatility for EVERY stock
 *    (Yahoo via multiApiDataMerger + EODHD real-time for the daily change).
 * 2. importHistoricalPrices — historical price series for all portfolio tickers.
 *
 * Usage: pnpm backfill:all          (historical prices: YTD)
 *        pnpm backfill:all --full   (historical prices: last 10 years)
 * Requires: DATABASE_URL, EODHD_API_KEY
 */
import { refreshAllStocks } from "../server/_core/dailyRefreshCron";
import { importHistoricalPrices } from "../server/jobs/importHistoricalPrices";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");

  const full = process.argv.includes("--full");

  console.log("=".repeat(70));
  console.log("[Backfill] Step 1/2 — refreshing all stock data (forced)…");
  const stockResult = await refreshAllStocks({ force: true });
  console.log("[Backfill] Stocks:", JSON.stringify(stockResult, null, 2));

  console.log("=".repeat(70));
  const from = full ? `${new Date().getFullYear() - 10}-01-01` : undefined; // default = YTD
  console.log(`[Backfill] Step 2/2 — importing historical prices (from ${from ?? "year start"})…`);
  const priceResult = await importHistoricalPrices(from, undefined, false);
  console.log("[Backfill] Historical prices:", JSON.stringify(priceResult, null, 2));

  console.log("=".repeat(70));
  console.log("[Backfill] Complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[Backfill] Failed:", e);
    process.exit(1);
  });
