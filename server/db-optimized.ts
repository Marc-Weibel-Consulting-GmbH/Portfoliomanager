/**
 * Optimized database queries for batch loading
 * Eliminates N+1 query problems
 */

import { getDb } from "./db";
import { portfolioTransactions, stocks, historicalPrices } from "../drizzle/schema";
import { inArray, and, eq, desc, lte } from "drizzle-orm";

/**
 * Batch load transactions for multiple portfolios
 * Instead of N queries (one per portfolio), this does 1 query
 */
export async function batchGetPortfolioTransactions(portfolioIds: number[]) {
  const db = await getDb();
  if (!db || portfolioIds.length === 0) return new Map();
  
  try {
    const { realizedGains } = await import("../drizzle/schema");
    
    const allTransactions = await db
      .select({
        id: portfolioTransactions.id,
        portfolioId: portfolioTransactions.portfolioId,
        transactionType: portfolioTransactions.transactionType,
        ticker: portfolioTransactions.ticker,
        shares: portfolioTransactions.shares,
        pricePerShare: portfolioTransactions.pricePerShare,
        totalAmount: portfolioTransactions.totalAmount,
        currency: portfolioTransactions.currency,
        fxRate: portfolioTransactions.fxRate,
        totalAmountCHF: portfolioTransactions.totalAmountCHF,
        transactionDate: portfolioTransactions.transactionDate,
        notes: portfolioTransactions.notes,
        createdAt: portfolioTransactions.createdAt,
        realizedGain: realizedGains.realizedGain,
        realizedGainPercent: realizedGains.realizedGainPercent,
      })
      .from(portfolioTransactions)
      .leftJoin(realizedGains, eq(portfolioTransactions.id, realizedGains.transactionId))
      .where(inArray(portfolioTransactions.portfolioId, portfolioIds))
      .orderBy(desc(portfolioTransactions.transactionDate));
    
    // Group by portfolio ID
    const transactionsByPortfolio = new Map<number, typeof allTransactions>();
    for (const tx of allTransactions) {
      const portfolioId = tx.portfolioId;
      if (!transactionsByPortfolio.has(portfolioId)) {
        transactionsByPortfolio.set(portfolioId, []);
      }
      transactionsByPortfolio.get(portfolioId)!.push(tx);
    }
    
    return transactionsByPortfolio;
  } catch (error) {
    console.error("[DB] Error batch loading transactions:", error);
    return new Map();
  }
}

/**
 * Batch load stocks by tickers
 * Instead of N queries (one per ticker), this does 1 query
 */
export async function batchGetStocks(tickers: string[]) {
  const db = await getDb();
  if (!db || tickers.length === 0) return new Map();
  
  try {
    const allStocks = await db
      .select()
      .from(stocks)
      .where(inArray(stocks.ticker, tickers));
    
    return new Map(allStocks.map(s => [s.ticker, s]));
  } catch (error) {
    console.error("[DB] Error batch loading stocks:", error);
    return new Map();
  }
}

/**
 * Batch load historical prices for multiple tickers at a specific date
 * Instead of N queries (one per ticker), this does 1 query
 */
export async function batchGetHistoricalPrices(tickers: string[], targetDate: string) {
  const db = await getDb();
  if (!db || tickers.length === 0) return new Map();
  
  try {
    const pricesMap = new Map<string, number>();
    
    // Try to get exact date prices for all tickers
    const exactPrices = await db
      .select()
      .from(historicalPrices)
      .where(
        and(
          inArray(historicalPrices.ticker, tickers),
          eq(historicalPrices.date, targetDate)
        )
      );
    
    for (const price of exactPrices) {
      if (price.close) {
        pricesMap.set(price.ticker, parseFloat(price.close));
      }
    }
    
    // For tickers without exact date, find nearest previous date
    const missingTickers = tickers.filter(t => !pricesMap.has(t));
    
    if (missingTickers.length > 0) {
      const nearestPrices = await db
        .select()
        .from(historicalPrices)
        .where(
          and(
            inArray(historicalPrices.ticker, missingTickers),
            lte(historicalPrices.date, targetDate)
          )
        )
        .orderBy(desc(historicalPrices.date));
      
      // Group by ticker and take the most recent
      const tickerLatestPrice = new Map<string, number>();
      for (const price of nearestPrices) {
        if (!tickerLatestPrice.has(price.ticker) && price.close) {
          tickerLatestPrice.set(price.ticker, parseFloat(price.close));
        }
      }
      
      // Merge with existing prices
      Array.from(tickerLatestPrice.entries()).forEach(([ticker, price]) => {
        pricesMap.set(ticker, price);
      });
    }
    
    return pricesMap;
  } catch (error) {
    console.error("[DB] Error batch loading historical prices:", error);
    return new Map();
  }
}

/**
 * In-memory cache for FX rates
 * Reduces API calls significantly
 */
const fxRateCache = new Map<string, { rate: number; timestamp: number }>();
const FX_CACHE_TTL = 3600000; // 1 hour in milliseconds

export function getCachedFxRate(currency: string, date: string): number | null {
  const key = `${currency}_${date}`;
  const cached = fxRateCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < FX_CACHE_TTL) {
    return cached.rate;
  }
  
  return null;
}

export function setCachedFxRate(currency: string, date: string, rate: number) {
  const key = `${currency}_${date}`;
  fxRateCache.set(key, { rate, timestamp: Date.now() });
}

/**
 * Clear FX rate cache (useful for testing or manual refresh)
 */
export function clearFxRateCache() {
  fxRateCache.clear();
}
