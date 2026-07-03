/**
 * ISIN → Yahoo-Ticker resolution (F-15).
 *
 * Wikifolio positions only carry ISINs; the watchlist needs Yahoo tickers so
 * metrics/refresh and /invest links work. Resolution goes through Yahoo
 * Finance search — the search function is injected so the logic is unit-testable.
 */

export interface YahooSearchQuote {
  symbol?: string;
  quoteType?: string;
  isYahooFinance?: boolean;
}

export type YahooSearchFn = (query: string) => Promise<{ quotes?: YahooSearchQuote[] }>;

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
 * Resolve an ISIN to a Yahoo ticker via Yahoo search. Returns null when
 * nothing usable is found or the search fails.
 */
export async function resolveIsinToTicker(search: YahooSearchFn, isin: string): Promise<string | null> {
  if (!isin) return null;
  try {
    const result = await search(isin);
    return pickTickerFromQuotes(result?.quotes);
  } catch (err) {
    console.warn(`[isinResolver] Yahoo search failed for ISIN ${isin}:`, err);
    return null;
  }
}
