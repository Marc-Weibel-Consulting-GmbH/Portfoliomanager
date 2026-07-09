/**
 * ISIN → Yahoo-Ticker resolution (F-15).
 *
 * Wikifolio positions only carry ISINs; the watchlist needs Yahoo tickers so
 * metrics/refresh and /invest links work.
 *
 * Resolution strategy (two-tier):
 *   1. Yahoo Finance search (primary) — returns Yahoo-native tickers
 *   2. EODHD /search fallback — used when Yahoo returns nothing (e.g. Korean GDRs,
 *      delisted ADRs, exotic exchanges). Returns Code.Exchange format.
 *
 * The search function for Yahoo is injected so the logic is unit-testable.
 */

import { ENV } from '../_core/env';

export interface YahooSearchQuote {
  symbol?: string;
  quoteType?: string;
  isYahooFinance?: boolean;
}

export type YahooSearchFn = (query: string) => Promise<{ quotes?: YahooSearchQuote[] }>;

/**
 * EODHD exchange code → Yahoo-compatible suffix mapping.
 * EODHD uses different exchange codes than Yahoo Finance.
 * Only map exchanges where the suffix differs or needs normalisation.
 */
const EODHD_EXCHANGE_TO_SUFFIX: Record<string, string> = {
  // US
  'US': '',           // no suffix for US stocks (AAPL not AAPL.US in Yahoo)
  'NYSE': '',
  'NASDAQ': '',
  'AMEX': '',
  'OTC': '',
  // Europe
  'SW': 'SW',         // Swiss Exchange
  'XETRA': 'DE',      // XETRA → .DE in Yahoo
  'DE': 'DE',
  'LSE': 'L',         // London → .L in Yahoo
  'PA': 'PA',         // Euronext Paris
  'AMS': 'AS',        // Amsterdam → .AS in Yahoo
  'MI': 'MI',         // Milan
  'MC': 'MC',         // Madrid
  'HE': 'HE',         // Helsinki
  'ST': 'ST',         // Stockholm
  'OL': 'OL',         // Oslo
  'VI': 'VI',         // Vienna
  'LS': 'LS',         // Lisbon
  'BR': 'BR',         // Brussels
  'WAR': 'WA',        // Warsaw → .WA in Yahoo
  // Asia-Pacific
  'KO': 'KS',         // Korea Stock Exchange → .KS in Yahoo
  'KQ': 'KQ',         // KOSDAQ
  'TO': 'TO',         // Toronto
  'V': 'V',           // TSX Venture
  'AU': 'AX',         // Australia → .AX in Yahoo
  'HK': 'HK',         // Hong Kong
  'SHG': 'SS',        // Shanghai → .SS in Yahoo
  'SHE': 'SZ',        // Shenzhen → .SZ in Yahoo
  'TSE': 'T',         // Tokyo → .T in Yahoo
  'NSE': 'NS',        // India NSE → .NS in Yahoo
  'BSE': 'BO',        // India BSE → .BO in Yahoo
  'JSE': 'JO',        // Johannesburg → .JO in Yahoo
  'SGX': 'SI',        // Singapore → .SI in Yahoo
};

/**
 * Convert an EODHD search result (Code + Exchange) to a Yahoo-compatible ticker.
 * E.g. Code="000660", Exchange="KO" → "000660.KS"
 */
export function eodhdResultToTicker(code: string, exchange: string): string {
  if (!code) return '';
  const suffix = EODHD_EXCHANGE_TO_SUFFIX[exchange];
  if (suffix === undefined) {
    // Unknown exchange: use EODHD format directly (Code.Exchange)
    return `${code}.${exchange}`;
  }
  if (suffix === '') {
    // US stocks: no suffix
    return code;
  }
  return `${code}.${suffix}`;
}

/**
 * Heuristik: sieht der String wie eine ISIN aus? (2 Buchstaben Länderkürzel +
 * 9 alphanumerische Zeichen + 1 Prüfziffer). Verwendet, um Alt-Watchlist-Einträge,
 * die eine ISIN statt eines Yahoo-Tickers tragen, gegen sinnlose Quote-Abrufe zu
 * schützen (L-20: stoppt den [watchlistAlertsCron]-Log-Spam).
 */
export function isLikelyIsin(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(value.trim().toUpperCase());
}

/**
 * Pick the first equity/ETF quote symbol from Yahoo search quotes.
 * Exported for unit tests.
 */
export function pickTickerFromQuotes(quotes: YahooSearchQuote[] | undefined): string | null {
  if (!quotes || quotes.length === 0) return null;
  const match = quotes.find(q => !!q.symbol && (q.quoteType === "EQUITY" || q.quoteType === "ETF"));
  return match?.symbol ?? null;
}

/**
 * Resolve an ISIN via EODHD /search endpoint.
 * Returns the best ticker in Yahoo-compatible format, or null if not found.
 *
 * EODHD search returns an array like:
 *   [{ Code: "000660", Name: "SK Hynix", Exchange: "KO", ... }]
 */
export async function resolveIsinViaEodhd(isin: string): Promise<string | null> {
  const apiKey = ENV.eodhdApiKey;
  if (!apiKey) return null;
  try {
    const url = `https://eodhd.com/api/search/${encodeURIComponent(isin)}?api_token=${apiKey}&limit=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const results: Array<{ Code?: string; Name?: string; Exchange?: string; Type?: string }> = await res.json();
    if (!Array.isArray(results) || results.length === 0) return null;

    // Prefer equities/ETFs, then take the first result
    const preferred = results.find(r => r.Type === 'Common Stock' || r.Type === 'ETF') ?? results[0];
    if (!preferred?.Code || !preferred?.Exchange) return null;

    const ticker = eodhdResultToTicker(preferred.Code, preferred.Exchange);
    console.log(`[isinResolver] EODHD resolved ${isin} → ${ticker} (${preferred.Name}, ${preferred.Exchange})`);
    return ticker || null;
  } catch (err) {
    console.warn(`[isinResolver] EODHD search failed for ISIN ${isin}:`, err);
    return null;
  }
}

/**
 * Resolve an ISIN to a ticker.
 * Strategy: Yahoo Finance first, EODHD as fallback.
 * Returns null when nothing usable is found.
 */
export async function resolveIsinToTicker(search: YahooSearchFn, isin: string): Promise<string | null> {
  if (!isin) return null;

  // 1. Try Yahoo Finance
  try {
    const result = await search(isin);
    const yahooTicker = pickTickerFromQuotes(result?.quotes);
    if (yahooTicker) return yahooTicker;
  } catch (err) {
    console.warn(`[isinResolver] Yahoo search failed for ISIN ${isin}:`, err);
  }

  // 2. Fallback: EODHD search
  console.log(`[isinResolver] Yahoo returned nothing for ${isin}, trying EODHD...`);
  return resolveIsinViaEodhd(isin);
}
