import { drizzle } from 'drizzle-orm/mysql2';
import { stocks } from '../drizzle/schema.js';

const db = drizzle(process.env.DATABASE_URL);

async function checkGetAllStocks() {
  // Direct database query
  const allStocks = await db.select().from(stocks);
  console.log('Direct DB query:', allStocks.length, 'stocks');
  
  // getAllStocks function
  const { getAllStocks } = await import('../server/db.js');
  const dbStocks = await getAllStocks();
  console.log('getAllStocks():', dbStocks.length, 'stocks');
  
  if (allStocks.length !== dbStocks.length) {
    console.log('\n⚠️  MISMATCH! getAllStocks() filters some stocks');
    console.log('Missing stocks:', allStocks.length - dbStocks.length);
  } else {
    console.log('\n✅ getAllStocks() returns all stocks');
  }
  
  process.exit(0);
}

checkGetAllStocks().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
