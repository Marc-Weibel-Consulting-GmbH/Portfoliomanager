import { drizzle } from 'drizzle-orm/mysql2';
import { stocks } from './drizzle/schema.ts';
import { sql } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

const result = await db.select({
  total: sql`COUNT(*)`,
  withYtdStart: sql`SUM(CASE WHEN ytdStartPrice IS NOT NULL AND ytdStartPrice != '' THEN 1 ELSE 0 END)`,
  withYtdPerf: sql`SUM(CASE WHEN ytdPerformance IS NOT NULL AND ytdPerformance != '' THEN 1 ELSE 0 END)`,
  withPrice: sql`SUM(CASE WHEN currentPrice IS NOT NULL AND currentPrice != '' THEN 1 ELSE 0 END)`
}).from(stocks);

console.log('YTD Statistics:');
console.log('Total stocks:', result[0].total);
console.log('With ytdStartPrice:', result[0].withYtdStart);
console.log('With ytdPerformance:', result[0].withYtdPerf);
console.log('With currentPrice:', result[0].withPrice);

process.exit(0);
