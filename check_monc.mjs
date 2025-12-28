import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import { portfolioTransactions } from './drizzle/schema.ts';

const db = drizzle(process.env.DATABASE_URL);

const results = await db.select()
  .from(portfolioTransactions)
  .where(eq(portfolioTransactions.ticker, 'MONC.MI'))
  .limit(5);

console.log(JSON.stringify(results, null, 2));
