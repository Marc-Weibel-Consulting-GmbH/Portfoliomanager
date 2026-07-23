import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { historicalPrices, transactions, savedPortfolios } from "../../drizzle/schema";
import { eodhdEodResponseSchema, payloadSample, type EodhdEodRow } from "../_core/externalSchemas";
import { getEodhdApiKey } from "../_core/env";
// DB-Ticker → EODHD-Symbol zentral in server/lib/eodhdSymbol.ts (auch von Realtime- und
// Dividenden-Pfad genutzt, damit alle EODHD-Abrufe dasselbe Symbol verwenden).
import { toEodhdSymbol } from "../lib/eodhdSymbol";

/**
 * Batch job to import historical prices from EODHD API
 * This job fetches historical price data for all unique tickers in user portfolios
 * and stores them in the historicalPrices table for hypothetical performance calculations.
 */

// A-10: key is resolved lazily per call via getEodhdApiKey() (env with DB-secret
// fallback) — a module-load capture would defeat the DB fallback.
const EODHD_BASE_URL = "https://eodhd.com/api";

/**
 * Shared job-lock identity (D-03): the daily import is triggered both by the
 * in-process cron (cron/historicalPricesCron.ts) and the Heartbeat endpoint
 * (scheduled/historicalPricesScheduled.ts). Both wrap the import in
 * runIfNotRecent with these constants so it runs at most once per window.
 */
export const HISTORICAL_PRICES_JOB_NAME = "historicalPricesImport";
export const HISTORICAL_PRICES_MIN_INTERVAL_MINUTES = 6 * 60; // 6h

/** Tickers that are genuinely not available on EODHD (no working alternative) */
const UNAVAILABLE_TICKERS = new Set<string>([]);

/** Convert a DB ticker to the EODHD format */
function toEodhdTicker(dbTicker: string): string | null {
  if (UNAVAILABLE_TICKERS.has(dbTicker)) return null;
  return toEodhdSymbol(dbTicker);
}

type EODHDHistoricalPrice = EodhdEodRow;

/**
 * Fetch historical prices from EODHD API
 * @param ticker Stock ticker symbol (e.g., "AAPL.US", "NOVN.SW")
 * @param fromDate Start date in YYYY-MM-DD format
 * @param toDate End date in YYYY-MM-DD format
 * @returns Array of historical prices
 */
