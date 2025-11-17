import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { stocks } from '../drizzle/schema.js';
import { eq } from 'drizzle-orm';
import { calculateStockScore } from '../server/scoring.js';

/**
 * Sync database scores with dynamic scoring system
 */
async function syncScores() {
  console.log('[Score Sync] Starting score synchronization...');
  
  // Connect to database
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);
  
  try {
    // Fetch all stocks
    const allStocks = await db.select().from(stocks);
    console.log(`[Score Sync] Found ${allStocks.length} stocks to process`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const stock of allStocks) {
      try {
        // Prepare metrics for scoring
        const metrics = {
          dividendYield: stock.dividendYield ? parseFloat(stock.dividendYield) : undefined,
          peRatio: stock.peRatio ? parseFloat(stock.peRatio) : undefined,
          pegRatio: stock.pegRatio ? parseFloat(stock.pegRatio) : undefined,
          beta: stock.beta ? parseFloat(stock.beta) : undefined,
          volatility: stock.volatility ? parseFloat(stock.volatility) : undefined,
          sharpeRatio: stock.sharpeRatio ? parseFloat(stock.sharpeRatio) : undefined,
          ytdPerformance: stock.ytdPerformance ? parseFloat(stock.ytdPerformance) : undefined,
        };
        
        // Calculate score using the same logic as frontend
        const scoreResult = calculateStockScore(
          stock.ticker,
          metrics,
          undefined, // Auto-determine type
          stock.category
        );
        
        // Round to integer for consistency
        const newScore = Math.round(scoreResult.totalScore);
        const oldScore = stock.score || 0;
        
        // Update stock
        await db.update(stocks)
          .set({ score: newScore })
          .where(eq(stocks.id, stock.id));
        
        updatedCount++;
        
        if (Math.abs(newScore - oldScore) > 5) {
          console.log(`[${updatedCount}/${allStocks.length}] ${stock.ticker}: ${oldScore} → ${newScore} (${scoreResult.type}, ${scoreResult.color})`);
        }
        
      } catch (error) {
        errorCount++;
        console.error(`[Error] Failed to update ${stock.ticker}:`, error.message);
      }
    }
    
    console.log(`\n[Score Sync] Complete!`);
    console.log(`  ✓ Updated: ${updatedCount} stocks`);
    console.log(`  ✗ Errors: ${errorCount} stocks`);
    
  } catch (error) {
    console.error('[Score Sync] Fatal error:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the script
syncScores()
  .then(() => {
    console.log('[Score Sync] Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Score Sync] Script failed:', error);
    process.exit(1);
  });
