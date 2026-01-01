/**
 * Backfill adjusted_close for existing historical prices
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

const EODHD_API_KEY = process.env.EODHD_API_KEY;
const EODHD_BASE_URL = "https://eodhd.com/api";

async function backfillAdjustedClose() {
  console.log('[Backfill] Starting adjusted_close backfill...');
  
  // Get distinct tickers from historical_prices
  const [tickers] = await connection.execute('SELECT DISTINCT ticker FROM historical_prices ORDER BY ticker');
  
  console.log(`[Backfill] Found ${tickers.length} tickers to process`);
  
  let processed = 0;
  let updated = 0;
  
  for (const row of tickers) {
    const ticker = row.ticker;
    processed++;
    
    try {
      // Get date range for this ticker
      const [dateRange] = await connection.execute(
        'SELECT MIN(date) as minDate, MAX(date) as maxDate FROM historical_prices WHERE ticker = ?',
        [ticker]
      );
      
      const minDate = dateRange[0]?.minDate;
      const maxDate = dateRange[0]?.maxDate;
      
      if (!minDate || !maxDate) {
        console.log(`[Backfill] ${processed}/${tickers.length} - Skipping ${ticker}: no date range`);
        continue;
      }
      
      console.log(`[Backfill] ${processed}/${tickers.length} - Processing ${ticker} (${minDate} to ${maxDate})`);
      
      // Fetch from EODHD API
      const url = `${EODHD_BASE_URL}/eod/${ticker}?api_token=${EODHD_API_KEY}&fmt=json&from=${minDate}&to=${maxDate}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn(`[Backfill] Failed to fetch ${ticker}: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data) || data.length === 0) {
        console.warn(`[Backfill] No data returned for ${ticker}`);
        continue;
      }
      
      // Update each price record
      let tickerUpdated = 0;
      for (const price of data) {
        if (price.adjusted_close) {
          await connection.execute(
            'UPDATE historical_prices SET adjustedClose = ? WHERE ticker = ? AND date = ?',
            [price.adjusted_close.toString(), ticker, price.date]
          );
          tickerUpdated++;
        }
      }
      
      updated += tickerUpdated;
      console.log(`[Backfill] Updated ${tickerUpdated} records for ${ticker}`);
      
      // Rate limiting: wait 200ms between requests (5 req/s)
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`[Backfill] Error processing ${ticker}:`, error.message);
    }
  }
  
  console.log(`[Backfill] Complete! Processed ${processed} tickers, updated ${updated} records`);
  await connection.end();
}

backfillAdjustedClose().catch(console.error);
