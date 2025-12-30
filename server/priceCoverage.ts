/**
 * Price coverage utilities for debugging and monitoring historical price data availability
 */

import { getDb } from "./db";
import { historicalPrices, portfolioTransactions, savedPortfolios } from "../drizzle/schema";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import { normalizeTickerForDb, getTickerVariants } from "./tickerNormalization";

export interface TickerCoverageInfo {
  ticker: string;
  minDate: string | null;
  maxDate: string | null;
  totalRows: number;
  rowsInRange: number;
  firstInRangeDate: string | null;
  lastInRangeDate: string | null;
}

export interface PriceCoverageResult {
  tickers: TickerCoverageInfo[];
  distinctTickerSample: string[];
  requestedRange: {
    from: string;
    to: string;
  };
}

/**
 * Check price coverage for a list of tickers
 * 
 * @param tickers Array of ticker symbols to check
 * @param from Start date (default: 2025-01-01)
 * @param to End date (default: today)
 * @returns Coverage information for each ticker
 */
export async function checkPriceCoverage(
  tickers: string[],
  from?: string,
  to?: string
): Promise<PriceCoverageResult> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const now = new Date();
  const fromDate = from || "2025-01-01";
  const toDate = to || now.toISOString().split("T")[0];

  // Normalize tickers
  const normalizedTickers = tickers.map(t => normalizeTickerForDb(t));

  const coverageInfo: TickerCoverageInfo[] = [];

  // Check coverage for each ticker
  for (const ticker of normalizedTickers) {
    // Get all variants to check
    const variants = getTickerVariants(ticker);

    // Try to find data with any variant
    let bestVariant = ticker;
    let maxRowCount = 0;

    for (const variant of variants) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(historicalPrices)
        .where(eq(historicalPrices.ticker, variant));

      const count = Number(countResult?.count ?? 0);
      if (count > maxRowCount) {
        maxRowCount = count;
        bestVariant = variant;
      }
    }

    // Use the variant with most data
    const tickerToUse = maxRowCount > 0 ? bestVariant : ticker;

    // Get min/max dates
    const [minMaxResult] = await db
      .select({
        minDate: sql<string>`MIN(${historicalPrices.date})`,
        maxDate: sql<string>`MAX(${historicalPrices.date})`,
        totalRows: sql<number>`COUNT(*)`
      })
      .from(historicalPrices)
      .where(eq(historicalPrices.ticker, tickerToUse));

    // Get rows in requested range
    const [rangeResult] = await db
      .select({
        count: sql<number>`COUNT(*)`,
        minDate: sql<string>`MIN(${historicalPrices.date})`,
        maxDate: sql<string>`MAX(${historicalPrices.date})`
      })
      .from(historicalPrices)
      .where(
        and(
          eq(historicalPrices.ticker, tickerToUse),
          gte(historicalPrices.date, fromDate),
          lte(historicalPrices.date, toDate)
        )
      );

    coverageInfo.push({
      ticker: tickerToUse,
      minDate: minMaxResult?.minDate || null,
      maxDate: minMaxResult?.maxDate || null,
      totalRows: Number(minMaxResult?.totalRows ?? 0),
      rowsInRange: Number(rangeResult?.count ?? 0),
      firstInRangeDate: rangeResult?.minDate || null,
      lastInRangeDate: rangeResult?.maxDate || null
    });
  }

  // Get a sample of distinct tickers from the database
  const distinctTickersResult = await db
    .select({ ticker: historicalPrices.ticker })
    .from(historicalPrices)
    .groupBy(historicalPrices.ticker)
    .limit(200);

  const distinctTickerSample = distinctTickersResult.map(r => r.ticker);

  return {
    tickers: coverageInfo,
    distinctTickerSample,
    requestedRange: {
      from: fromDate,
      to: toDate
    }
  };
}

/**
 * Get all relevant tickers for a portfolio
 * Includes tickers from both transactions and holdings
 * 
 * @param portfolioId Portfolio ID
 * @returns Array of unique normalized ticker symbols
 */
export async function getRelevantTickersForPortfolio(portfolioId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const tickers = new Set<string>();

  // Get tickers from transactions
  const transactions = await db
    .select({ ticker: portfolioTransactions.ticker })
    .from(portfolioTransactions)
    .where(eq(portfolioTransactions.portfolioId, portfolioId));

  for (const tx of transactions) {
    if (tx.ticker) {
      tickers.add(normalizeTickerForDb(tx.ticker));
    }
  }

  // Get tickers from portfolio definition (if it has holdings/weights)
  const [portfolio] = await db
    .select()
    .from(savedPortfolios)
    .where(eq(savedPortfolios.id, portfolioId))
    .limit(1);

  if (portfolio?.portfolioData) {
    try {
      const portfolioData = typeof portfolio.portfolioData === 'string' 
        ? JSON.parse(portfolio.portfolioData) 
        : portfolio.portfolioData;

      // portfolioData can be an array of holdings or an object with stocks property
      const holdings = Array.isArray(portfolioData) ? portfolioData : portfolioData?.stocks || [];

      if (Array.isArray(holdings)) {
        for (const holding of holdings) {
          if (holding.ticker) {
            tickers.add(normalizeTickerForDb(holding.ticker));
          }
        }
      }
    } catch (error) {
      console.error(`[getRelevantTickersForPortfolio] Error parsing portfolioData for portfolio ${portfolioId}:`, error);
    }
  }

  return Array.from(tickers);
}

/**
 * Get all unique tickers from all portfolios
 * Useful for bulk backfill operations
 * 
 * @returns Array of unique normalized ticker symbols
 */
export async function getAllPortfolioTickers(): Promise<string[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const tickers = new Set<string>();

  // Get all tickers from transactions
  const transactions = await db
    .select({ ticker: portfolioTransactions.ticker })
    .from(portfolioTransactions)
    .where(sql`${portfolioTransactions.ticker} IS NOT NULL AND ${portfolioTransactions.ticker} != ''`)
    .groupBy(portfolioTransactions.ticker);

  for (const tx of transactions) {
    if (tx.ticker) {
      tickers.add(normalizeTickerForDb(tx.ticker));
    }
  }

  // Get all tickers from portfolio holdings
  const portfolios = await db
    .select({ portfolioData: savedPortfolios.portfolioData })
    .from(savedPortfolios)
    .where(sql`${savedPortfolios.portfolioData} IS NOT NULL`);

  for (const portfolio of portfolios) {
    if (portfolio.portfolioData) {
      try {
        const portfolioData = typeof portfolio.portfolioData === 'string' 
          ? JSON.parse(portfolio.portfolioData) 
          : portfolio.portfolioData;

        // portfolioData can be an array of holdings or an object with stocks property
        const holdings = Array.isArray(portfolioData) ? portfolioData : portfolioData?.stocks || [];

        if (Array.isArray(holdings)) {
          for (const holding of holdings) {
            if (holding.ticker) {
              tickers.add(normalizeTickerForDb(holding.ticker));
            }
          }
        }
      } catch (error) {
        // Skip invalid JSON
        continue;
      }
    }
  }

  return Array.from(tickers);
}
