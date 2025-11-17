/**
 * Test daily YTD performance calculation with real EODHD data
 */

import { calculateYTDPerformance } from '../server/ytd-performance.js';
import { drizzle } from 'drizzle-orm/mysql2';
import { stocks } from '../drizzle/schema.js';

const db = drizzle(process.env.DATABASE_URL);

async function testDailyYTD() {
  console.log("=== Testing Daily YTD Performance Calculation ===\n");

  // Load all stocks
  const allStocks = await db.select().from(stocks);
  const tickers = allStocks.map(s => s.ticker);

  console.log(`Testing with ${tickers.length} stocks...\n`);

  // Calculate daily performance
  const result = await calculateYTDPerformance(tickers);

  console.log("\n=== Results ===");
  console.log(`Total data points: ${result.dates.length}`);
  console.log(`Date range: ${result.dates[0]} → ${result.dates[result.dates.length - 1]}`);
  console.log(`Performance range: ${result.values[0]?.toFixed(2)}% → ${result.finalYTD.toFixed(2)}%`);

  // Show first 5 and last 5 days
  console.log("\n=== First 5 Days ===");
  for (let i = 0; i < Math.min(5, result.dates.length); i++) {
    console.log(`${result.dates[i]}: ${result.values[i].toFixed(2)}%`);
  }

  console.log("\n=== Last 5 Days ===");
  for (let i = Math.max(0, result.dates.length - 5); i < result.dates.length; i++) {
    console.log(`${result.dates[i]}: ${result.values[i].toFixed(2)}%`);
  }

  // Check for volatility (not a straight line)
  const isVolatile = result.values.some((v, i) => {
    if (i === 0) return false;
    const diff = Math.abs(v - result.values[i - 1]);
    return diff > 0.5; // More than 0.5% daily change
  });

  console.log(`\n✅ Chart shows volatility: ${isVolatile ? 'YES' : 'NO (might be linear fallback)'}`);

  process.exit(0);
}

testDailyYTD().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});
