/**
 * European Ticker Mapping for EODHD API
 * 
 * EODHD uses different ticker formats for European stocks.
 * This module provides mapping and fallback logic.
 */

interface TickerMapping {
  original: string;
  alternatives: string[];
}

/**
 * Known problematic European tickers and their EODHD alternatives
 */
const EUROPEAN_TICKER_MAP: Record<string, string[]> = {
  // Italian stocks (Milan Stock Exchange)
  'MONC.MI': ['MONC.MIL', 'MONC.MI', 'MONC'],
  
  // London Stock Exchange
  'VWRL.L': ['VWRL.LSE', 'VWRL.L', 'VWRL'],
  
  // German stocks (XETRA)
  'EXSA.DE': ['EXSA.XETRA', 'EXSA.F', 'EXSA.DE', 'EXSA'],
};

/**
 * Get all possible ticker variants for EODHD API
 * @param ticker Original ticker (e.g., "MONC.MI")
 * @returns Array of ticker variants to try, ordered by likelihood
 */
export function getEODHDTickerVariants(ticker: string): string[] {
  // Check if we have a known mapping
  if (EUROPEAN_TICKER_MAP[ticker]) {
    return EUROPEAN_TICKER_MAP[ticker];
  }
  
  // Generic fallback logic for European exchanges
  const variants: string[] = [ticker]; // Always try original first
  
  // Extract base ticker and exchange
  const parts = ticker.split('.');
  if (parts.length === 2) {
    const [base, exchange] = parts;
    
    // Add common exchange variants
    switch (exchange) {
      case 'MI': // Milan
        variants.push(`${base}.MIL`, `${base}.MI`);
        break;
      case 'L': // London
        variants.push(`${base}.LSE`, `${base}.L`);
        break;
      case 'DE': // Germany
        variants.push(`${base}.XETRA`, `${base}.F`, `${base}.DE`);
        break;
      case 'PA': // Paris
        variants.push(`${base}.PAR`, `${base}.PA`);
        break;
      case 'AS': // Amsterdam
        variants.push(`${base}.AMS`, `${base}.AS`);
        break;
    }
    
    // Add base ticker without exchange as last resort
    variants.push(base);
  }
  
  return variants;
}

/**
 * Test ticker variants and return the first one that works
 * @param ticker Original ticker
 * @param testFn Function to test if a ticker works (e.g., API call)
 * @returns Working ticker or null if none work
 */
export async function findWorkingTickerVariant(
  ticker: string,
  testFn: (variant: string) => Promise<boolean>
): Promise<string | null> {
  const variants = getEODHDTickerVariants(ticker);
  
  console.log(`[Ticker Mapping] Testing ${variants.length} variants for ${ticker}:`, variants);
  
  for (const variant of variants) {
    try {
      const works = await testFn(variant);
      if (works) {
        console.log(`[Ticker Mapping] ✅ Found working variant: ${variant}`);
        return variant;
      }
    } catch (error) {
      console.log(`[Ticker Mapping] ❌ Variant ${variant} failed:`, error);
    }
  }
  
  console.log(`[Ticker Mapping] ⚠️ No working variant found for ${ticker}`);
  return null;
}

/**
 * Add a new ticker mapping (for runtime discovery)
 */
export function addTickerMapping(original: string, working: string): void {
  if (!EUROPEAN_TICKER_MAP[original]) {
    EUROPEAN_TICKER_MAP[original] = [working, original];
    console.log(`[Ticker Mapping] Added new mapping: ${original} → ${working}`);
  }
}
