import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { stocks } from '../drizzle/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Round Sharpe ratios to 1 decimal place
 */
async function roundSharpeRatios() {
  console.log('[Sharpe] Starting Sharpe ratio rounding...');
  
  // Connect to database
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);
  
  try {
    // Fetch all stocks with Sharpe ratios
    const allStocks = await db.select().from(stocks);
    console.log(`[Sharpe] Found ${allStocks.length} stocks to process`);
    
    let updatedCount = 0;
    
    for (const stock of allStocks) {
      try {
        if (stock.sharpeRatio) {
          const originalValue = parseFloat(stock.sharpeRatio);
          if (!isNaN(originalValue)) {
            const roundedValue = Math.round(originalValue * 10) / 10;
            
            // Only update if value changed
            if (Math.abs(originalValue - roundedValue) > 0.001) {
              await db.update(stocks)
                .set({ sharpeRatio: roundedValue.toString() })
                .where(eq(stocks.id, stock.id));
              
              updatedCount++;
              console.log(`[${updatedCount}] ${stock.ticker}: ${originalValue} → ${roundedValue}`);
            }
          }
        }
      } catch (error) {
        console.error(`[Error] Failed to update ${stock.ticker}:`, error.message);
      }
    }
    
    console.log(`\n[Sharpe] Complete!`);
    console.log(`  ✓ Updated: ${updatedCount} stocks`);
    
  } catch (error) {
    console.error('[Sharpe] Fatal error:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the script
roundSharpeRatios()
  .then(() => {
    console.log('[Sharpe] Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Sharpe] Script failed:', error);
    process.exit(1);
  });
