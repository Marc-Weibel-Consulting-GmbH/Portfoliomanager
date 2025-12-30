/**
 * Test script to trigger historical price import
 * This script calls the admin.importHistoricalPrices mutation to import data
 */

import { importHistoricalPrices } from "./server/jobs/importHistoricalPrices.ts";

console.log("Starting historical price import...");
console.log("This will fetch historical prices from EODHD API for all tickers in portfolios");
console.log("");

// Import prices from January 1, 2025 to today
const fromDate = "2025-01-01";
const toDate = new Date().toISOString().split("T")[0];

console.log(`Date range: ${fromDate} to ${toDate}`);
console.log("");

try {
  const result = await importHistoricalPrices(fromDate, toDate, false);
  
  console.log("");
  console.log("=".repeat(60));
  console.log("IMPORT RESULTS");
  console.log("=".repeat(60));
  console.log(`Success: ${result.success}`);
  console.log(`Tickers processed: ${result.tickersProcessed}`);
  console.log(`Prices imported: ${result.pricesImported}`);
  
  if (result.errors.length > 0) {
    console.log("");
    console.log("Errors:");
    result.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  }
  
  console.log("=".repeat(60));
  console.log("");
  
  if (result.success) {
    console.log("✅ Historical price import completed successfully!");
  } else {
    console.log("❌ Historical price import failed!");
    process.exit(1);
  }
} catch (error) {
  console.error("");
  console.error("❌ Fatal error during import:");
  console.error(error);
  process.exit(1);
}
