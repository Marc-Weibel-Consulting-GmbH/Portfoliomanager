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
  
  // Check for SPY prices
  const spyPrices = await db.select()
    .from(historicalPrices)
    .where(eq(historicalPrices.ticker, 'SPY'))
    .orderBy(asc(historicalPrices.date))
    .limit(10);
  
  console.log('SPY prices:', spyPrices);
  
  // Check distinct benchmark tickers
  const tickers = await db.execute(sql`SELECT DISTINCT ticker FROM historical_prices WHERE ticker LIKE '%SPY%' OR ticker LIKE '%GSPC%' OR ticker LIKE '%SP%' LIMIT 20`);
  console.log('Benchmark tickers:', tickers);
  
  await connection.end();
}

main().catch(console.error);
