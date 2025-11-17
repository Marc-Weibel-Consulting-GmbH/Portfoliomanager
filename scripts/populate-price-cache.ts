#!/usr/bin/env node
/**
 * Populate historical prices cache from Yahoo Finance
 * This script fetches 5 years of daily prices for all portfolio stocks
 * and stores them in the historicalPrices table for fast chart loading.
 */

import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import { historicalPrices, stocks } from '../drizzle/schema';

const db = drizzle(process.env.DATABASE_URL);

async function fetchYahooFinanceData(ticker, years = 5) {
  const fromDate = new Date();
  fromDate.setFullYear(fromDate.getFullYear() - years);
  const period1 = Math.floor(fromDate.getTime() / 1000);
  const period2 = Math.floor(new Date().getTime() / 1000);
  
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${period2}&interval=1d`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const result = data.chart?.result?.[0];
    
    if (!result) {
      return [];
    }
    
    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const closes = quotes.close || [];
    
    return timestamps
      .map((ts, idx) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        close: closes[idx]
      }))
      .filter(d => d.close != null);
  } catch (error) {
    console.error(`Failed to fetch ${ticker}:`, error.message);
    return [];
  }
}

async function populateCache() {
  console.log('Fetching all stocks...');
  const allStocks = await db.select().from(stocks);
  console.log(`Found ${allStocks.length} stocks`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < allStocks.length; i++) {
    const stock = allStocks[i];
    const ticker = stock.ticker;
    
    console.log(`[${i + 1}/${allStocks.length}] Fetching ${ticker}...`);
    
    const priceData = await fetchYahooFinanceData(ticker);
    
    if (priceData.length === 0) {
      console.log(`  ❌ No data for ${ticker}`);
      failCount++;
      continue;
    }
    
    // Insert prices into cache
    try {
      for (const price of priceData) {
        await db.insert(historicalPrices).values({
          ticker: ticker,
          date: price.date,
          close: price.close.toString(),
          source: 'yahoo'
        }).onDuplicateKeyUpdate({
          set: {
            close: price.close.toString(),
            updatedAt: new Date()
          }
        });
      }
      
      console.log(`  ✅ Cached ${priceData.length} prices for ${ticker}`);
      successCount++;
    } catch (error) {
      console.error(`  ❌ Failed to cache ${ticker}:`, error.message);
      failCount++;
    }
    
    // Rate limiting: wait 500ms between requests
    if (i < allStocks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`\n✅ Done! Success: ${successCount}, Failed: ${failCount}`);
}

populateCache().catch(console.error);
