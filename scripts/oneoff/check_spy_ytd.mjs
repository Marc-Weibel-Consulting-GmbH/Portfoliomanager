import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, and, gte, lte, asc, sql } from 'drizzle-orm';
import { mysqlTable, varchar, date, decimal } from 'drizzle-orm/mysql-core';

const historicalPrices = mysqlTable('historical_prices', {
  ticker: varchar('ticker', { length: 20 }),
  date: date('date'),
  close: decimal('close', { precision: 15, scale: 4 }),
});

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);
  
  // Check SPY prices for YTD 2026 (Jan 1 - Jan 12)
  const spyYTD = await db.select()
    .from(historicalPrices)
    .where(
      and(
        eq(historicalPrices.ticker, 'SPY'),
        gte(historicalPrices.date, '2026-01-01'),
        lte(historicalPrices.date, '2026-01-12')
      )
    )
    .orderBy(asc(historicalPrices.date));
  
  console.log('SPY YTD 2026 prices:', spyYTD);
  console.log('Count:', spyYTD.length);
  
  // Calculate performance
  if (spyYTD.length > 0) {
    const startPrice = parseFloat(spyYTD[0].close);
    const endPrice = parseFloat(spyYTD[spyYTD.length - 1].close);
    const performance = ((endPrice - startPrice) / startPrice) * 100;
    console.log(`Start: ${startPrice}, End: ${endPrice}, Performance: ${performance.toFixed(2)}%`);
  }
  
  await connection.end();
}

main().catch(console.error);
