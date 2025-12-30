import { getDb } from "../db";

/**
 * Development-only healthcheck for critical database tables
 * Logs warnings if tables are missing or empty
 */
export async function checkDatabaseHealth() {
  // Only run in development
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const db = await getDb();
  if (!db) {
    console.warn("[DB Healthcheck] Database not available - skipping healthcheck");
    return;
  }

  try {
    // Check if historical_prices table exists
    const [tableCheck] = await db.execute(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'historical_prices'"
    );
    
    const tableExists = (tableCheck as any)[0]?.count > 0;

    if (!tableExists) {
      console.error("\n" + "=".repeat(80));
      console.error("❌ CRITICAL: historical_prices table does NOT exist!");
      console.error("=".repeat(80));
      console.error("This table is required for hypothetical performance calculations.");
      console.error("\nTo fix this issue:");
      console.error("  1. Run: pnpm db:push");
      console.error("  2. Then run: pnpm backfill:prices --from 2025-01-01");
      console.error("=".repeat(80) + "\n");
      return;
    }

    // Check if table has data
    const [rowCount] = await db.execute(
      "SELECT COUNT(*) as count FROM historical_prices"
    );
    
    const count = (rowCount as any)[0]?.count || 0;

    if (count === 0) {
      console.warn("\n" + "=".repeat(80));
      console.warn("⚠️  WARNING: historical_prices table is EMPTY!");
      console.warn("=".repeat(80));
      console.warn("Historical price data is required for portfolio performance charts.");
      console.warn("\nTo populate the table:");
      console.warn("  Run: pnpm backfill:prices --from 2025-01-01");
      console.warn("=".repeat(80) + "\n");
      return;
    }

    // Get date range
    const [dateRange] = await db.execute(
      "SELECT MIN(date) as minDate, MAX(date) as maxDate, COUNT(DISTINCT ticker) as tickerCount FROM historical_prices"
    );
    
    const { minDate, maxDate, tickerCount } = (dateRange as any)[0] || {};

    console.log("\n" + "=".repeat(80));
    console.log("✅ historical_prices table healthcheck PASSED");
    console.log("=".repeat(80));
    console.log(`  Total records: ${count.toLocaleString()}`);
    console.log(`  Date range: ${minDate} to ${maxDate}`);
    console.log(`  Unique tickers: ${tickerCount}`);
    console.log("=".repeat(80) + "\n");

  } catch (error) {
    console.error("[DB Healthcheck] Error checking database health:", error);
  }
}
