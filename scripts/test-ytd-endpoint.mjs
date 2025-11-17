/**
 * Test YTD Performance endpoint to find undefined.split() error
 */

import { drizzle } from 'drizzle-orm/mysql2';
import { stocks } from '../drizzle/schema.js';

const db = drizzle(process.env.DATABASE_URL);

console.log('=== Testing YTD Performance Calculation ===\n');

try {
  // Get all stocks
  const allStocks = await db.select().from(stocks);
  console.log(`Loaded ${allStocks.length} stocks\n`);

  // Import the YTD calculation function
  const { calculateYTDPerformance } = await import('../server/ytd-performance.js');
  
  console.log('Calling calculateYTDPerformance...\n');
  const result = await calculateYTDPerformance(allStocks);
  
  console.log(`\n✅ Success! Generated ${result.length} data points`);
  console.log(`First 5 points:`, result.slice(0, 5));
  console.log(`Last 5 points:`, result.slice(-5));
  
} catch (error) {
  console.error('\n❌ Error occurred:');
  console.error('Message:', error.message);
  console.error('Stack:', error.stack);
}

process.exit(0);
