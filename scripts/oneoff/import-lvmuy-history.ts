/**
 * One-off: Import historical prices for LVMUY to enable signal score calculation
 */
import { importHistoricalPricesForTicker } from "../../server/jobs/importHistoricalPrices";

async function main() {
  const today = new Date().toISOString().split("T")[0];
  const yearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().split("T")[0];
  console.log(`[import-lvmuy] Importing LVMUY from ${yearAgo} to ${today}`);
  const result = await importHistoricalPricesForTicker("LVMUY", yearAgo, today);
  console.log(`[import-lvmuy] Result:`, JSON.stringify(result, null, 2));
}

main().catch(console.error);
