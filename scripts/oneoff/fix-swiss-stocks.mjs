#!/usr/bin/env node
/**
 * Bulk update script for Swiss stocks (.SW)
 * Fixes currency (USD -> CHF) and missing Sharpe Ratios
 * Uses multiApiDataMerger with Yahoo Finance for accurate data
 */

import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '.env') });

// Import schema
const { stocks } = await import('./drizzle/schema.ts');

// Import multiApiDataMerger
const { getCompleteStockData } = await import('./server/_core/multiApiDataMerger.ts');

async function main() {
  console.log('[Swiss Stock Fix] Starting bulk update...\n');

  // Connect to database
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);

  // Get all Swiss stocks
  const swissStocks = await db.select().from(stocks).where(eq(stocks.ticker, stocks.ticker));
  const swissOnly = swissStocks.filter(s => s.ticker.endsWith('.SW'));

  console.log(`[Swiss Stock Fix] Found ${swissOnly.length} Swiss stocks\n`);

  let updatedCount = 0;
  let failedCount = 0;
  const failed = [];

  for (const stock of swissOnly) {
    try {
      console.log(`[${stock.ticker}] Fetching data...`);
      
      // Get complete data from multiApiDataMerger
      const completeData = await getCompleteStockData(stock.ticker);

      // Prepare update data
      const updateData = {};

      // Update price and currency
      if (completeData.currentPrice !== null) {
        updateData.currentPrice = completeData.currentPrice.toString();
        console.log(`  ├─ Price: ${updateData.currentPrice} (was: ${stock.currentPrice})`);
      }

      if (completeData.currency) {
        updateData.currency = completeData.currency;
        console.log(`  ├─ Currency: ${updateData.currency} (was: ${stock.currency})`);
      }

      // Update Sharpe Ratio
      if (completeData.sharpe !== null && completeData.sharpe !== undefined) {
        updateData.sharpeRatio = completeData.sharpe.toString();
        console.log(`  ├─ Sharpe: ${updateData.sharpeRatio} (was: ${stock.sharpeRatio || 'NULL'})`);
      }

      // Update other metrics
      if (completeData.pe !== null) {
        updateData.peRatio = completeData.pe.toString();
      }
      if (completeData.peg !== null) {
        updateData.pegRatio = completeData.peg.toString();
      }
      if (completeData.dividendYield !== null) {
        updateData.dividendYield = completeData.dividendYield.toString();
      }
      if (completeData.beta !== null) {
        updateData.beta = completeData.beta.toString();
      }
      if (completeData.volatility !== null) {
        updateData.volatility = completeData.volatility.toString();
      }

      // Update timestamp
      updateData.lastDataRefresh = new Date();

      // Execute update
      if (Object.keys(updateData).length > 1) { // More than just timestamp
        await db.update(stocks)
          .set(updateData)
          .where(eq(stocks.ticker, stock.ticker));
        
        console.log(`  └─ ✅ Updated successfully\n`);
        updatedCount++;
      } else {
        console.log(`  └─ ⚠️  No new data to update\n`);
      }

      // Rate limiting: wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`  └─ ❌ Failed: ${error.message}\n`);
      failed.push({ ticker: stock.ticker, error: error.message });
      failedCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('[Swiss Stock Fix] Summary:');
  console.log(`  Total: ${swissOnly.length}`);
  console.log(`  Updated: ${updatedCount}`);
  console.log(`  Failed: ${failedCount}`);
  
  if (failed.length > 0) {
    console.log('\nFailed stocks:');
    failed.forEach(f => console.log(`  - ${f.ticker}: ${f.error}`));
  }
  
  console.log('='.repeat(60) + '\n');

  await connection.end();
  process.exit(0);
}

main().catch(err => {
  console.error('[Swiss Stock Fix] Fatal error:', err);
  process.exit(1);
});
