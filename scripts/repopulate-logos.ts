#!/usr/bin/env tsx
/**
 * Re-populate stocks.logoUrl using the current logo helper.
 * The old values pointed at logo.clearbit.com, whose free Logo API was
 * discontinued; getStockLogoUrl now returns DuckDuckGo icon URLs.
 *
 * Usage: tsx scripts/repopulate-logos.ts
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";
import { stocks } from "../drizzle/schema";
import { getStockLogoUrl } from "../server/_core/stockLogo";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);

  try {
    const all = await db.select().from(stocks);
    console.log(`[Logos] Found ${all.length} stocks`);
    let updated = 0;
    for (const stock of all) {
      const logoUrl = getStockLogoUrl(stock.ticker, stock.companyName);
      if (logoUrl === stock.logoUrl) continue;
      await db.update(stocks).set({ logoUrl }).where(eq(stocks.id, stock.id));
      updated++;
      console.log(`[${updated}] ${stock.ticker} -> ${logoUrl}`);
    }
    console.log(`[Logos] Done. Updated ${updated} / ${all.length} stocks.`);
  } finally {
    await connection.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[Logos] Failed:", e);
    process.exit(1);
  });