async function fetchHistoricalPrices(
  ticker: string,
  fromDate: string,
  toDate: string
): Promise<EODHDHistoricalPrice[]> {
  const apiKey = await getEodhdApiKey();
  if (!apiKey) {
    throw new Error("EODHD_API_KEY is not configured");
  }

  const url = `${EODHD_BASE_URL}/eod/${ticker}?api_token=${apiKey}&fmt=json&from=${fromDate}&to=${toDate}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[importHistoricalPrices] Failed to fetch ${ticker}: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    // A-05: validate the provider response instead of trusting it blindly —
    // an HTML error page or rate-limit JSON must not land in price columns.
    const parsed = eodhdEodResponseSchema.safeParse(data);
    if (!parsed.success) {
      console.warn(
        `[importHistoricalPrices] Unexpected EODHD EOD payload for ${ticker}, skipping. Sample: ${payloadSample(data)}`
      );
      return [];
    }
    return parsed.data;
  } catch (error) {
    console.error(`[importHistoricalPrices] Error fetching ${ticker}:`, error);
    return [];
  }
}

/**
 * Fetch a long EOD price series from EODHD for ML training (does NOT touch the DB).
 * Uses adjusted close (split/dividend-adjusted) for clean return-based features.
 * Returns chronologically sorted { dates, prices }.
 */
export async function fetchEodSeries(
  ticker: string,
  fromDate: string,
  toDate: string,
): Promise<{ dates: string[]; prices: number[] }> {
  const rows = await fetchHistoricalPrices(ticker, fromDate, toDate);
  const sorted = rows
    .filter((r) => r && r.date)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const dates: string[] = [];
  const prices: number[] = [];
  for (const r of sorted) {
    const px = (r.adjusted_close ?? r.close);
    if (px > 0) {
      dates.push(r.date);
      prices.push(px);
    }
  }
  return { dates, prices };
}

/**
 * Get all unique tickers from user transactions, portfolio holdings, AND the stocks table (watchlist).
 * The stocks table is the primary source for the KI portfolio algorithm — all stocks there
 * need historical prices for YTD calculation and performance analysis.
 */
async function getUniqueTickers(): Promise<string[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Get tickers from transactions
  const transactionTickers = await db
    .select({ ticker: transactions.ticker })
    .from(transactions)
    .where(sql`${transactions.ticker} IS NOT NULL AND ${transactions.ticker} != ''`)
    .groupBy(transactions.ticker);

  // Get tickers from portfolio holdings (stored in portfolioData JSON)
  const portfolios = await db
    .select({ portfolioData: savedPortfolios.portfolioData })
    .from(savedPortfolios)
    .where(sql`${savedPortfolios.portfolioData} IS NOT NULL`);

  const portfolioTickers = new Set<string>();
  for (const portfolio of portfolios) {
    if (portfolio.portfolioData) {
      try {
        const data = typeof portfolio.portfolioData === 'string' 
          ? JSON.parse(portfolio.portfolioData) 
          : portfolio.portfolioData;
        
        // portfolioData contains { stocks: [...] }
        if (data && Array.isArray(data.stocks)) {
          data.stocks.forEach((stock: any) => {
            if (!stock.ticker) return;
            // Skip bonds (ISIN-based tickers like CH0123456789) — no EODHD EOD data
            // Bonds are valued by nominal × kurs%, not by historical price series
            if (stock.assetType === 'bond') return;
            // Skip crypto certificates stored as ISIN (e.g. CH0595154060)
            // These have no direct EODHD EOD endpoint
            if (stock.assetType === 'crypto' && /^[A-Z]{2}\d{10}$/.test(stock.ticker)) return;
            portfolioTickers.add(stock.ticker);
          });
        }
      } catch (error) {
        console.error('[importHistoricalPrices] Error parsing portfolio data:', error);
      }
    }
  }

  // === BACKFILL: All stocks in the stocks table (watchlist / KI algorithm universe) ===
  // These need historical prices for YTD calculation, signalScore, and portfolio proposals.
  const { stocks: stocksTable } = await import("../../drizzle/schema");
  const watchlistStocks = await db
    .select({ ticker: stocksTable.ticker })
    .from(stocksTable)
    .where(sql`${stocksTable.ticker} IS NOT NULL AND ${stocksTable.ticker} != ''`);
  const watchlistTickers = watchlistStocks.map((r: any) => r.ticker).filter((t: string) => !!t);
  console.log(`[importHistoricalPrices] Found ${watchlistTickers.length} tickers in stocks table (watchlist)`);

  // Benchmark proxy tickers — always kept up-to-date so KPI header and chart are consistent
  const BENCHMARK_TICKERS = ['ACWI.US', 'CHSPI.SW', 'SPY', 'QQQ', 'FEZ'];

  // Combine all sources and deduplicate
  const allTickers = new Set<string>([
    ...transactionTickers.map((r) => r.ticker).filter((t): t is string => !!t),
    ...Array.from(portfolioTickers),
    ...watchlistTickers,
    ...BENCHMARK_TICKERS,
  ]);

  return Array.from(allTickers);
}

/**
 * Check if historical prices already exist for a ticker and date range
 */
async function hasHistoricalPrices(ticker: string, fromDate: string, toDate: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Check if the most recent data point is within 5 calendar days of toDate.
  // This ensures we re-fetch if recent days are missing (e.g. after server downtime).
  // A count-based check is insufficient because it passes even when the latest days are absent.
  const { desc: descOrder } = await import("drizzle-orm");
  const latestRow = await db
    .select({ date: historicalPrices.date })
    .from(historicalPrices)
    .where(
      and(
        eq(historicalPrices.ticker, ticker),
        sql`${historicalPrices.date} >= ${fromDate}`,
        sql`${historicalPrices.date} <= ${toDate}`
      )
    )
    .orderBy(descOrder(historicalPrices.date))
    .limit(1);

  if (!latestRow.length) return false;

  const rawDate = latestRow[0].date as unknown;
  const latestDate = rawDate instanceof Date
    ? rawDate.toISOString().split('T')[0]
    : String(rawDate).split('T')[0];

  // Allow up to 5 calendar days gap (covers weekends + public holidays)
  const latestMs = new Date(latestDate).getTime();
  const toMs = new Date(toDate).getTime();
  const gapDays = (toMs - latestMs) / (1000 * 60 * 60 * 24);
  return gapDays <= 5;
}

/**
 * Store historical prices in the database
 */
async function storeHistoricalPrices(ticker: string, prices: EODHDHistoricalPrice[]): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  if (prices.length === 0) {
    return 0;
  }

  // Prepare batch insert data
  const insertData = prices.map((price) => ({
    ticker,
    date: price.date,
    close: price.close.toString(),
    source: "eodhd" as const,
  }));

  try {
    // Use INSERT IGNORE to skip duplicates
    await db.insert(historicalPrices).values(insertData).onDuplicateKeyUpdate({
      set: { close: sql`VALUES(close)`, updatedAt: sql`CURRENT_TIMESTAMP` },
    });

    console.log(`[importHistoricalPrices] Stored ${insertData.length} prices for ${ticker}`);
    return insertData.length;
  } catch (error) {
    console.error(`[importHistoricalPrices] Error storing prices for ${ticker}:`, error);
    return 0;
  }
}

/**
 * Main import function
 * @param fromDate Start date (default: beginning of current year)
 * @param toDate End date (default: today)
 * @param forceRefresh If true, re-fetch even if data exists
 */
export async function importHistoricalPrices(
  fromDate?: string,
  toDate?: string,
  forceRefresh: boolean = false
): Promise<{ success: boolean; tickersProcessed: number; pricesImported: number; errors: string[] }> {
  console.log("[importHistoricalPrices] Starting historical price import...");

  // Default date range: beginning of current year to today
  const now = new Date();
  const defaultFromDate = `${now.getFullYear()}-01-01`;
  const defaultToDate = now.toISOString().split("T")[0];

  const from = fromDate || defaultFromDate;
  const to = toDate || defaultToDate;

  console.log(`[importHistoricalPrices] Date range: ${from} to ${to}`);

  try {
    // Get all unique tickers from transactions
    const tickers = await getUniqueTickers();
    console.log(`[importHistoricalPrices] Found ${tickers.length} unique tickers`);

    if (tickers.length === 0) {
      console.log("[importHistoricalPrices] No tickers found, nothing to import");
      return { success: true, tickersProcessed: 0, pricesImported: 0, errors: [] };
    }

    let tickersProcessed = 0;
    let totalPricesImported = 0;
    const errors: string[] = [];

    // Process each ticker
    for (const ticker of tickers) {
      try {
        // Skip if data already exists (unless forceRefresh)
        if (!forceRefresh && (await hasHistoricalPrices(ticker, from, to))) {
          console.log(`[importHistoricalPrices] Skipping ${ticker} - data already exists`);
          continue;
        }

        // Map DB ticker to EODHD ticker format
        const eodhdTicker = toEodhdTicker(ticker);
        if (!eodhdTicker) {
          console.log(`[importHistoricalPrices] Skipping ${ticker} - not available on EODHD`);
          continue;
        }

        console.log(`[importHistoricalPrices] Fetching prices for ${ticker} (EODHD: ${eodhdTicker})...`);
        const prices = await fetchHistoricalPrices(eodhdTicker, from, to);

        if (prices.length > 0) {
          const imported = await storeHistoricalPrices(ticker, prices);
          totalPricesImported += imported;
          tickersProcessed++;
        } else {
          console.warn(`[importHistoricalPrices] No prices found for ${ticker}`);
          errors.push(`No prices found for ${ticker}`);
        }

        // Rate limiting: wait 200ms between requests (max 5 requests/second)
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        const errorMsg = `Failed to process ${ticker}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[importHistoricalPrices] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(
      `[importHistoricalPrices] Import completed: ${tickersProcessed} tickers processed, ${totalPricesImported} prices imported`
    );

    return {
      success: true,
      tickersProcessed,
      pricesImported: totalPricesImported,
      errors,
    };
  } catch (error) {
    console.error("[importHistoricalPrices] Fatal error:", error);
    return {
      success: false,
      tickersProcessed: 0,
      pricesImported: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Import historical prices for a specific ticker
 * Useful for on-demand imports when a new stock is added to a portfolio
 */
export async function importHistoricalPricesForTicker(
  ticker: string,
  fromDate?: string,
  toDate?: string
): Promise<{ success: boolean; pricesImported: number }> {
  console.log(`[importHistoricalPrices] Importing prices for ${ticker}...`);

  const now = new Date();
  const defaultFromDate = `${now.getFullYear()}-01-01`;
  const defaultToDate = now.toISOString().split("T")[0];

  const from = fromDate || defaultFromDate;
  const to = toDate || defaultToDate;

  try {
    // Map DB ticker to EODHD format (e.g. MRVL → MRVL.US, NESN.SW stays NESN.SW)
    const eodhdTicker = toEodhdTicker(ticker);
    if (!eodhdTicker) {
      console.warn(`[importHistoricalPrices] Ticker ${ticker} not available on EODHD, skipping`);
      return { success: false, pricesImported: 0 };
    }

    const prices = await fetchHistoricalPrices(eodhdTicker, from, to);
    if (prices.length === 0) {
      console.warn(`[importHistoricalPrices] No prices found for ${ticker} (EODHD: ${eodhdTicker})`);
      return { success: false, pricesImported: 0 };
    }

    // Store prices using the original DB ticker (not the EODHD ticker)
    const imported = await storeHistoricalPrices(ticker, prices);
    console.log(`[importHistoricalPrices] Stored ${imported} prices for ${ticker}`);
    return { success: true, pricesImported: imported };
  } catch (error) {
    console.error(`[importHistoricalPrices] Error importing ${ticker}:`, error);
    return { success: false, pricesImported: 0 };
  }
}
