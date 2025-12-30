#!/usr/bin/env tsx
/**
 * Backfill historical prices for all portfolio tickers
 * Usage: pnpm backfill:prices --from 2025-01-01 --to 2025-12-30
 */

import { importHistoricalPrices } from "../server/jobs/importHistoricalPrices";

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  let fromDate: string | undefined;
  let toDate: string | undefined;
  let forceRefresh = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from" && args[i + 1]) {
      fromDate = args[i + 1];
      i++;
    } else if (args[i] === "--to" && args[i + 1]) {
      toDate = args[i + 1];
      i++;
    } else if (args[i] === "--force") {
      forceRefresh = true;
    }
  }

  // Default to YTD if no dates provided
  if (!fromDate) {
    const now = new Date();
    fromDate = `${now.getFullYear()}-01-01`;
  }

  if (!toDate) {
    const now = new Date();
    toDate = now.toISOString().split("T")[0];
  }

  console.log("\n" + "=".repeat(80));
  console.log("📊 Historical Prices Backfill");
  console.log("=".repeat(80));
  console.log(`  From: ${fromDate}`);
  console.log(`  To: ${toDate}`);
  console.log(`  Force refresh: ${forceRefresh}`);
  console.log("=".repeat(80) + "\n");

  try {
    const result = await importHistoricalPrices(fromDate, toDate, forceRefresh);

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("✅ Backfill completed successfully!");
      console.log("=".repeat(80));
      console.log(`  Tickers processed: ${result.tickersProcessed}`);
      console.log(`  Prices imported: ${result.pricesImported}`);
      
      if (result.errors.length > 0) {
        console.log(`  Errors: ${result.errors.length}`);
        console.log("\nErrors:");
        result.errors.forEach((error) => {
          console.log(`  - ${error}`);
        });
      }
    } else {
      console.log("❌ Backfill failed!");
      console.log("=".repeat(80));
      console.log("Errors:");
      result.errors.forEach((error) => {
        console.log(`  - ${error}`);
      });
    }
    console.log("=".repeat(80) + "\n");

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error("\n" + "=".repeat(80));
    console.error("❌ Fatal error during backfill:");
    console.error("=".repeat(80));
    console.error(error);
    console.error("=".repeat(80) + "\n");
    process.exit(1);
  }
}

main();
