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
    // Build a set of all ticker variants to query (with and without .US suffix)
    const tickerVariants = new Set<string>();
    for (const t of tickers) {
      tickerVariants.add(t);
      if (t.endsWith('.US')) tickerVariants.add(t.slice(0, -3)); // NVDA.US -> NVDA
      else tickerVariants.add(t + '.US'); // NVDA -> NVDA.US
    }
    
    const allStocks = await db
      .select()
      .from(stocks)
      .where(inArray(stocks.ticker, Array.from(tickerVariants)));
    
    // Build map: original ticker -> stock (with fallback to variant)
    const stockByTicker = new Map(allStocks.map(s => [s.ticker, s]));
    const resultMap = new Map<string, typeof allStocks[0]>();
    for (const t of tickers) {
      if (stockByTicker.has(t)) {
        resultMap.set(t, stockByTicker.get(t)!);
      } else if (t.endsWith('.US') && stockByTicker.has(t.slice(0, -3))) {
        resultMap.set(t, stockByTicker.get(t.slice(0, -3))!);
      } else if (!t.endsWith('.US') && stockByTicker.has(t + '.US')) {
        resultMap.set(t, stockByTicker.get(t + '.US')!);
      }
    }
    return resultMap;
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
    // Build a set of all ticker variants to query (with and without .US suffix)
    const tickerVariants = new Set<string>();
    for (const t of tickers) {
      tickerVariants.add(t);
      if (t.endsWith('.US')) tickerVariants.add(t.slice(0, -3));
      else tickerVariants.add(t + '.US');
    }
    const allVariants = Array.from(tickerVariants);
    
    const pricesMap = new Map<string, number>();
    
    // Try to get exact date prices for all tickers (including variants)
    const exactPrices = await db
      .select()
      .from(historicalPrices)
      .where(
        and(
          inArray(historicalPrices.ticker, allVariants),
          eq(historicalPrices.date, targetDate)
        )
      );
    
    // Build variant-to-price map
    const variantPriceMap = new Map<string, number>();
    for (const price of exactPrices) {
      if (price.close) {
        variantPriceMap.set(price.ticker, parseFloat(price.close));
      }
    }
    
    // Map back to original tickers
    for (const t of tickers) {
      if (variantPriceMap.has(t)) {
        pricesMap.set(t, variantPriceMap.get(t)!);
      } else if (t.endsWith('.US') && variantPriceMap.has(t.slice(0, -3))) {
        pricesMap.set(t, variantPriceMap.get(t.slice(0, -3))!);
      } else if (!t.endsWith('.US') && variantPriceMap.has(t + '.US')) {
        pricesMap.set(t, variantPriceMap.get(t + '.US')!);
      }
    }
    
    // For tickers without exact date, find nearest previous date
    const missingTickers = tickers.filter(t => !pricesMap.has(t));
    const missingVariants = new Set<string>();
    for (const t of missingTickers) {
      missingVariants.add(t);
      if (t.endsWith('.US')) missingVariants.add(t.slice(0, -3));
      else missingVariants.add(t + '.US');
    }
    
    if (missingVariants.size > 0) {
      const nearestPrices = await db
        .select()
        .from(historicalPrices)
        .where(
          and(
            inArray(historicalPrices.ticker, Array.from(missingVariants)),
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
      
      // Map back to original tickers
      for (const t of missingTickers) {
        if (tickerLatestPrice.has(t)) {
          pricesMap.set(t, tickerLatestPrice.get(t)!);
        } else if (t.endsWith('.US') && tickerLatestPrice.has(t.slice(0, -3))) {
          pricesMap.set(t, tickerLatestPrice.get(t.slice(0, -3))!);
        } else if (!t.endsWith('.US') && tickerLatestPrice.has(t + '.US')) {
          pricesMap.set(t, tickerLatestPrice.get(t + '.US')!);
        }
      }
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
