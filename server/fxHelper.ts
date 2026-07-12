/**
 * FX Helper Functions
 *
 * Utility functions for currency conversion using historical exchange rates.
 *
 * ── Missing-rate design (R-10, OPTIMIZATION_PLAN.md) ────────────────────────
 * Vorher lieferten getFxRate/getFxRateSync bei fehlendem Kurs stillschweigend
 * 1.0 — Fremdwährungsbeträge wurden 1:1 als CHF bewertet (~12 % Fehler bei
 * USD), ohne jede Warnung. Neues Design:
 *
 * 1. Kern-API `tryGetFxRate` / `tryGetFxRateSync` / `tryConvertToCHF(Sync)`:
 *    liefert `null`, wenn innerhalb von FX_LOOKBACK_DAYS (30 Tagen) rückwärts
 *    kein Kurs existiert. CHF→CHF bleibt 1.0. Neue Aufrufer (Importe,
 *    Persistenz, Datenqualitäts-Flags) nutzen diese Varianten und behandeln
 *    `null` explizit (Zeile ablehnen bzw. fxMissing-Flag setzen, → R-13/U-13).
 *
 * 2. Legacy-API `getFxRate` / `getFxRateSync` / `convertToCHF(Sync)` behält
 *    die number-Signatur (Dutzende Bewertungs-Callsites): bei einem Kurs
 *    innerhalb des 30-Tage-Lookbacks kommt der letzte bekannte (ggf. leicht
 *    veraltete) Kurs zurück; existiert NICHTS, wird einmal pro (Datum, Paar)
 *    gewarnt und 0 geliefert. Damit fällt eine Position in Bewertungspfaden
 *    auf Wert 0 (aus Summen ausgeschlossen, wie bei fehlendem Kurs — U-13)
 *    statt fälschlich 1:1 als CHF bewertet zu werden. Persistenzpfade, die
 *    fxRate=0 schreiben würden, werden vom täglichen transactionFxUpdateJob
 *    (fxRate '0'-Scan) repariert bzw. validieren selbst auf > 0 (db.ts
 *    createPortfolioTransaction).
 */

import { getDb } from './db';
import { exchangeRates, stocks } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';

/** Maximaler Rückwärts-Lookback für fehlende Kurstage (Wochenenden/Feiertage/Lücken). */
const FX_LOOKBACK_DAYS = 30;

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
 * In-Memory-Rückwärtssuche: exaktes Datum, dann bis zu FX_LOOKBACK_DAYS Tage
 * zurück (Wochenenden/Feiertage/Lücken). `null`, wenn nichts im Fenster liegt.
 */
function lookupCachedRateWithLookback(date: string, currencyPair: string): number | null {
  const exact = fxRateCache.get(`${date}:${currencyPair}`);
  if (exact !== undefined) return exact;
  const d = new Date(date);
  for (let i = 1; i <= FX_LOOKBACK_DAYS; i++) {
    d.setDate(d.getDate() - 1);
    const fallback = fxRateCache.get(`${d.toISOString().split('T')[0]}:${currencyPair}`);
    if (fallback !== undefined) return fallback;
  }
  return null;
}

// Einmal-pro-(Datum, Paar)-Warnung, damit Bewertungs-Loops das Log nicht fluten.
const warnedMissingFx = new Set<string>();
function warnMissingFx(date: string, currencyPair: string): void {
  const key = `${date}:${currencyPair}`;
  if (warnedMissingFx.has(key)) return;
  warnedMissingFx.add(key);
  console.warn(
    `[FxHelper] No FX rate for ${currencyPair} within ${FX_LOOKBACK_DAYS} days of ${date} — ` +
    `returning 0 (position wird mit 0 bewertet statt 1:1 als CHF, R-10)`
  );
}

/**
 * Get exchange rate for a specific date and currency pair, or `null` when no
 * rate exists within FX_LOOKBACK_DAYS looking back (R-10: no silent 1.0).
 * @param date - Date in YYYY-MM-DD format
 * @param currencyPair - Currency pair (e.g., 'USDCHF', 'EURCHF')
 */
export async function tryGetFxRate(date: string, currencyPair: string): Promise<number | null> {
  if (currencyPair === 'CHFCHF') {
    return 1.0;
  }

  // GBp (British pence) = GBP / 100. EODHD reports .L stocks in GBp.
  // We don't store a GBpCHF rate; derive it from GBPCHF.
  if (currencyPair === 'GBpCHF') {
    const gbpRate = await tryGetFxRate(date, 'GBPCHF');
    return gbpRate === null ? null : gbpRate / 100;
  }

  const cacheKey = `${date}:${currencyPair}`;
  const cachedRate = fxRateCache.get(cacheKey);
  if (cachedRate !== undefined) {
    return cachedRate;
  }

  // First miss after process start: bulk-load all rates, then re-check
  // (inkl. Rückwärtssuche im geprewarmten Cache).
  await ensureFxRatesPrewarmed();
  const cachedLookback = lookupCachedRateWithLookback(date, currencyPair);
  if (cachedLookback !== null) {
    return cachedLookback;
  }

  const db = await getDb();
  if (!db) {
    console.error('[FxHelper] Database not available');
    return null;
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

    // If exact date not found, try nearest previous date — but only within
    // the lookback window (older rates are treated as missing, R-10).
    const { desc, lte, gte } = await import('drizzle-orm');
    const minDate = new Date(date);
    minDate.setDate(minDate.getDate() - FX_LOOKBACK_DAYS);
    const minDateStr = minDate.toISOString().split('T')[0];
    const [nearestRate] = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.currencyPair, currencyPair),
          lte(exchangeRates.date, date),
          gte(exchangeRates.date, minDateStr)
        )
      )
      .orderBy(desc(exchangeRates.date))
      .limit(1);

    if (nearestRate) {
      const parsed = parseFloat(nearestRate.rate);
      fxRateCache.set(cacheKey, parsed);
      return parsed;
    }

    return null;
  } catch (error) {
    console.error(`[FxHelper] Error fetching FX rate:`, error);
    return null;
  }
}

