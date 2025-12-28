import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { historicalPrices, stocks } from '../drizzle/schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';

const db = drizzle(await mysql.createConnection(process.env.DATABASE_URL));

// Fetch historical data from Yahoo Finance
async function fetchYahooData(ticker, fromDate, toDate) {
  const period1 = Math.floor(new Date(fromDate).getTime() / 1000);
  const period2 = Math.floor(new Date(toDate).getTime() / 1000);
  
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${period2}&interval=1d`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[${ticker}] Yahoo Finance returned ${res.status}`);
      return [];
    }
    
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]?.close) {
      console.error(`[${ticker}] No data in response`);
      return [];
    }
    
    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;
    const volumes = result.indicators.quote[0].volume || [];
    
    const prices = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] !== null && closes[i] !== undefined) {
        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
        prices.push({
          ticker,
          date,
          close: closes[i].toString(),
          volume: volumes[i] ? volumes[i].toString() : '0',
          updatedAt: new Date(),
        });
      }
    }
    
    return prices;
  } catch (error) {
    console.error(`[${ticker}] Fetch error:`, error.message);
    return [];
  }
}

// Main function
async function main() {
  console.log('🚀 Starting historical price population for ALL stocks...\n');
  
  // Get all stocks from database
  const allStocks = await db.select().from(stocks);
  console.log(`📊 Found ${allStocks.length} stocks in database\n`);
  
  // Calculate date range (1 year ago to today)
  const toDate = new Date().toISOString().split('T')[0];
  const fromDate = new Date();
  fromDate.setFullYear(fromDate.getFullYear() - 1);
  const fromDateStr = fromDate.toISOString().split('T')[0];
  
  console.log(`📅 Date range: ${fromDateStr} to ${toDate}\n`);
  
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  
  // Process stocks in batches to avoid rate limits
  const BATCH_SIZE = 10;
  const DELAY_MS = 500; // 500ms between batches
  
  for (let i = 0; i < allStocks.length; i += BATCH_SIZE) {
    const batch = allStocks.slice(i, i + BATCH_SIZE);
    console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allStocks.length / BATCH_SIZE)}...`);
    
    for (const stock of batch) {
      const ticker = stock.ticker.replace(/\s+•\s+/, '.');
      
      // Check if already cached
      const existing = await db
        .select()
        .from(historicalPrices)
        .where(eq(historicalPrices.ticker, ticker))
        .limit(1);
      
      if (existing.length > 0) {
        console.log(`  ⏭️  ${ticker}: Already cached (${existing.length} records)`);
        skipCount++;
        continue;
      }
      
      // Fetch and insert
      console.log(`  🔄 ${ticker}: Fetching...`);
      const prices = await fetchYahooData(ticker, fromDateStr, toDate);
      
      if (prices.length > 0) {
        try {
          // Insert in chunks to avoid large transactions
          const CHUNK_SIZE = 100;
          for (let j = 0; j < prices.length; j += CHUNK_SIZE) {
            const chunk = prices.slice(j, j + CHUNK_SIZE);
            await db.insert(historicalPrices).values(chunk);
          }
          console.log(`  ✅ ${ticker}: Inserted ${prices.length} records`);
          successCount++;
        } catch (error) {
          console.error(`  ❌ ${ticker}: Insert failed:`, error.message);
          failCount++;
        }
      } else {
        console.log(`  ❌ ${ticker}: No data fetched`);
        failCount++;
      }
    }
    
    // Delay between batches
    if (i + BATCH_SIZE < allStocks.length) {
      console.log(`  ⏸️  Waiting ${DELAY_MS}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
  
  console.log(`\n\n✨ Population complete!`);
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Failed: ${failCount}`);
  console.log(`  ⏭️  Skipped: ${skipCount}`);
  console.log(`  📊 Total: ${allStocks.length}`);
  
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
