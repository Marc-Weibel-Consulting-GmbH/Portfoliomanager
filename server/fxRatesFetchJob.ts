/**
 * FX Rates Fetch Job
 * 
 * Fetches daily exchange rates (USD/CHF, EUR/CHF, GBP/CHF) and stores them in the database.
 * Runs daily at 6:30 AM to ensure rates are available for performance calculations.
 */

import cron from 'node-cron';
import { getDb } from './db';
import { exchangeRates, stocks } from '../drizzle/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';

const CURRENCY_PAIRS = [
  'USDCHF', 'EURCHF', 'GBPCHF',
  // Additional currencies used in the stocks universe
  'CADCHF', 'JPYCHF', 'SEKCHF', 'NOKCHF', 'DKKCHF', 'AUDCHF', 'PLNCHF', 'SGDCHF', 'ILSCHF',
];

/**
 * Fetch current FX rate from Yahoo Finance
 * Returns null if the pair is unavailable or an error occurs.
 */
async function fetchFxRateYahoo(currencyPair: string): Promise<number | null> {
  try {
    const symbol = `${currencyPair}=X`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const data = await response.json();
    const quote = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return quote ? parseFloat(quote) : null;
  } catch {
    return null;
  }
}

/**
 * Fetch current FX rate from EODHD as fallback.
 * EODHD forex format: USDCHF.FOREX
 */
