/**
 * FX Helper Functions
 * 
 * Utility functions for currency conversion using historical exchange rates.
 */

import { getDb } from './db';
import { exchangeRates, stocks } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';

// In-memory cache for resolved FX rates. Historical rates are immutable, so
// caching (date, pair) -> rate avoids thousands of repeated DB lookups inside
// the day-by-day valuation loops of the risk/performance engines (which were
// the dominant cause of 15-20s response times).
const fxRateCache = new Map<string, number>();

// One-time bulk load of the entire (small) exchangeRates table into the cache.
// The first FX lookup after a process start triggers this single query, after
// which every getFxRate call is served from memory — eliminating the thousands
// of per-date DB roundtrips that made the risk/performance engines slow even on
// a cold first request.
let fxPrewarmed = false;

async function ensureFxRatesPrewarmed(): Promise<void> {
  if (fxPrewarmed) return;
  fxPrewarmed = true; // set first so concurrent calls don't all query
  try {
    const db = await getDb();
    if (!db) { fxPrewarmed = false; return; }
    const all = await db.select().from(exchangeRates);
    for (const r of all) {
      fxRateCache.set(`${r.date}:${r.currencyPair}`, parseFloat(r.rate as any));
    }
    console.log(`[FxHelper] Prewarmed ${all.length} FX rates into memory cache`);
  } catch (error) {
    console.error('[FxHelper] FX prewarm failed:', error);
  }
}

/**
 * Get exchange rate for a specific date and currency pair
 * @param date - Date in YYYY-MM-DD format
 * @param currencyPair - Currency pair (e.g., 'USDCHF', 'EURCHF')
 * @returns Exchange rate or 1.0 if not found (CHF is base currency)
 */
export async function getFxRate(date: string, currencyPair: string): Promise<number> {
  if (currencyPair === 'CHFCHF') {
    return 1.0;
  }

  const cacheKey = `${date}:${currencyPair}`;
  let cachedRate = fxRateCache.get(cacheKey);
  if (cachedRate !== undefined) {
    return cachedRate;
  }

  // First miss after process start: bulk-load all rates, then re-check.
  await ensureFxRatesPrewarmed();
  cachedRate = fxRateCache.get(cacheKey);
  if (cachedRate !== undefined) {
    return cachedRate;
  }

  const db = await getDb();
  if (!db) {
    console.error('[FxHelper] Database not available');
    return 1.0;
  }

  try {
    const [rate] = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.date, date),
          eq(exchangeRates.currencyPair, currencyPair)
        )
      )
      .limit(1);

    if (rate) {
      const parsed = parseFloat(rate.rate);
      fxRateCache.set(cacheKey, parsed);
      return parsed;
    }
    
    // If exact date not found, try to find nearest previous date
    const { desc, lte } = await import('drizzle-orm');
    const [nearestRate] = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.currencyPair, currencyPair),
          lte(exchangeRates.date, date)
        )
      )
      .orderBy(desc(exchangeRates.date))
      .limit(1);
    
    if (nearestRate) {
      const parsed = parseFloat(nearestRate.rate);
      fxRateCache.set(cacheKey, parsed);
      return parsed;
    }
    
    console.warn(`[FxHelper] No FX rate found for ${currencyPair} on ${date}`);
    return 1.0;
  } catch (error) {
    console.error(`[FxHelper] Error fetching FX rate:`, error);
    return 1.0;
  }
}

/**
 * Get currency for a stock ticker
 * @param ticker - Stock ticker symbol
 * @returns Currency code (USD, EUR, CHF, GBP) or 'CHF' as default
 */
export async function getStockCurrency(ticker: string): Promise<string> {
  const db = await getDb();
  if (!db) {
    console.error('[FxHelper] Database not available');
    return 'CHF';
  }
  
  try {
    const [stock] = await db
      .select()
      .from(stocks)
      .where(eq(stocks.ticker, ticker))
      .limit(1);
    
    if (stock && stock.currency) {
      return stock.currency;
    }
    
    // Fallback: guess from ticker suffix
    if (ticker.endsWith('.SW')) {
      return 'CHF';
    } else if (ticker.endsWith('.MI') || ticker.endsWith('.PA') || ticker.endsWith('.DE')) {
      return 'EUR';
    } else if (ticker.endsWith('.L')) {
      return 'GBP';
    }
    
    // Default to USD for US tickers
    return 'USD';
  } catch (error) {
    console.error(`[FxHelper] Error fetching currency for ${ticker}:`, error);
    return 'CHF';
  }
}

