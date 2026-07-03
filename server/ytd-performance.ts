/**
 * YTD Performance calculation using daily historical prices
 * Fetches real daily prices from EODHD API with database caching
 */

import { ENV } from './_core/env';
import { getEODHDTickerVariants } from './european-ticker-mapping';
import { drizzle } from 'drizzle-orm/mysql2';
import { historicalPrices } from '../drizzle/schema';
import { and, eq, gte, lte } from 'drizzle-orm';

interface DailyPrice {
  date: string;
  close: number;
}

/**
 * Get database connection
 */
function getDb() {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  return drizzle(process.env.DATABASE_URL);
}

/**
 * Fetch daily prices from database cache
 */
async function fetchCachedPrices(ticker: string, fromDate: string, toDate: string): Promise<DailyPrice[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const cached = await db
      .select()
      .from(historicalPrices)
      .where(
        and(
          eq(historicalPrices.ticker, ticker),
          gte(historicalPrices.date, fromDate),
          lte(historicalPrices.date, toDate)
        )
      )
      .orderBy(historicalPrices.date);

    return cached.map(row => ({
      date: typeof row.date === 'string' ? row.date : (row.date as Date)?.toISOString().split('T')[0] || '',
      close: parseFloat(row.close.toString()),
    })).filter(p => p.date); // Filter out entries with invalid dates
  } catch (error) {
    console.error(`[YTD Cache] Error fetching cached prices for ${ticker}:`, error);
    return [];
  }
}

/**
 * Save daily prices to database cache
 */
async function cachePrices(ticker: string, prices: DailyPrice[], source: string = 'eodhd'): Promise<void> {
  const db = getDb();
  if (!db || prices.length === 0) return;

  try {
    // Insert or update prices
    for (const price of prices) {
      // Skip invalid entries
      if (!price.date || !price.close) {
        console.warn(`[YTD Cache] Skipping invalid price entry for ${ticker}:`, price);
        continue;
      }
      
      await db
        .insert(historicalPrices)
        .values({
          ticker,
          date: price.date, // Keep as string (YYYY-MM-DD format)
          close: price.close.toString(),
          source,
        })
        .onDuplicateKeyUpdate({
          set: {
            close: price.close.toString(),
            source,
            updatedAt: new Date(),
          },
        });
    }
    console.log(`[YTD Cache] Cached ${prices.length} prices for ${ticker}`);
  } catch (error) {
    console.error(`[YTD Cache] Error caching prices for ${ticker}:`, error);
  }
}

/**
 * Fetch daily historical prices from EODHD API
 */
async function fetchDailyPricesFromAPI(ticker: string, fromDate: string, toDate: string): Promise<DailyPrice[]> {
  const { getEodhdApiKey } = await import('./_core/env');
  const apiKey = await getEodhdApiKey();
  if (!apiKey) {
    console.warn('[YTD API] EODHD API key not configured');
    return [];
  }

  // Try ticker variants for European stocks
  const variants = getEODHDTickerVariants(ticker);
  
  for (const variant of variants) {
    try {
      const url = `https://eodhd.com/api/eod/${variant}?from=${fromDate}&to=${toDate}&api_token=${apiKey}&fmt=json`;
      const response = await fetch(url);
      
      if (!response.ok) {
        if (variant === variants[variants.length - 1]) {
          console.warn(`[YTD API] All variants failed for ${ticker}`);
        }
        continue; // Try next variant
      }

      const data = await response.json();
      
      if (!Array.isArray(data) || data.length === 0) {
        continue; // Try next variant
      }

      // Success! Log which variant worked
      if (variant !== ticker) {
        console.log(`[YTD API] Using ticker variant ${variant} for ${ticker}`);
      }

      const prices = data
        .filter((d: any) => d.date && d.close !== undefined && d.close !== null)
        .map((d: any) => ({
          date: d.date,
          close: parseFloat(d.close),
        }));

      // Cache the prices for future use
      await cachePrices(ticker, prices, 'eodhd');

      return prices;
    } catch (error) {
      console.error(`[YTD API] Error fetching prices for ${variant}:`, error);
      continue; // Try next variant
    }
  }

  // All variants failed
  console.warn(`[YTD API] No working ticker variant found for ${ticker}`);
  return [];
}

/**
 * Fetch daily prices with caching strategy:
 * 1. Try to load from database cache
 * 2. If cache is incomplete or old, fetch from API and update cache
 */
async function fetchDailyPrices(ticker: string, fromDate: string, toDate: string): Promise<DailyPrice[]> {
  // Try cache first
  const cached = await fetchCachedPrices(ticker, fromDate, toDate);
  
  // Calculate expected number of days (approximate)
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const daysDiff = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  const expectedDays = Math.floor(daysDiff * 5 / 7); // Approximate trading days (weekdays)
  
  // If cache has most of the data (>90%), use it
  if (cached.length > expectedDays * 0.9) {
    console.log(`[YTD] Using cached prices for ${ticker} (${cached.length} days)`);
    return cached;
  }
  
  // Cache is incomplete, fetch from API
  console.log(`[YTD] Cache incomplete for ${ticker} (${cached.length}/${expectedDays} days), fetching from API`);
  return await fetchDailyPricesFromAPI(ticker, fromDate, toDate);
}

