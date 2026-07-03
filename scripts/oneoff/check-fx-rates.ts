import { getDb } from './server/db';
import { exchangeRates } from './drizzle/schema';
import { eq, desc } from 'drizzle-orm';

const db = await getDb();
if (!db) {
  console.log('Database not available');
  process.exit(1);
}

// Get recent USD and EUR rates
const usdRates = await db.select().from(exchangeRates)
  .where(eq(exchangeRates.currencyPair, 'USDCHF'))
  .orderBy(desc(exchangeRates.date))
  .limit(10);

const eurRates = await db.select().from(exchangeRates)
  .where(eq(exchangeRates.currencyPair, 'EURCHF'))
  .orderBy(desc(exchangeRates.date))
  .limit(10);

console.log('\n=== Recent USD/CHF Rates ===');
usdRates.forEach(r => console.log(`${r.date}: ${r.rate}`));

console.log('\n=== Recent EUR/CHF Rates ===');
eurRates.forEach(r => console.log(`${r.date}: ${r.rate}`));

process.exit(0);
