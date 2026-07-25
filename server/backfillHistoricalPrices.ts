/**
 * Backfill utilities for historical prices
 * Fetches and stores historical price data for specified tickers and date ranges
 */

import { getDb } from "./db";
import { historicalPrices } from "../drizzle/schema";
import { sql } from "drizzle-orm";
import { normalizeTickerForDb } from "./tickerNormalization";
import { getEodhdApiKey } from "./_core/env";
import { toEodhdSymbol } from "./lib/eodhdSymbol";

// A-10: key resolved lazily per call (env with DB-secret fallback)
const EODHD_BASE_URL = "https://eodhd.com/api";

// Chunk size for date range splitting (days)
const CHUNK_SIZE_DAYS = 90;

interface EODHDHistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjusted_close: number;
  volume: number;
}

export interface BackfillResult {
  success: boolean;
  tickersProcessed: number;
  pricesInserted: number;
  pricesUpdated: number;
  missingTickers: string[];
  errors: string[];
}

/**
 * Fetch historical prices from EODHD API
 * 
 * @param ticker Stock ticker symbol (e.g., "AAPL.US", "NOVN.SW")
 * @param fromDate Start date in YYYY-MM-DD format
 * @param toDate End date in YYYY-MM-DD format
 * @returns Array of historical prices
 */
