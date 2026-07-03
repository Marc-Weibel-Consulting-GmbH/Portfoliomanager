import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, desc, sql } from 'drizzle-orm';
import { mysqlTable, varchar, date, decimal } from 'drizzle-orm/mysql-core';

const historicalPrices = mysqlTable('historical_prices', {
  ticker: varchar('ticker', { length: 20 }),
  date: date('date'),
  close: decimal('close', { precision: 15, scale: 4 }),
});

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);
  
  // Check latest dates for SPY and SPY.US
  const spyLatest = await db.select()
    .from(historicalPrices)
    .where(eq(historicalPrices.ticker, 'SPY'))
    .orderBy(desc(historicalPrices.date))
    .limit(5);
  
  const spyUSLatest = await db.select()
    .from(historicalPrices)
    .where(eq(historicalPrices.ticker, 'SPY.US'))
    .orderBy(desc(historicalPrices.date))
    .limit(5);
  
  console.log('SPY latest dates:', spyLatest);
  console.log('SPY.US latest dates:', spyUSLatest);
  
  // Check count for 2025 and 2026
  const spy2025Count = await db.execute(sql`SELECT COUNT(*) as cnt FROM historical_prices WHERE ticker = 'SPY' AND date >= '2025-01-01'`);
  const spyUS2025Count = await db.execute(sql`SELECT COUNT(*) as cnt FROM historical_prices WHERE ticker = 'SPY.US' AND date >= '2025-01-01'`);
  
  console.log('SPY 2025+ count:', spy2025Count);
  console.log('SPY.US 2025+ count:', spyUS2025Count);
  
  await connection.end();
}

main().catch(console.error);