/**
 * Legacy number-returning variant (viele Bewertungs-Callsites).
 * @returns Exchange rate (ggf. letzter bekannter Kurs ≤ 30 Tage zurück) oder
 *          0, wenn kein Kurs existiert — nie mehr stillschweigend 1.0 (R-10).
 */
export async function getFxRate(date: string, currencyPair: string): Promise<number> {
  const rate = await tryGetFxRate(date, currencyPair);
  if (rate === null) {
    warnMissingFx(date, currencyPair);
    return 0;
  }
  return rate;
}

/**
 * Convert amount to CHF, or `null` when no FX rate exists within the lookback
 * window (R-10). CHF amounts pass through unchanged.
 */
export async function tryConvertToCHF(amount: number, currency: string, date: string): Promise<number | null> {
  if (currency === 'CHF') {
    return amount;
  }
  const fxRate = await tryGetFxRate(date, `${currency}CHF`);
  return fxRate === null ? null : amount * fxRate;
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
      return 'GBp'; // LSE stocks are quoted in pence (GBp), not pounds (GBP)
    }
    
    // Default to USD for US tickers
    return 'USD';
  } catch (error) {
    console.error(`[FxHelper] Error fetching currency for ${ticker}:`, error);
    return 'CHF';
  }
}

/**
 * Convert amount from one currency to CHF (legacy number-returning variant).
 * @param amount - Amount in original currency
 * @param currency - Original currency code
 * @param date - Date for exchange rate lookup
 * @returns Amount in CHF — 0, wenn kein Kurs existiert (nie 1:1, R-10)
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
 * Synchronous version of tryGetFxRate — reads only from the in-memory cache.
 * MUST call ensureFxRatesPrewarmed() (via any async getFxRate call) before using this.
 * `null` if the cache is not yet populated or no rate exists within the
 * FX_LOOKBACK_DAYS window (R-10).
 */
export function tryGetFxRateSync(date: string, currencyPair: string): number | null {
  if (currencyPair === 'CHFCHF') return 1.0;
  // GBp (pence) = GBP / 100
  if (currencyPair === 'GBpCHF') {
    const gbpRate = lookupCachedRateWithLookback(date, 'GBPCHF');
    return gbpRate === null ? null : gbpRate / 100;
  }
  return lookupCachedRateWithLookback(date, currencyPair);
}

/**
 * Synchronous legacy variant: letzter bekannter Kurs ≤ 30 Tage zurück, sonst 0
 * (vorher: stiller 1.0-Fallback nach 5 Tagen Lookback, R-10).
 */
export function getFxRateSync(date: string, currencyPair: string): number {
  const rate = tryGetFxRateSync(date, currencyPair);
  if (rate === null) {
    warnMissingFx(date, currencyPair);
    return 0;
  }
  return rate;
}

/**
 * Synchronous CHF conversion, `null` when no rate exists (R-10).
 * Requires the cache to be prewarmed first (call any async getFxRate to trigger).
 */
export function tryConvertToCHFSync(amount: number, currency: string, date: string): number | null {
  if (currency === 'CHF') return amount;
  const rate = tryGetFxRateSync(date, `${currency}CHF`);
  return rate === null ? null : amount * rate;
}

/**
 * Synchronous CHF conversion using the in-memory cache (legacy variant — 0
 * statt 1:1 bei fehlendem Kurs, R-10).
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
 *
 * R-11: liefert adjustedClose ?? close. Beide Konsumenten (portfoliosRouter
 * ytdStartPrice- und Perioden-Start-Baselines) vergleichen den Wert mit dem
 * heutigen Kurs bei fixer Stückzahl — Rendite-Semantik, dafür ist der
 * split-bereinigte Kurs korrekt. Solange keine Splits-Tabelle existiert,
 * wiegt die Konsistenz der Renditeserie schwerer als die Punkt-Bewertung.
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
      return parseFloat(exactPrice.adjustedClose ?? exactPrice.close);
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
      console.warn(`[FxHelper] Using nearest price for ${ticker} on ${date}: ${nearestPrice.adjustedClose ?? nearestPrice.close} from ${nearestPrice.date}`);
      return parseFloat(nearestPrice.adjustedClose ?? nearestPrice.close);
    }
    
    console.warn(`[FxHelper] No historical price found for ${ticker} on ${date}`);
    return null;
  } catch (error) {
    console.error(`[FxHelper] Error fetching historical price for ${ticker}:`, error);
    return null;
  }
}
