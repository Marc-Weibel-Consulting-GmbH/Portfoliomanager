/**
 * Automatic MAX-Backfill Policy for New Symbols
 * 
 * This module ensures that every new symbol receives a complete historical data backfill
 * when it first appears in the system. This is critical for accurate performance calculations
 * and hypothetical portfolio analysis.
 * 
 * Key Features:
 * - Detects new symbols that have no or insufficient historical data
 * - Automatically triggers MAX backfill (5 years of data)
 * - Tracks backfill status to avoid duplicate work
 * - Integrates with portfolio creation and stock addition workflows
 */

import { getDb } from "./db";
import { historicalPrices } from "../drizzle/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { normalizeTickerForDb, getTickerVariants } from "./tickerNormalization";
import { backfillHistoricalPrices } from "./backfillHistoricalPrices";

// Configuration
const MAX_BACKFILL_YEARS = 15; // How many years of data to fetch for new symbols (extended from 5 to 15)
const MIN_REQUIRED_DATA_POINTS = 100; // Minimum data points to consider a symbol "backfilled"
const BACKFILL_QUEUE_DELAY_MS = 500; // Delay between processing queue items

// In-memory tracking of pending backfills to avoid duplicate requests
const pendingBackfills = new Set<string>();
const completedBackfills = new Map<string, Date>(); // ticker -> completion time

export interface BackfillStatus {
  ticker: string;
  hasData: boolean;
  dataPoints: number;
  minDate: string | null;
  maxDate: string | null;
  needsBackfill: boolean;
  isBackfilling: boolean;
}

export interface AutoBackfillResult {
  ticker: string;
  success: boolean;
  pricesInserted: number;
  message: string;
  duration: number; // milliseconds
}

/**
 * Check if a symbol has sufficient historical data
 * 
 * @param ticker Stock ticker symbol
 * @returns BackfillStatus with data availability information
 */
export async function checkSymbolDataStatus(ticker: string): Promise<BackfillStatus> {
  const db = await getDb();
  if (!db) {
    return {
      ticker,
      hasData: false,
      dataPoints: 0,
      minDate: null,
      maxDate: null,
      needsBackfill: true,
      isBackfilling: pendingBackfills.has(normalizeTickerForDb(ticker))
    };
  }

  const normalizedTicker = normalizeTickerForDb(ticker);
  const variants = getTickerVariants(normalizedTicker);
  
  // Check all variants for data
  let bestVariant = normalizedTicker;
  let maxDataPoints = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (const variant of variants) {
    const [result] = await db
      .select({
        count: sql<number>`COUNT(*)`,
        minDate: sql<string>`MIN(${historicalPrices.date})`,
        maxDate: sql<string>`MAX(${historicalPrices.date})`
      })
      .from(historicalPrices)
      .where(eq(historicalPrices.ticker, variant));

    const count = Number(result?.count ?? 0);
    if (count > maxDataPoints) {
      maxDataPoints = count;
      bestVariant = variant;
      minDate = result?.minDate || null;
      maxDate = result?.maxDate || null;
    }
  }

  const hasData = maxDataPoints > 0;
  const needsBackfill = maxDataPoints < MIN_REQUIRED_DATA_POINTS;
  const isBackfilling = pendingBackfills.has(normalizedTicker);

  return {
    ticker: bestVariant,
    hasData,
    dataPoints: maxDataPoints,
    minDate,
    maxDate,
    needsBackfill,
    isBackfilling
  };
}

/**
 * Trigger MAX backfill for a single symbol
 * This fetches the maximum available historical data (5 years)
 * 
 * @param ticker Stock ticker symbol
 * @param force Force backfill even if data exists
 * @returns AutoBackfillResult with operation details
 */
