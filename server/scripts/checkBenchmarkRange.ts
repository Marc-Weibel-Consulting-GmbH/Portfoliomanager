import { getDb } from "../db";
import { historicalPrices } from "../../drizzle/schema";
import { eq, min, max, sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("no db"); process.exit(1); }
  
  for (const ticker of ['SPY', 'SPY.US', 'CHSPI.SW', 'ACWI.US', 'QQQ.US', 'FEZ.US']) {
    const result = await db
      .select({ 
        minDate: min(historicalPrices.date), 
        maxDate: max(historicalPrices.date),
        count: sql<number>`COUNT(*)`.as('count')
      })
      .from(historicalPrices)
      .where(eq(historicalPrices.ticker, ticker));
    console.log(`${ticker}: ${result[0]?.minDate} → ${result[0]?.maxDate} (${result[0]?.count} rows)`);
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
