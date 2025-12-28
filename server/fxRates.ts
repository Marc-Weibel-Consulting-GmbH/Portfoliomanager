/**
 * FX Rate Service
 * Fetches and caches foreign exchange rates for currency conversion
 */

interface FXRate {
  from: string;
  to: string;
  rate: number;
  timestamp: number;
}

// In-memory cache for FX rates (5-minute TTL)
const fxCache = new Map<string, FXRate>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get FX rate from EODHD API
 * Example: USD/CHF, EUR/CHF
 */
async function fetchFXRateFromEODHD(from: string, to: string): Promise<number> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    console.warn('[FX Rates] EODHD_API_KEY not configured, using fallback rates');
    return getFallbackRate(from, to);
  }

  try {
    // EODHD uses format: USDCHF.FOREX
    const symbol = `${from}${to}`;
    const url = `https://eodhd.com/api/real-time/${symbol}.FOREX?api_token=${apiKey}&fmt=json`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`EODHD API error: ${response.status}`);
    }

    const data = await response.json();
    const rate = parseFloat(data.close || data.price);
    
    if (isNaN(rate) || rate <= 0) {
      throw new Error('Invalid rate received from EODHD');
    }

    return rate;
  } catch (error) {
    console.error(`[FX Rates] Failed to fetch ${from}/${to} from EODHD:`, error);
    return getFallbackRate(from, to);
  }
}

/**
 * Get FX rate from Finnhub API (fallback)
 */
async function fetchFXRateFromFinnhub(from: string, to: string): Promise<number> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    console.warn('[FX Rates] FINNHUB_API_KEY not configured, using fallback rates');
    return getFallbackRate(from, to);
  }

  try {
    // Finnhub uses format: OANDA:USD_CHF
    const symbol = `OANDA:${from}_${to}`;
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`);
    }

    const data = await response.json();
    const rate = parseFloat(data.c); // Current price
    
    if (isNaN(rate) || rate <= 0) {
      throw new Error('Invalid rate received from Finnhub');
    }

    return rate;
  } catch (error) {
    console.error(`[FX Rates] Failed to fetch ${from}/${to} from Finnhub:`, error);
    return getFallbackRate(from, to);
  }
}

/**
 * Fallback rates (approximate, updated manually)
 * Used when API calls fail
 */
function getFallbackRate(from: string, to: string): number {
  const rates: Record<string, number> = {
    'USD/CHF': 0.888,  // 1 USD = 0.888 CHF
    'EUR/CHF': 0.938,  // 1 EUR = 0.938 CHF
    'GBP/CHF': 1.095,  // 1 GBP = 1.095 CHF
    'CHF/CHF': 1.0,    // 1 CHF = 1 CHF
  };

  const key = `${from}/${to}`;
  const rate = rates[key];
  
  if (rate) {
    console.log(`[FX Rates] Using fallback rate for ${key}: ${rate}`);
    return rate;
  }

  // If no fallback available, assume 1:1
  console.warn(`[FX Rates] No fallback rate for ${key}, using 1:1`);
  return 1.0;
}

/**
 * Get FX rate with caching
 * @param from Source currency (e.g., 'USD')
 * @param to Target currency (e.g., 'CHF')
 * @returns Exchange rate
 */
export async function getFXRate(from: string, to: string): Promise<number> {
  // Same currency, return 1
  if (from === to) {
    return 1.0;
  }

  // Check cache
  const cacheKey = `${from}/${to}`;
  const cached = fxCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[FX Rates] Cache hit for ${cacheKey}: ${cached.rate}`);
    return cached.rate;
  }

  // Fetch fresh rate (try EODHD first, then Finnhub)
  let rate: number;
  try {
    rate = await fetchFXRateFromEODHD(from, to);
  } catch (error) {
    console.log('[FX Rates] EODHD failed, trying Finnhub...');
    rate = await fetchFXRateFromFinnhub(from, to);
  }

  // Cache the result
  fxCache.set(cacheKey, {
    from,
    to,
    rate,
    timestamp: Date.now(),
  });

  console.log(`[FX Rates] Fetched ${cacheKey}: ${rate}`);
  return rate;
}

/**
 * Convert amount from one currency to another
 * @param amount Amount in source currency
 * @param from Source currency
 * @param to Target currency
 * @returns Amount in target currency
 */
export async function convertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<number> {
  const rate = await getFXRate(from, to);
  return amount * rate;
}

/**
 * Get multiple FX rates at once
 * @param pairs Array of currency pairs, e.g., [['USD', 'CHF'], ['EUR', 'CHF']]
 * @returns Map of rates
 */
export async function getMultipleFXRates(
  pairs: [string, string][]
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  
  await Promise.all(
    pairs.map(async ([from, to]) => {
      const rate = await getFXRate(from, to);
      results.set(`${from}/${to}`, rate);
    })
  );

  return results;
}