/**
 * Calculate daily portfolio performance using real historical prices
 */
export async function calculateYTDPerformance(stocks: any[]): Promise<{ date: string; performance: number }[]> {
  console.log(`[YTD] Calculating daily performance for ${stocks.length} stocks`);

  // R-09: derive YTD start dynamically (was hardcoded '2025-01-01').
  // The baseline price stays `stocks.ytdStartPrice` (last trading day of the
  // previous year, maintained by cron/ytdUpdater) — consistent with this window.
  const ytdStartDate = `${new Date().getFullYear()}-01-01`;
  const today = new Date().toISOString().split('T')[0];

  console.log(`[YTD] Fetching daily prices from ${ytdStartDate} to ${today}`);

  // Fetch daily prices for all stocks in parallel
  const pricePromises = stocks.map(async (stock) => {
    const prices = await fetchDailyPrices(stock.ticker, ytdStartDate, today);
    return {
      ticker: stock.ticker,
      weight: parseFloat(stock.portfolioWeight || '0'),
      ytdStartPrice: parseFloat(stock.ytdStartPrice || '0'), // YTD baseline from DB
      prices,
    };
  });

  const stockPrices = await Promise.all(pricePromises);

  // Filter out stocks without price data
  const validStocks = stockPrices.filter(s => s.prices.length > 0 && s.weight > 0);
  console.log(`[YTD] ${validStocks.length}/${stocks.length} stocks have valid daily price data`);

  if (validStocks.length === 0) {
    console.warn('[YTD] No stocks with valid price data, using fallback');
    return generateFallbackPerformance();
  }

  // Get union of all trading days
  const allDates = new Set<string>();
  validStocks.forEach(stock => {
    stock.prices.forEach(p => allDates.add(p.date));
  });

  const sortedDates = Array.from(allDates).sort();
  console.log(`[YTD] Processing ${sortedDates.length} trading days`);

  // Build price lookup maps with forward-fill
  const priceMaps = validStocks.map(stock => {
    const map = new Map<string, number>();
    let lastPrice = stock.prices[0]?.close || 0;

    sortedDates.forEach(date => {
      const priceEntry = stock.prices.find(p => p.date === date);
      if (priceEntry) {
        lastPrice = priceEntry.close;
      }
      map.set(date, lastPrice);
    });

    return { ticker: stock.ticker, weight: stock.weight, ytdStartPrice: stock.ytdStartPrice, priceMap: map };
  });

  // Calculate daily portfolio performance
  const dailyPerformance: { date: string; performance: number }[] = [];

  // Use ytdStartPrice from database as baseline (31.12.2024 close price)
  const baselinePrices = priceMaps.map(pm => pm.ytdStartPrice || 0);

  for (const date of sortedDates) {
    let portfolioReturn = 0;
    let totalWeight = 0;

    priceMaps.forEach((pm, idx) => {
      const currentPrice = pm.priceMap.get(date) || 0;
      const baselinePrice = baselinePrices[idx];

      if (baselinePrice > 0 && currentPrice > 0) {
        const stockReturn = ((currentPrice - baselinePrice) / baselinePrice) * 100;
        portfolioReturn += stockReturn * (pm.weight / 100);
        totalWeight += pm.weight;
      }
    });

    // Normalize if total weight < 100% (some stocks missing data)
    if (totalWeight > 0 && totalWeight < 100) {
      portfolioReturn = (portfolioReturn / totalWeight) * 100;
    }

    dailyPerformance.push({
      date,
      performance: portfolioReturn,
    });
  }

  console.log(`[YTD] Generated ${dailyPerformance.length} data points`);
  if (dailyPerformance.length > 0) {
    const minPerf = Math.min(...dailyPerformance.map(d => d.performance));
    const maxPerf = Math.max(...dailyPerformance.map(d => d.performance));
    console.log(`[YTD] Performance range: ${minPerf.toFixed(2)}% → ${maxPerf.toFixed(2)}%`);
  }

  return dailyPerformance;
}

/**
 * Fallback: Generate linear interpolation if API fails
 */
function generateFallbackPerformance(): { date: string; performance: number }[] {
  console.log('[YTD] Using fallback linear interpolation');

  // R-09: dynamic YTD start (was hardcoded '2025-01-01'). The invented linear
  // +13.32 % ramp itself is R-08 and deliberately left in place for now.
  const startDate = new Date(`${new Date().getFullYear()}-01-01`);
  const endDate = new Date();
  const days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  const result: { date: string; performance: number }[] = [];
  const finalPerformance = 13.32; // From database calculation

  for (let i = 0; i <= days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    result.push({
      date: date.toISOString().split('T')[0],
      performance: (finalPerformance * i) / days,
    });
  }

  return result;
}
