/**
 * Inserts LVMUY (LVMH ADR) into the stocks table using the project's Drizzle ORM.
 * Run with: npx tsx scripts/oneoff/insert-lvmuy.ts
 */
import { insertStock, getStockByTicker } from "../../server/db";

async function main() {
  // Check if already exists
  const existing = await getStockByTicker("LVMUY");
  if (existing) {
    console.log("LVMUY already exists:", existing.id, existing.companyName, existing.currentPrice);
    process.exit(0);
  }

  console.log("Inserting LVMUY into stocks table...");
  await insertStock({
    ticker: "LVMUY",
    companyName: "LVMH Moet Hennessy Louis Vuitton SA ADR",
    currency: "USD",
    sector: "Consumer Cyclical",
    currentPrice: "112.94",
    marketCap: "278823108608",
    peRatio: "22.69",
    dividendYield: "0.0269",
    beta: null,
    logoUrl: "https://eodhd.com/img/logos/US/lvmuy.png",
    week52High: null,
    week52Low: null,
    isManualWeight: 0,
    score: 0,
  });

  // Verify
  const inserted = await getStockByTicker("LVMUY");
  if (inserted) {
    console.log("✅ LVMUY inserted successfully:", inserted.id, inserted.companyName, inserted.currentPrice);
  } else {
    console.error("❌ LVMUY not found after insert!");
    process.exit(1);
  }
  process.exit(0);
}

main().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
