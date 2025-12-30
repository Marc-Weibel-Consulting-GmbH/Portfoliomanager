import { drizzle } from 'drizzle-orm/mysql2';
import { historicalPrices } from './drizzle/schema.ts';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

// Check if we have data for 2025-01-01
const ytdDate = '2025-01-01';
const result = await db.select({
  ticker: historicalPrices.ticker,
  date: historicalPrices.date,
  close: historicalPrices.close
})
.from(historicalPrices)
.where(eq(historicalPrices.date, ytdDate))
.limit(10);

console.log(`\n=== Historical Prices for ${ytdDate} ===`);
console.log(`Found ${result.length} records`);
result.forEach(r => {
  console.log(`${r.ticker}: ${r.close} on ${r.date}`);
});

// Check date range in historical_prices table
const dateRange = await db.select({
  minDate: sql`MIN(date)`,
  maxDate: sql`MAX(date)`,
  count: sql`COUNT(*)`
})
.from(historicalPrices);

console.log(`\n=== Historical Prices Date Range ===`);
console.log(`Min Date: ${dateRange[0].minDate}`);
console.log(`Max Date: ${dateRange[0].maxDate}`);
console.log(`Total Records: ${dateRange[0].count}`);

// Check how many tickers have data for 2025-01-01
const tickersWithYtdData = await db.select({
  count: sql`COUNT(DISTINCT ticker)`
})
.from(historicalPrices)
.where(eq(historicalPrices.date, ytdDate));

console.log(`\n=== Tickers with YTD Data ===`);
console.log(`Tickers with data on ${ytdDate}: ${tickersWithYtdData[0].count}`);

process.exit(0);