async function fetchFxRateEodhd(currencyPair: string): Promise<number | null> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) return null;
  try {
    // EODHD uses e.g. USDCHF.FOREX for the pair
    const url = `https://eodhd.com/api/real-time/${currencyPair}.FOREX?api_token=${apiKey}&fmt=json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const data = await response.json();
    // EODHD returns { close: "0.8078", ... } for real-time
    const close = data?.close ?? data?.previousClose;
    return close ? parseFloat(close) : null;
  } catch {
    return null;
  }
}

/**
 * Fetch current FX rate: tries Yahoo Finance first, falls back to EODHD.
 */
async function fetchFxRate(currencyPair: string): Promise<{ rate: number; source: string } | null> {
  // Primary: Yahoo Finance
  const yahooRate = await fetchFxRateYahoo(currencyPair);
  if (yahooRate !== null) {
    return { rate: yahooRate, source: 'yahoo' };
  }
  console.warn(`[FxRates] Yahoo Finance failed for ${currencyPair}, trying EODHD fallback...`);
  
  // Fallback: EODHD
  const eodhdRate = await fetchFxRateEodhd(currencyPair);
  if (eodhdRate !== null) {
    console.log(`[FxRates] EODHD fallback succeeded for ${currencyPair}: ${eodhdRate}`);
    return { rate: eodhdRate, source: 'eodhd' };
  }
  
  console.error(`[FxRates] Both Yahoo Finance and EODHD failed for ${currencyPair}`);
  return null;
}

/**
 * Fetch and store FX rates for today
 */
async function updateFxRates() {
  console.log('[FxRates] Starting daily FX rates update...');
  
  const db = await getDb();
  if (!db) {
    console.error('[FxRates] Database not available');
    return;
  }
  
  const today = new Date().toISOString().split('T')[0];
  
  for (const pair of CURRENCY_PAIRS) {
    try {
      // Check if rate already exists for today
      const existing = await db
        .select()
        .from(exchangeRates)
        .where(
          and(
            eq(exchangeRates.date, today),
            eq(exchangeRates.currencyPair, pair)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        console.log(`[FxRates] Rate for ${pair} on ${today} already exists, skipping`);
        continue;
      }
      
      // Fetch current rate (Yahoo Finance with EODHD fallback)
      const result = await fetchFxRate(pair);
      if (!result) {
        console.error(`[FxRates] Failed to fetch rate for ${pair} from all sources`);
        continue;
      }
      
      // Store in database
      await db.insert(exchangeRates).values({
        date: today,
        currencyPair: pair,
        rate: result.rate.toString(),
      });
      
      console.log(`[FxRates] Stored ${pair} rate: ${result.rate} (source: ${result.source}) for ${today}`);
    } catch (error) {
      console.error(`[FxRates] Error processing ${pair}:`, error);
    }
  }
  
  console.log('[FxRates] Daily FX rates update completed');
  
  // Also update exchangeRateToChf in stocks table
  await syncStockFxRates();
}

/**
 * Sync exchangeRateToChf in stocks table from latest exchangeRates
 */
export async function syncStockFxRates() {
  const db = await getDb();
  if (!db) return;
  
  try {
    // Get latest rates for each currency pair (DESC order → newest first)
    // Use a large enough limit to cover all currency pairs across recent days
    const latestRates = await db
      .select()
      .from(exchangeRates)
      .orderBy(desc(exchangeRates.date))
      .limit(500);
    
    // Build currency → CHF rate map from most recent entries (first occurrence = newest)
    const rateMap: Record<string, number> = { CHF: 1 };
    const seen = new Set<string>();
    for (const r of latestRates) {
      if (!seen.has(r.currencyPair)) {
        seen.add(r.currencyPair);
        const currency = r.currencyPair.replace('CHF', '');
        rateMap[currency] = parseFloat(r.rate);
      }
    }
    // GBp (pence) = GBP / 100
    if (rateMap['GBP']) rateMap['GBp'] = rateMap['GBP'] / 100;
    // ILS fallback
    if (!rateMap['ILS']) rateMap['ILS'] = 0.27;
    
    console.log('[FxRates] Syncing stock FX rates:', JSON.stringify(rateMap));
    
    // Update each currency group
    for (const [currency, rate] of Object.entries(rateMap)) {
      if (currency === 'CHF') continue;
      await db
        .update(stocks)
        .set({ exchangeRateToChf: rate.toString() })
        .where(eq(stocks.currency, currency));
    }
    // Ensure CHF stocks always have rate 1
    await db
      .update(stocks)
      .set({ exchangeRateToChf: '1' })
      .where(eq(stocks.currency, 'CHF'));
    
    console.log('[FxRates] Stock FX rates synced successfully');
  } catch (error) {
    console.error('[FxRates] Error syncing stock FX rates:', error);
  }
}

/**
 * Backfill historical FX rates from a start date
 */
export async function backfillFxRates(startDate: string) {
  console.log(`[FxRates] Backfilling FX rates from ${startDate}...`);
  
  const db = await getDb();
  if (!db) {
    console.error('[FxRates] Database not available');
    return;
  }
  
  const start = new Date(startDate);
  const today = new Date();
  
  // Iterate through each day
  for (let date = new Date(start); date <= today; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    
    for (const pair of CURRENCY_PAIRS) {
      try {
        // Check if rate already exists
        const existing = await db
          .select()
          .from(exchangeRates)
          .where(
            and(
              eq(exchangeRates.date, dateStr),
              eq(exchangeRates.currencyPair, pair)
            )
          )
          .limit(1);
        
        if (existing.length > 0) {
          continue;
        }
        
        // Fetch historical rate from Yahoo Finance
        const symbol = `${pair}=X`;
        const timestamp1 = Math.floor(new Date(dateStr).getTime() / 1000);
        const timestamp2 = timestamp1 + 86400; // +1 day
        
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${timestamp1}&period2=${timestamp2}&interval=1d`;
        
        const response = await fetch(url);
        if (!response.ok) {
          console.error(`[FxRates] Failed to fetch ${pair} for ${dateStr}`);
          continue;
        }
        
        const data = await response.json();
        const quote = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.[0];
        
        if (!quote) {
          console.error(`[FxRates] No quote found for ${pair} on ${dateStr}`);
          continue;
        }
        
        // Store in database
        await db.insert(exchangeRates).values({
          date: dateStr,
          currencyPair: pair,
          rate: parseFloat(quote).toString(),
        });
        
        console.log(`[FxRates] Backfilled ${pair} rate: ${quote} for ${dateStr}`);
        
        // Rate limit: wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[FxRates] Error backfilling ${pair} for ${dateStr}:`, error);
      }
    }
  }
  
  console.log('[FxRates] Backfill completed');
}

/**
 * Initialize the FX rates cron job
 */
export function initFxRatesCron() {
  // Run daily at 6:30 AM
  cron.schedule('30 6 * * *', async () => {
    await updateFxRates();
  });
  
  console.log('[FxRates] Cron job initialized (runs daily at 6:30 AM)');
  
  // Run immediately on startup to ensure we have today's rates
  setTimeout(async () => {
    await updateFxRates();
    // Also sync stock FX rates on startup in case rates were already fetched today
    await syncStockFxRates();
  }, 5000);
}
