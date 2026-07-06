/**
 * Ticker normalization utilities
 * Ensures consistent ticker format between database storage and code usage
 */

/**
 * Normalize ticker for database storage
 * Converts various ticker formats to a canonical format
 * 
 * Examples:
 * - "NESN.SW" -> "NESN.SW" (keep exchange suffix for Swiss stocks)
 * - "AAPL" -> "AAPL.US" (add US exchange for US stocks without suffix)
 * - "AAPL.US" -> "AAPL.US" (keep as is)
 * - "NESN" -> "NESN.SW" (add Swiss exchange for known Swiss stocks)
 * 
 * @param ticker Raw ticker symbol
 * @returns Normalized ticker symbol
 */
/**
 * Firmenspezifische Ticker-Aliasse: der Ticker, den ein Portfolio/Broker verwendet, → der
 * kanonische Ticker in der stocks-Tabelle. Anders als Format-Varianten (.US/.SW) sind das
 * echte Zweitkürzel/Umbenennungen, die getTickerVariants NICHT erzeugt.
 *   - ABB.SW → ABBN.SW  (ABB handelt an der SIX unter ABBN, nicht ABB)
 * Weitere (fusions-/ADR-bedingte) Aliasse hier ergänzen, sobald das Zielsymbol bestätigt ist.
 */
export const CANONICAL_TICKER_ALIASES: Record<string, string> = {
  'ABB.SW': 'ABBN.SW',
};

/** Firmen-Alias auf den kanonischen stocks-Ticker anwenden (case-insensitiv). */
export function resolveCanonicalTicker(ticker: string): string {
  if (!ticker) return ticker;
  return CANONICAL_TICKER_ALIASES[ticker.trim().toUpperCase()] ?? ticker;
}

export function normalizeTickerForDb(ticker: string): string {
  if (!ticker) return ticker;

  const trimmed = ticker.trim().toUpperCase();

  // If already has exchange suffix, keep it
  if (trimmed.includes('.')) {
    return trimmed;
  }
  
  // List of known Swiss stock prefixes (extend as needed)
  const swissStockPrefixes = [
    'NESN', 'NOVN', 'ROG', 'ABBN', 'ZURN', 'UHR', 'SLHN', 'SREN', 'GIVN', 'LONN',
    'CFR', 'SCMN', 'UBSG', 'CSGN', 'BAER', 'SIKA', 'GEBN', 'PGHN', 'HOLN', 'ALC',
    'BUCN', 'KNIN', 'STMN', 'TEMN', 'VAKN', 'ADEN', 'SGSN', 'ATLN', 'BALN', 'CMBN'
  ];
  
  // Check if it's a known Swiss stock
  if (swissStockPrefixes.some(prefix => trimmed.startsWith(prefix))) {
    return `${trimmed}.SW`;
  }
  
  // Default to US exchange for stocks without suffix
  return `${trimmed}.US`;
}

/**
 * Get all possible ticker variants for database lookup
 * Useful when searching for prices with uncertain ticker format
 * 
 * @param ticker Raw ticker symbol
 * @returns Array of possible ticker variants
 */
export function getTickerVariants(ticker: string): string[] {
  if (!ticker) return [];
  
  const trimmed = ticker.trim().toUpperCase();
  const variants = new Set<string>();
  
  // Add original
  variants.add(trimmed);
  
  // Add normalized version
  variants.add(normalizeTickerForDb(trimmed));
  
  // If has exchange suffix, also add version without it
  if (trimmed.includes('.')) {
    const base = trimmed.split('.')[0];
    variants.add(base);
  }
  
  // If no exchange suffix, add common variants
  if (!trimmed.includes('.')) {
    variants.add(`${trimmed}.US`);
    variants.add(`${trimmed}.SW`);
  }
  
  return Array.from(variants);
}

/**
 * Normalize a list of tickers, removing duplicates
 * 
 * @param tickers Array of raw ticker symbols
 * @returns Array of unique normalized ticker symbols
 */
export function normalizeTickerList(tickers: string[]): string[] {
  const normalized = new Set<string>();
  
  for (const ticker of tickers) {
    if (ticker && ticker.trim()) {
      normalized.add(normalizeTickerForDb(ticker));
    }
  }
  
  return Array.from(normalized);
}
