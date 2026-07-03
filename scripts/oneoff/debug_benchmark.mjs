import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, and, gte, lte, asc } from 'drizzle-orm';
import { mysqlTable, varchar, date, decimal } from 'drizzle-orm/mysql-core';

const historicalPrices = mysqlTable('historical_prices', {
  ticker: varchar('ticker', { length: 20 }),
  date: date('date'),
  close: decimal('close', { precision: 15, scale: 4 }),
});

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);
  
  const benchmark = 'SPY';
  const ytdStartStr = '2026-01-01';
  const todayStr = '2026-01-12';
  
  console.log(`Querying benchmark ${benchmark} from ${ytdStartStr} to ${todayStr}`);
  
  // Test the exact query used in the code
  const benchmarkPrices = await db
    .select()
    .from(historicalPrices)
    .where(
      and(
        eq(historicalPrices.ticker, benchmark),
        gte(historicalPrices.date, ytdStartStr),
        lte(historicalPrices.date, todayStr)
      )
    )
    .orderBy(asc(historicalPrices.date));
  
  console.log(`Found ${benchmarkPrices.length} benchmark prices`);
  console.log('First 3:', benchmarkPrices.slice(0, 3));
  console.log('Last 3:', benchmarkPrices.slice(-3));
  
  // Build the map
  const benchmarkMap = {};
  benchmarkPrices.forEach((p) => {
    const dateStr = p.date instanceof Date 
      ? p.date.toISOString().split('T')[0] 
      : String(p.date).split('T')[0];
    benchmarkMap[dateStr] = parseFloat(p.close) || 0;
  });
  
  console.log('Benchmark map keys:', Object.keys(benchmarkMap));
  console.log('Benchmark map values:', Object.values(benchmarkMap));
  
  // Calculate performance
  const sortedDates = Object.keys(benchmarkMap).sort();
  const startPrice = benchmarkMap[sortedDates[0]];
  const endPrice = benchmarkMap[sortedDates[sortedDates.length - 1]];
  console.log(`Start price: ${startPrice}, End price: ${endPrice}`);
  console.log(`Performance: ${((endPrice - startPrice) / startPrice * 100).toFixed(2)}%`);
  
  await connection.end();
}

main().catch(console.error);