/**
 * Convert amount from one currency to CHF
 * @param amount - Amount in original currency
 * @param currency - Original currency code
 * @param date - Date for exchange rate lookup
 * @returns Amount in CHF
 */
export async function convertToCHF(amount: number, currency: string, date: string): Promise<number> {
  if (currency === 'CHF') {
    return amount;
  }
  
  const currencyPair = `${currency}CHF`;
  const fxRate = await getFxRate(date, currencyPair);
  
  return amount * fxRate;
}

/**
 * Synchronous version of getFxRate — reads only from the in-memory cache.
 * MUST call ensureFxRatesPrewarmed() (via any async getFxRate call) before using this.
 * Falls back to 1.0 if the cache is not yet populated or the rate is missing.
 */
export function getFxRateSync(date: string, currencyPair: string): number {
  if (currencyPair === 'CHFCHF') return 1.0;
  const key = `${date}:${currencyPair}`;
  const cached = fxRateCache.get(key);
  if (cached !== undefined) return cached;
  // Weekend/holiday fallback: look back up to 5 days
  const d = new Date(date);
  for (let i = 1; i <= 5; i++) {
    d.setDate(d.getDate() - 1);
    const fallbackKey = `${d.toISOString().split('T')[0]}:${currencyPair}`;
    const fallback = fxRateCache.get(fallbackKey);
    if (fallback !== undefined) return fallback;
  }
  return 1.0;
}

/**
 * Synchronous CHF conversion using the in-memory cache.
 * Requires the cache to be prewarmed first (call any async getFxRate to trigger).
 */
export function convertToCHFSync(amount: number, currency: string, date: string): number {
  if (currency === 'CHF') return amount;
  const rate = getFxRateSync(date, `${currency}CHF`);
  return amount * rate;
}

/**
 * Get current FX rate (today's rate)
 * @param currencyPair - Currency pair (e.g., 'USDCHF')
 * @returns Current exchange rate
 */
export async function getCurrentFxRate(currencyPair: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  return getFxRate(today, currencyPair);
}


/**
 * Get historical price for a stock on a specific date
 * @param ticker - Stock ticker symbol
 * @param date - Date in YYYY-MM-DD format
 * @returns Historical close price or null if not found
 */
export async function getHistoricalPrice(ticker: string, date: string): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    console.error('[FxHelper] Database not available');
    return null;
  }
  
  try {
    const { historicalPrices } = await import('../drizzle/schema');
    const { desc, lte } = await import('drizzle-orm');
    
    // First try exact date
    const [exactPrice] = await db
      .select()
      .from(historicalPrices)
      .where(
        and(
          eq(historicalPrices.ticker, ticker),
          eq(historicalPrices.date, date)
        )
      )
      .limit(1);
    
    if (exactPrice && exactPrice.close) {
      return parseFloat(exactPrice.close);
    }
    
    // If exact date not found, try to find nearest previous date (for weekends/holidays)
    const [nearestPrice] = await db
      .select()
      .from(historicalPrices)
      .where(
        and(
          eq(historicalPrices.ticker, ticker),
          lte(historicalPrices.date, date)
        )
      )
      .orderBy(desc(historicalPrices.date))
      .limit(1);
    
    if (nearestPrice && nearestPrice.close) {
      console.warn(`[FxHelper] Using nearest price for ${ticker} on ${date}: ${nearestPrice.close} from ${nearestPrice.date}`);
      return parseFloat(nearestPrice.close);
    }
    
    console.warn(`[FxHelper] No historical price found for ${ticker} on ${date}`);
    return null;
  } catch (error) {
    console.error(`[FxHelper] Error fetching historical price for ${ticker}:`, error);
    return null;
  }
}