async function fetchHistoricalPricesFromAPI(
  ticker: string,
  fromDate: string,
  toDate: string
): Promise<EODHDHistoricalPrice[]> {
  const apiKey = await getEodhdApiKey();
  if (!apiKey) {
    throw new Error("EODHD_API_KEY is not configured");
  }

  const url = `${EODHD_BASE_URL}/eod/${toEodhdSymbol(ticker)}?api_token=${apiKey}&fmt=json&from=${fromDate}&to=${toDate}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60s timeout per ticker
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) {
      console.error(`[backfillHistoricalPrices] Failed to fetch ${ticker}: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[backfillHistoricalPrices] Timeout (60s) fetching ${ticker} — skipping`);
    } else {
      console.error(`[backfillHistoricalPrices] Error fetching ${ticker}:`, error);
    }
    return [];
  }
}

/**
 * Store historical prices in the database using upsert
 * 
 * @param ticker Ticker symbol
 * @param prices Array of historical prices
 * @returns Object with inserted and updated counts
 */
async function storeHistoricalPrices(
  ticker: string,
  prices: EODHDHistoricalPrice[]
): Promise<{ inserted: number; updated: number }> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  if (prices.length === 0) {
    return { inserted: 0, updated: 0 };
  }

  // Normalize ticker for consistent storage
  const normalizedTicker = normalizeTickerForDb(ticker);

  // Prepare batch insert data
  const insertData = prices.map((price) => ({
    ticker: normalizedTicker,
    date: price.date, // Keep as string (YYYY-MM-DD format)
    close: price.close.toString(), // Keep as string, Drizzle will convert to decimal
    adjustedClose: price.adjusted_close.toString(), // Split-adjusted close price
    source: "eodhd" as const,
  }));

  try {
    // Use upsert to handle duplicates
    // MySQL's ON DUPLICATE KEY UPDATE will update existing rows
    const result = await db
      .insert(historicalPrices)
      .values(insertData)
      .onDuplicateKeyUpdate({
        set: { 
          close: sql`VALUES(close)`,
          adjustedClose: sql`VALUES(adjustedClose)`,
          updatedAt: sql`CURRENT_TIMESTAMP` 
        },
      });

    // Note: MySQL doesn't return affected rows count in a way that distinguishes inserts from updates
    // We'll assume all were inserted for simplicity
    console.log(`[backfillHistoricalPrices] Stored ${insertData.length} prices for ${normalizedTicker}`);
    return { inserted: insertData.length, updated: 0 };
  } catch (error) {
    console.error(`[backfillHistoricalPrices] Error storing prices for ${normalizedTicker}:`, error);
    throw error;
  }
}

/**
 * Split date range into chunks
 * 
 * @param fromDate Start date
 * @param toDate End date
 * @param chunkSizeDays Size of each chunk in days
 * @returns Array of date range chunks
 */
function splitDateRange(
  fromDate: string,
  toDate: string,
  chunkSizeDays: number = CHUNK_SIZE_DAYS
): Array<{ from: string; to: string }> {
  const chunks: Array<{ from: string; to: string }> = [];
  
  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);
  
  const currentStart = new Date(startDate);
  
  while (currentStart < endDate) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + chunkSizeDays - 1);
    
    // Don't go past the end date
    if (currentEnd > endDate) {
      currentEnd.setTime(endDate.getTime());
    }
    
    chunks.push({
      from: currentStart.toISOString().split('T')[0],
      to: currentEnd.toISOString().split('T')[0]
    });
    
    // Move to next chunk
    currentStart.setDate(currentStart.getDate() + chunkSizeDays);
  }
  
  return chunks;
}

/**
 * Backfill historical prices for specified tickers and date range
 * Uses chunking to avoid API rate limits and timeouts
 * 
 * @param tickers Array of ticker symbols
 * @param fromDate Start date (YYYY-MM-DD)
 * @param toDate End date (YYYY-MM-DD)
 * @returns Backfill result summary
 */
export async function backfillHistoricalPrices(
  tickers: string[],
  fromDate: string,
  toDate: string
): Promise<BackfillResult> {
  console.log(`[backfillHistoricalPrices] Starting backfill for ${tickers.length} tickers from ${fromDate} to ${toDate}`);

  const result: BackfillResult = {
    success: true,
    tickersProcessed: 0,
    pricesInserted: 0,
    pricesUpdated: 0,
    missingTickers: [],
    errors: []
  };

  // Normalize all tickers
  const normalizedTickers = tickers.map(t => normalizeTickerForDb(t));

  // Split date range into chunks
  const dateChunks = splitDateRange(fromDate, toDate);
  console.log(`[backfillHistoricalPrices] Split date range into ${dateChunks.length} chunks of ${CHUNK_SIZE_DAYS} days`);

  // Process each ticker
  for (const ticker of normalizedTickers) {
    try {
      console.log(`[backfillHistoricalPrices] Processing ${ticker}...`);
      
      let tickerInserted = 0;
      let tickerUpdated = 0;
      let hasData = false;

      // Process each date chunk
      for (const chunk of dateChunks) {
        try {
          const prices = await fetchHistoricalPricesFromAPI(ticker, chunk.from, chunk.to);
          
          if (prices.length > 0) {
            hasData = true;
            const { inserted, updated } = await storeHistoricalPrices(ticker, prices);
            tickerInserted += inserted;
            tickerUpdated += updated;
          }

          // Rate limiting: wait 200ms between requests (max 5 requests/second)
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          const errorMsg = `Failed to process chunk ${chunk.from} to ${chunk.to} for ${ticker}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(`[backfillHistoricalPrices] ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }

      if (hasData) {
        result.tickersProcessed++;
        result.pricesInserted += tickerInserted;
        result.pricesUpdated += tickerUpdated;
        console.log(`[backfillHistoricalPrices] Completed ${ticker}: ${tickerInserted} inserted, ${tickerUpdated} updated`);
      } else {
        console.warn(`[backfillHistoricalPrices] No data found for ${ticker}`);
        result.missingTickers.push(ticker);
      }

    } catch (error) {
      const errorMsg = `Failed to process ${ticker}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[backfillHistoricalPrices] ${errorMsg}`);
      result.errors.push(errorMsg);
      result.success = false;
    }
  }

  console.log(`[backfillHistoricalPrices] Backfill completed: ${result.tickersProcessed} tickers, ${result.pricesInserted} inserted, ${result.pricesUpdated} updated`);
  
  if (result.missingTickers.length > 0) {
    console.warn(`[backfillHistoricalPrices] Missing tickers:`, result.missingTickers);
  }
  
  if (result.errors.length > 0) {
    console.warn(`[backfillHistoricalPrices] Errors encountered:`, result.errors);
  }

  return result;
}

/**
 * Backfill historical prices for a single ticker
 * Convenience wrapper around backfillHistoricalPrices
 * 
 * @param ticker Ticker symbol
 * @param fromDate Start date (YYYY-MM-DD)
 * @param toDate End date (YYYY-MM-DD)
 * @returns Backfill result summary
 */
export async function backfillHistoricalPricesForTicker(
  ticker: string,
  fromDate: string,
  toDate: string
): Promise<BackfillResult> {
  return backfillHistoricalPrices([ticker], fromDate, toDate);
}