export async function triggerMaxBackfillForSymbol(
  ticker: string,
  force: boolean = false
): Promise<AutoBackfillResult> {
  const startTime = Date.now();
  const normalizedTicker = normalizeTickerForDb(ticker);

  // Check if already backfilling
  if (pendingBackfills.has(normalizedTicker)) {
    return {
      ticker: normalizedTicker,
      success: false,
      pricesInserted: 0,
      message: "Backfill already in progress for this symbol",
      duration: Date.now() - startTime
    };
  }

  // Check if recently completed (within last hour)
  const recentCompletion = completedBackfills.get(normalizedTicker);
  if (recentCompletion && !force) {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (recentCompletion > hourAgo) {
      return {
        ticker: normalizedTicker,
        success: true,
        pricesInserted: 0,
        message: "Backfill recently completed, skipping",
        duration: Date.now() - startTime
      };
    }
  }

  // Check current data status
  const status = await checkSymbolDataStatus(ticker);
  
  if (!status.needsBackfill && !force) {
    return {
      ticker: normalizedTicker,
      success: true,
      pricesInserted: 0,
      message: `Symbol already has sufficient data (${status.dataPoints} data points)`,
      duration: Date.now() - startTime
    };
  }

  // Mark as pending
  pendingBackfills.add(normalizedTicker);
  console.log(`[AutoBackfill] Starting MAX backfill for ${normalizedTicker}...`);

  try {
    // Calculate date range (5 years back from today)
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setFullYear(fromDate.getFullYear() - MAX_BACKFILL_YEARS);

    const fromDateStr = fromDate.toISOString().split('T')[0];
    const toDateStr = toDate.toISOString().split('T')[0];

    console.log(`[AutoBackfill] Fetching data for ${normalizedTicker} from ${fromDateStr} to ${toDateStr}`);

    // Execute backfill
    const result = await backfillHistoricalPrices([normalizedTicker], fromDateStr, toDateStr);

    // Mark as completed
    completedBackfills.set(normalizedTicker, new Date());

    const duration = Date.now() - startTime;
    
    if (result.success && result.pricesInserted > 0) {
      console.log(`[AutoBackfill] Successfully backfilled ${normalizedTicker}: ${result.pricesInserted} prices in ${duration}ms`);
      return {
        ticker: normalizedTicker,
        success: true,
        pricesInserted: result.pricesInserted,
        message: `Successfully backfilled ${result.pricesInserted} historical prices`,
        duration
      };
    } else if (result.missingTickers.includes(normalizedTicker)) {
      console.warn(`[AutoBackfill] No data available for ${normalizedTicker}`);
      return {
        ticker: normalizedTicker,
        success: false,
        pricesInserted: 0,
        message: "No historical data available from API",
        duration
      };
    } else {
      return {
        ticker: normalizedTicker,
        success: true,
        pricesInserted: 0,
        message: "Symbol already has recent data",
        duration
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[AutoBackfill] Error backfilling ${normalizedTicker}:`, errorMsg);
    return {
      ticker: normalizedTicker,
      success: false,
      pricesInserted: 0,
      message: `Backfill failed: ${errorMsg}`,
      duration: Date.now() - startTime
    };
  } finally {
    // Remove from pending
    pendingBackfills.delete(normalizedTicker);
  }
}

/**
 * Ensure multiple symbols have MAX backfill
 * Processes symbols in sequence to avoid API rate limits
 * 
 * @param tickers Array of ticker symbols
 * @param force Force backfill even if data exists
 * @returns Array of AutoBackfillResult for each ticker
 */
export async function ensureMaxBackfillForSymbols(
  tickers: string[],
  force: boolean = false
): Promise<AutoBackfillResult[]> {
  const results: AutoBackfillResult[] = [];
  const uniqueTickers = Array.from(new Set(tickers.map(t => normalizeTickerForDb(t))));

  console.log(`[AutoBackfill] Processing ${uniqueTickers.length} symbols for MAX backfill...`);

  for (const ticker of uniqueTickers) {
    const result = await triggerMaxBackfillForSymbol(ticker, force);
    results.push(result);

    // Add delay between requests to respect API rate limits
    if (result.pricesInserted > 0) {
      await new Promise(resolve => setTimeout(resolve, BACKFILL_QUEUE_DELAY_MS));
    }
  }

  const successful = results.filter(r => r.success).length;
  const totalPrices = results.reduce((sum, r) => sum + r.pricesInserted, 0);
  
  console.log(`[AutoBackfill] Completed: ${successful}/${uniqueTickers.length} symbols, ${totalPrices} total prices inserted`);

  return results;
}

/**
 * Check and backfill new symbols automatically
 * This is the main entry point for automatic backfill on new symbol detection
 * 
 * @param tickers Array of ticker symbols to check
 * @returns Object with status for each ticker and any backfill results
 */
export async function autoBackfillNewSymbols(
  tickers: string[]
): Promise<{
  statuses: BackfillStatus[];
  backfillResults: AutoBackfillResult[];
  newSymbolsDetected: number;
}> {
  const statuses: BackfillStatus[] = [];
  const symbolsNeedingBackfill: string[] = [];

  // Check status for all tickers
  for (const ticker of tickers) {
    const status = await checkSymbolDataStatus(ticker);
    statuses.push(status);

    if (status.needsBackfill && !status.isBackfilling) {
      symbolsNeedingBackfill.push(status.ticker);
    }
  }

  // Trigger backfill for symbols that need it
  let backfillResults: AutoBackfillResult[] = [];
  if (symbolsNeedingBackfill.length > 0) {
    console.log(`[AutoBackfill] Detected ${symbolsNeedingBackfill.length} new symbols needing backfill:`, symbolsNeedingBackfill);
    backfillResults = await ensureMaxBackfillForSymbols(symbolsNeedingBackfill);
  }

  return {
    statuses,
    backfillResults,
    newSymbolsDetected: symbolsNeedingBackfill.length
  };
}

/**
 * Get current backfill queue status
 * Useful for monitoring and debugging
 */
export function getBackfillQueueStatus(): {
  pendingCount: number;
  pendingTickers: string[];
  recentlyCompletedCount: number;
} {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentlyCompleted = Array.from(completedBackfills.entries())
    .filter(([_, date]) => date > hourAgo);

  return {
    pendingCount: pendingBackfills.size,
    pendingTickers: Array.from(pendingBackfills),
    recentlyCompletedCount: recentlyCompleted.length
  };
}

/**
 * Clear completed backfills cache
 * Useful for forcing re-backfill of all symbols
 */
export function clearBackfillCache(): void {
  completedBackfills.clear();
  console.log("[AutoBackfill] Cleared backfill cache");
}
