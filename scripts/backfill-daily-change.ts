#!/usr/bin/env tsx
/**
 * Backfill stocks.dailyChangePercent (and previousClose / currentPrice) from
 * EODHD's real-time endpoint. Powers the "Heute" column in the portfolio detail.
 *
 * Usage: tsx scripts/backfill-daily-change.ts
 * Requires: EODHD_API_KEY, DATABASE_URL
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";
import { stocks } from "../drizzle/schema";
import { fetchEODHDRealTime } from "../server/_core/eodhdApi";

/** EODHD expects an exchange suffix; default US tickers to ".US". */
function toEodhdTicker(ticker: string): string {
  return ticker.includes(".") ? ticker : `${ticker}.US`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  if (!process.env.EODHD_API_KEY) throw new Error("EODHD_API_KEY not set");

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);

  try {
    const all = await db.select().from(stocks);
    console.log(`[DailyChange] Found ${all.length} stocks`);
    let updated = 0;
    let skipped = 0;
    for (const stock of all) {
      const rt = await fetchEODHDRealTime(toEodhdTicker(stock.ticker));
      if (rt.changePercent === null && rt.close === null) {
        skipped++;
        console.warn(`[skip] ${stock.ticker}: no real-time data`);
        await sleep(120);
        continue;
      }
      const set: Record<string, string> = {};
      if (rt.changePercent !== null) set.dailyChangePercent = rt.changePercent.toFixed(2);
      if (rt.previousClose !== null) set.previousClose = String(rt.previousClose);
      if (rt.close !== null) set.currentPrice = String(rt.close);
      await db.update(stocks).set(set).where(eq(stocks.id, stock.id));
      updated++;
      console.log(`[${updated}] ${stock.ticker}: ${set.dailyChangePercent ?? "?"}%`);
      await sleep(120); // be gentle on the API
    }
    console.log(`[DailyChange] Done. Updated ${updated}, skipped ${skipped}, total ${all.length}.`);
  } finally {
    await connection.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[DailyChange] Failed:", e);
    process.exit(1);
  });
