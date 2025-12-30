import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { historicalPrices, transactions, savedPortfolios } from "../../drizzle/schema";

/**
 * Batch job to import historical prices from EODHD API
 * This job fetches historical price data for all unique tickers in user portfolios
 * and stores them in the historicalPrices table for hypothetical performance calculations.
 */

const EODHD_API_KEY = process.env.EODHD_API_KEY;
const EODHD_BASE_URL = "https://eodhd.com/api";

interface EODHDHistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjusted_close: number;
  volume: number;
}

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
  if (!EODHD_API_KEY) {
    throw new Error("EODHD_API_KEY is not configured");
  }

  const url = `${EODHD_BASE_URL}/eod/${ticker}?api_token=${EODHD_API_KEY}&fmt=json&from=${fromDate}&to=${toDate}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[importHistoricalPrices] Failed to fetch ${ticker}: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`[importHistoricalPrices] Error fetching ${ticker}:`, error);
    return [];
  }
}

/**
 * Get all unique tickers from user transactions AND portfolio holdings
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
            if (stock.ticker) {
              portfolioTickers.add(stock.ticker);
            }
          });
        }
      } catch (error) {
        console.error('[importHistoricalPrices] Error parsing portfolio data:', error);
      }
    }
  }

  // Combine both sources and deduplicate
  const allTickers = new Set<string>([
    ...transactionTickers.map((r) => r.ticker).filter((t): t is string => !!t),
    ...Array.from(portfolioTickers)
  ]);

  return Array.from(allTickers);
}

/**
 * Check if historical prices already exist for a ticker and date range
 */
async function hasHistoricalPrices(ticker: string, fromDate: string, toDate: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(historicalPrices)
    .where(
      and(
        eq(historicalPrices.ticker, ticker),
        sql`${historicalPrices.date} >= ${fromDate}`,
        sql`${historicalPrices.date} <= ${toDate}`
      )
    );

  const count = result[0]?.count ?? 0;
  // Consider it "has data" if we have at least 50% of expected trading days (roughly 130 days for 6 months)
  const expectedDays = Math.floor((new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24));
  const expectedTradingDays = Math.floor(expectedDays * 0.7); // Assume 70% are trading days
  return count >= expectedTradingDays * 0.5;
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

        console.log(`[importHistoricalPrices] Fetching prices for ${ticker}...`);
        const prices = await fetchHistoricalPrices(ticker, from, to);

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
    const prices = await fetchHistoricalPrices(ticker, from, to);
    if (prices.length === 0) {
      console.warn(`[importHistoricalPrices] No prices found for ${ticker}`);
      return { success: false, pricesImported: 0 };
    }

    const imported = await storeHistoricalPrices(ticker, prices);
    return { success: true, pricesImported: imported };
  } catch (error) {
    console.error(`[importHistoricalPrices] Error importing ${ticker}:`, error);
    return { success: false, pricesImported: 0 };
  }
}
