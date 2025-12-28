import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { stocks } from '../drizzle/schema.js';
import { eq } from 'drizzle-orm';

// FMP API Key from environment
const FMP_API_KEY = process.env.FISCAL_API_KEY;

/**
 * Calculate stock score based on available metrics
 * Score range: 0-100
 */
function calculateScore(stock) {
  let score = 50; // Base score
  
  // P/E Ratio scoring (lower is better, but not too low)
  const peRatio = parseFloat(stock.peRatio);
  if (!isNaN(peRatio) && peRatio > 0) {
    if (peRatio < 15) score += 10;
    else if (peRatio < 25) score += 5;
    else if (peRatio > 40) score -= 10;
  }
  
  // PEG Ratio scoring (lower is better)
  const pegRatio = parseFloat(stock.pegRatio);
  if (!isNaN(pegRatio) && pegRatio > 0) {
    if (pegRatio < 1) score += 10;
    else if (pegRatio < 2) score += 5;
    else if (pegRatio > 3) score -= 5;
  }
  
  // Sharpe Ratio scoring (higher is better)
  const sharpeRatio = parseFloat(stock.sharpeRatio);
  if (!isNaN(sharpeRatio)) {
    if (sharpeRatio >= 1.5) score += 15;
    else if (sharpeRatio >= 1.0) score += 10;
    else if (sharpeRatio >= 0.5) score += 5;
    else if (sharpeRatio < 0) score -= 10;
  }
  
  // Dividend Yield scoring (higher is better for dividend stocks)
  const dividendYield = parseFloat(stock.dividendYield);
  if (!isNaN(dividendYield) && dividendYield > 0) {
    if (dividendYield >= 4) score += 10;
    else if (dividendYield >= 2) score += 5;
  }
  
  // YTD Performance scoring (higher is better)
  const ytdPerformance = parseFloat(stock.ytdPerformance);
  if (!isNaN(ytdPerformance)) {
    if (ytdPerformance >= 20) score += 10;
    else if (ytdPerformance >= 10) score += 5;
    else if (ytdPerformance < -10) score -= 5;
    else if (ytdPerformance < -20) score -= 10;
  }
  
  // Clamp score to 0-100 range
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Fetch logo URL from FMP API
 */
async function fetchLogoUrl(ticker) {
  if (!FMP_API_KEY) {
    console.warn('[Logo] No FMP API key found');
    return null;
  }
  
  try {
    // Remove .SW suffix for Swiss stocks
    const cleanTicker = ticker.replace('.SW', '');
    const url = `https://financialmodelingprep.com/api/v3/profile/${cleanTicker}?apikey=${FMP_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`[Logo] Failed to fetch for ${ticker}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    if (data && data.length > 0 && data[0].image) {
      return data[0].image;
    }
    
    return null;
  } catch (error) {
    console.error(`[Logo] Error fetching logo for ${ticker}:`, error.message);
    return null;
  }
}

/**
 * Main function to populate logos and scores
 */
async function populateLogosAndScores() {
  console.log('[Populate] Starting logo and score population...');
  
  // Connect to database
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);
  
  try {
    // Fetch all stocks
    const allStocks = await db.select().from(stocks);
    console.log(`[Populate] Found ${allStocks.length} stocks to process`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const stock of allStocks) {
      try {
        // Calculate score
        const score = calculateScore(stock);
        
        // Fetch logo URL (with rate limiting)
        const logoUrl = await fetchLogoUrl(stock.ticker);
        
        // Update stock
        await db.update(stocks)
          .set({ 
            score, 
            logoUrl: logoUrl || stock.logoUrl // Keep existing if fetch fails
          })
          .where(eq(stocks.id, stock.id));
        
        updatedCount++;
        console.log(`[${updatedCount}/${allStocks.length}] ${stock.ticker}: score=${score}, logo=${logoUrl ? '✓' : '✗'}`);
        
        // Rate limiting: 300 requests/minute = 200ms delay
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        errorCount++;
        console.error(`[Error] Failed to update ${stock.ticker}:`, error.message);
      }
    }
    
    console.log(`\n[Populate] Complete!`);
    console.log(`  ✓ Updated: ${updatedCount} stocks`);
    console.log(`  ✗ Errors: ${errorCount} stocks`);
    
  } catch (error) {
    console.error('[Populate] Fatal error:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the script
populateLogosAndScores()
  .then(() => {
    console.log('[Populate] Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Populate] Script failed:', error);
    process.exit(1);
  });
