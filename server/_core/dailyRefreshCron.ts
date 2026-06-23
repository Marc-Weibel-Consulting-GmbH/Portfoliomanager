/**
 * Daily Stock Data Refresh Cron Job
 * 
 * Automatically updates all stock metrics (prices, Sharpe Ratios, PE, PEG, etc.)
 * every day at 2 AM UTC using Yahoo Finance via multiApiDataMerger.
 * 
 * Features:
 * - Batch processing with rate limiting (500ms between requests)
 * - Error handling with retry logic
 * - Logging for monitoring
 * - Skips stocks updated within last 12 hours (configurable)
 */

import cron from 'node-cron';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq, lt } from 'drizzle-orm';
import mysql from 'mysql2/promise';
import { stocks } from '../../drizzle/schema';
import { fetchCompleteStockData } from './multiApiDataMerger';
import { recordMetricsSnapshot } from './historicalMetricsRecorder';

const RATE_LIMIT_MS = 500; // 500ms between API calls
const MIN_REFRESH_INTERVAL_HOURS = 12; // Only refresh if last update was >12h ago

interface RefreshResult {
  total: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ ticker: string; error: string }>;
}

/**
 * Refresh all stocks in the database with latest data
 */
export async function refreshAllStocks(options: { force?: boolean } = {}): Promise<RefreshResult> {
  console.log('[Daily Refresh] Starting automated stock data refresh...');
  
  const result: RefreshResult = {
    total: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  let connection: mysql.Connection | null = null;

  try {
    // Connect to database
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not configured');
    }

    connection = await mysql.createConnection(process.env.DATABASE_URL);
    const db = drizzle(connection);

    // Get all stocks
    const allStocks = await db.select().from(stocks);
    result.total = allStocks.length;

    console.log(`[Daily Refresh] Found ${allStocks.length} stocks to process`);

    // Calculate cutoff time for refresh (only update if older than MIN_REFRESH_INTERVAL_HOURS)
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - MIN_REFRESH_INTERVAL_HOURS);

    for (const stock of allStocks) {
      try {
        // Skip if recently updated (unless forced, e.g. one-time backfill)
        if (!options.force && stock.lastDataRefresh && stock.lastDataRefresh > cutoffTime) {
          console.log(`[${stock.ticker}] Skipped (updated ${Math.round((Date.now() - stock.lastDataRefresh.getTime()) / 1000 / 60)} min ago)`);
          result.skipped++;
          continue;
        }

        console.log(`[${stock.ticker}] Fetching latest data...`);

        // Fetch complete data from multiApiDataMerger
        const completeData = await fetchCompleteStockData(stock.ticker);

        // Prepare update data
        const updateData: any = {
          lastDataRefresh: new Date(),
        };

        // Update price and currency
        if (completeData.currentPrice !== null) {
          updateData.currentPrice = completeData.currentPrice.toString();
        }
        if (completeData.currency) {
          updateData.currency = completeData.currency;
        }

        // Update metrics
        if (completeData.sharpe !== null && completeData.sharpe !== undefined) {
          updateData.sharpeRatio = completeData.sharpe.toString();
        }
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

        // Execute update
        await db.update(stocks)
          .set(updateData)
          .where(eq(stocks.ticker, stock.ticker));

        // Record historical snapshot
        await recordMetricsSnapshot({
          ticker: stock.ticker,
          sharpeRatio: updateData.sharpeRatio,
          peRatio: updateData.peRatio,
          pegRatio: updateData.pegRatio,
          dividendYield: updateData.dividendYield,
          beta: updateData.beta,
          volatility: updateData.volatility,
          currentPrice: updateData.currentPrice,
        });

        console.log(`[${stock.ticker}] ✅ Updated successfully`);
        result.updated++;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));

      } catch (error: any) {
        console.error(`[${stock.ticker}] ❌ Failed:`, error.message);
        result.failed++;
        result.errors.push({
          ticker: stock.ticker,
          error: error.message,
        });
      }
    }

    console.log('[Daily Refresh] Completed!');
    console.log(`  Total: ${result.total}`);
    console.log(`  Updated: ${result.updated}`);
    console.log(`  Skipped: ${result.skipped}`);
    console.log(`  Failed: ${result.failed}`);

  } catch (error: any) {
    console.error('[Daily Refresh] Fatal error:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }

  return result;
}

/**
 * Initialize the daily refresh cron job.
 * Runs every day at 23:00 UTC — after both EU and US market close — so the
 * daily change ("Heute"), prices and metrics reflect the latest trading day.
 */
export function initDailyRefreshCron() {
  // Cron format: second minute hour day month dayOfWeek
  cron.schedule('0 0 23 * * *', async () => {
    console.log('[Daily Refresh] Cron job triggered');
    try {
      await refreshAllStocks();
    } catch (error) {
      console.error('[Daily Refresh] Cron job failed:', error);
    }
  });

  console.log('[Daily Refresh] Cron job initialized (runs daily at 23:00 UTC)');
}
