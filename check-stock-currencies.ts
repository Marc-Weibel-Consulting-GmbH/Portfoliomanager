import { getDb } from './server/db';
import { stocks } from './drizzle/schema';
import { isNotNull } from 'drizzle-orm';

const db = await getDb();
if (!db) {
  console.log('Database not available');
  process.exit(1);
}

// Get all stocks with their currencies
const allStocks = await db.select()
  .from(stocks)
  .where(isNotNull(stocks.ticker))
  .orderBy(stocks.ticker);

console.log('\n=== Stock Currencies in Database ===\n');

// Group by currency
const byCurrency: Record<string, any[]> = {};
allStocks.forEach(stock => {
  const curr = stock.currency || 'NULL';
  if (!byCurrency[curr]) {
    byCurrency[curr] = [];
  }
  byCurrency[curr].push(stock);
});

// Display grouped
Object.keys(byCurrency).sort().forEach(currency => {
  console.log(`\n${currency}:`);
  byCurrency[currency].forEach(stock => {
    console.log(`  ${stock.ticker.padEnd(10)} - ${stock.name}`);
  });
});

// Check specific stocks mentioned in user's scenario
console.log('\n=== Specific Stocks Check ===\n');
const checkTickers = ['AAPL', 'NVDA', 'SAP', 'ASML', 'EOS'];
for (const ticker of checkTickers) {
  const stock = allStocks.find(s => s.ticker === ticker);
  if (stock) {
    console.log(`${ticker.padEnd(10)} → ${stock.currency || 'NULL'} (${stock.name})`);
  } else {
    console.log(`${ticker.padEnd(10)} → NOT FOUND`);
  }
}

process.exit(0);
