/**
 * Multi-API Data Merger
 * Intelligently combines stock data from multiple APIs to ensure completeness
 * Fallback chain: EODHD → Yahoo Finance → Finnhub
 */

import { fetchStockMetrics } from './stockDataApi';
import { fetchEODHDFundamentals } from './eodhdApi';
import { ENV } from './env';
import { fetchLogo, getSwissStockDomain } from '../logoService';

export interface CompleteStockData {
  ticker: string;
  currentPrice: number | null;
  pe: number | null;
  peg: number | null;
  sharpe: number | null;
  dividendYield: number | null;
  beta: number | null;
  volatility: number | null;
  marketCap: number | null;
  currency: string | null;
  companyName: string | null;
  logoUrl: string | null;
  dataSources: {
    currentPrice?: string;
    pe?: string;
    peg?: string;
    sharpe?: string;
    dividendYield?: string;
    logoUrl?: string;
  };
}

/**
 * Normalize ticker format for different APIs
 */
function getTickerVariants(ticker: string): {
  eodhd: string;
  yahoo: string;
  finnhub: string;
} {
  // Remove exchange suffix for base ticker
  const baseTicker = ticker.replace(/\.(SW|US|PA|MI|L|N)$/i, '');
  
  // Detect exchange from suffix
  let exchange = 'US';
  if (ticker.endsWith('.SW') || ticker.endsWith('.N')) {
    exchange = 'CH';
  } else if (ticker.endsWith('.PA')) {
    exchange = 'FR';
  } else if (ticker.endsWith('.L')) {
    exchange = 'GB';
  }
  
  return {
    eodhd: ticker, // EODHD uses full ticker with suffix (e.g., VPBN.SW)
    yahoo: ticker, // Yahoo uses full ticker with suffix
    finnhub: baseTicker, // Finnhub uses base ticker without suffix
  };
}

/**
 * Calculate earnings growth rate from quarterly data
 */
function calculateEarningsGrowth(quarterlyData: Record<string, any>): number | null {
  try {
    const quarters = Object.keys(quarterlyData).sort().reverse(); // Most recent first
    if (quarters.length < 5) return null; // Need at least 5 quarters

    // Get EPS for latest quarter and quarter from 1 year ago
    const latestEPS = quarterlyData[quarters[0]]?.eps;
    const yearAgoEPS = quarterlyData[quarters[4]]?.eps;

    if (!latestEPS || !yearAgoEPS || yearAgoEPS <= 0) return null;

    // Calculate year-over-year growth rate
    const growthRate = ((latestEPS - yearAgoEPS) / Math.abs(yearAgoEPS)) * 100;

    // Sanity check: growth rate should be reasonable (-100% to 1000%)
    if (growthRate < -100 || growthRate > 1000) return null;

    return growthRate;
  } catch (error) {
    console.error('[MultiAPI] Error calculating earnings growth:', error);
    return null;
  }
}

/**
 * Fetch data from EODHD API
 */
async function fetchFromEODHD(ticker: string): Promise<Partial<CompleteStockData>> {
  try {
    const apiKey = ENV.eodhdApiKey;
    if (!apiKey) {
      console.warn('[MultiAPI] EODHD API key not configured');
      return {};
    }

    const fundamentalsUrl = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${apiKey}`;
    const quoteUrl = `https://eodhd.com/api/real-time/${ticker}?api_token=${apiKey}&fmt=json`;

    const [fundamentalsRes, quoteRes] = await Promise.all([
      fetch(fundamentalsUrl),
      fetch(quoteUrl),
    ]);

    if (!fundamentalsRes.ok || !quoteRes.ok) {
      console.warn(`[MultiAPI] EODHD failed for ${ticker}`);
      return {};
    }

    const fundamentals = await fundamentalsRes.json();
    const quote = await quoteRes.json();

    // Try to get PEG from API first
    let peg = fundamentals.Highlights?.PEGRatio || null;
    
    // If PEG is 0 or null, calculate it from P/E and earnings growth
    if (!peg || peg === 0) {
      const pe = fundamentals.Highlights?.PERatio;
      const quarterlyIncome = fundamentals.Financials?.Income_Statement?.quarterly;
      
      if (pe && quarterlyIncome) {
        const growthRate = calculateEarningsGrowth(quarterlyIncome);
        if (growthRate && growthRate > 0) {
          peg = pe / growthRate;
          console.log(`[MultiAPI] Calculated PEG for ${ticker}: ${peg.toFixed(2)} (P/E: ${pe}, Growth: ${growthRate.toFixed(1)}%)`);
        }
      }
    }

    const data: Partial<CompleteStockData> = {
      currentPrice: quote.close || null,
      pe: fundamentals.Highlights?.PERatio || null,
      peg,
      sharpe: fundamentals.Technicals?.SharpeRatio || null,
      dividendYield: fundamentals.Highlights?.DividendYield
        ? fundamentals.Highlights.DividendYield * 100
        : null,
      beta: fundamentals.Technicals?.Beta || null,
      volatility: fundamentals.Technicals?.Volatility || null,
      marketCap: fundamentals.Highlights?.MarketCapitalization || null,
      companyName: fundamentals.General?.Name || null,
    };

    console.log(`[MultiAPI] EODHD data for ${ticker}:`, {
      price: data.currentPrice,
      pe: data.pe,
      peg: data.peg,
      sharpe: data.sharpe,
    });

    return data;
  } catch (error) {
    console.error(`[MultiAPI] EODHD error for ${ticker}:`, error);
    return {};
  }
}

/**
 * Fetch data from Yahoo Finance (via stockDataApi)
 */
async function fetchFromYahoo(ticker: string, region: string = 'US'): Promise<Partial<CompleteStockData>> {
  try {
    const metrics = await fetchStockMetrics(ticker, region);

    const data: Partial<CompleteStockData> = {
      currentPrice: metrics.currentPrice,
      pe: metrics.peRatio,
      peg: metrics.pegRatio,
      sharpe: metrics.sharpeRatio,
      dividendYield: metrics.dividendYield,
      beta: metrics.beta,
      volatility: metrics.volatility,
      currency: metrics.currency,
    };

    console.log(`[MultiAPI] Yahoo data for ${ticker}:`, {
      price: data.currentPrice,
      pe: data.pe,
      peg: data.peg,
      sharpe: data.sharpe,
    });

    return data;
  } catch (error) {
    console.error(`[MultiAPI] Yahoo error for ${ticker}:`, error);
    return {};
  }
}

/**
 * Fetch data from Finnhub API
 */
async function fetchFromFinnhub(ticker: string): Promise<Partial<CompleteStockData>> {
  try {
    const { getFinnhubApiKey } = await import("./env");
    const apiKey = await getFinnhubApiKey();
    if (!apiKey) {
      console.warn('[MultiAPI] Finnhub API key not configured');
      return {};
    }

    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apiKey}`;
    const metricsUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${apiKey}`;

    const [quoteRes, metricsRes] = await Promise.all([
      fetch(quoteUrl),
      fetch(metricsUrl),
    ]);

    if (!quoteRes.ok || !metricsRes.ok) {
      console.warn(`[MultiAPI] Finnhub failed for ${ticker}`);
      return {};
    }

    const quote = await quoteRes.json();
    const metrics = await metricsRes.json();

    const data: Partial<CompleteStockData> = {
      currentPrice: quote.c || null, // Current price
      pe: metrics.metric?.peBasicExclExtraTTM || null,
      sharpe: metrics.metric?.sharpeRatio || null,
      dividendYield: metrics.metric?.dividendYieldIndicatedAnnual || null,
      beta: metrics.metric?.beta || null,
    };

    console.log(`[MultiAPI] Finnhub data for ${ticker}:`, {
      price: data.currentPrice,
      pe: data.pe,
      sharpe: data.sharpe,
    });

    return data;
  } catch (error) {
    console.error(`[MultiAPI] Finnhub error for ${ticker}:`, error);
    return {};
  }
}

/**
 * Merge data from multiple sources, prioritizing non-null values
 * Priority: EODHD > Yahoo > Finnhub (for most fields)
 * Exception: Sharpe Ratio prioritizes Yahoo (more accurate calculation)
 */
async function mergeData(
  eodhd: Partial<CompleteStockData>,
  yahoo: Partial<CompleteStockData>,
  finnhub: Partial<CompleteStockData>,
  ticker: string
): Promise<CompleteStockData> {
  const dataSources: CompleteStockData['dataSources'] = {};

  // Current Price: EODHD > Yahoo > Finnhub
  const currentPrice = eodhd.currentPrice ?? yahoo.currentPrice ?? finnhub.currentPrice ?? null;
  if (currentPrice !== null) {
    dataSources.currentPrice = eodhd.currentPrice ? 'EODHD' : yahoo.currentPrice ? 'Yahoo' : 'Finnhub';
  }

  // P/E Ratio: EODHD > Yahoo > Finnhub
  const pe = eodhd.pe ?? yahoo.pe ?? finnhub.pe ?? null;
  if (pe !== null) {
    dataSources.pe = eodhd.pe ? 'EODHD' : yahoo.pe ? 'Yahoo' : 'Finnhub';
  }

  // PEG Ratio: EODHD > Yahoo
  const peg = eodhd.peg ?? yahoo.peg ?? null;
  if (peg !== null) {
    dataSources.peg = eodhd.peg ? 'EODHD' : 'Yahoo';
  }

  // Sharpe Ratio: Yahoo > EODHD > Finnhub (Yahoo has better calculation)
  const sharpe = yahoo.sharpe ?? eodhd.sharpe ?? finnhub.sharpe ?? null;
  if (sharpe !== null) {
    dataSources.sharpe = yahoo.sharpe ? 'Yahoo' : eodhd.sharpe ? 'EODHD' : 'Finnhub';
  }

  // Dividend Yield: EODHD > Yahoo > Finnhub
  const dividendYield = eodhd.dividendYield ?? yahoo.dividendYield ?? finnhub.dividendYield ?? null;
  if (dividendYield !== null) {
    dataSources.dividendYield = eodhd.dividendYield ? 'EODHD' : yahoo.dividendYield ? 'Yahoo' : 'Finnhub';
  }

  // Beta: EODHD > Yahoo > Finnhub
  const beta = eodhd.beta ?? yahoo.beta ?? finnhub.beta ?? null;

  // Volatility: Yahoo > EODHD (Yahoo has better calculation)
  const volatility = yahoo.volatility ?? eodhd.volatility ?? null;

  // Market Cap: EODHD > Yahoo
  const marketCap = eodhd.marketCap ?? null;

  // Currency: Yahoo > EODHD
  const currency = yahoo.currency ?? null;

  // Company Name: EODHD
  const companyName = eodhd.companyName ?? null;

  // Logo URL: Use logo service (EODHD → Finnhub → generic fallback)
  let logoUrl: string | null = null;
  let logoSource: string | undefined = undefined;
  try {
    const domain = getSwissStockDomain(ticker);
    const logoResult = await fetchLogo(ticker, domain);
    logoUrl = logoResult.url;
    logoSource = logoResult.source;
  } catch (error) {
    console.warn(`[MultiAPI] Logo fetch failed for ${ticker}:`, error);
  }
  if (logoSource) {
    dataSources.logoUrl = logoSource;
  }

  console.log(`[MultiAPI] Merged data for ${ticker}:`, {
    currentPrice: `${currentPrice} (${dataSources.currentPrice || 'N/A'})`,
    pe: `${pe} (${dataSources.pe || 'N/A'})`,
    peg: `${peg} (${dataSources.peg || 'N/A'})`,
    sharpe: `${sharpe} (${dataSources.sharpe || 'N/A'})`,
    dividendYield: `${dividendYield} (${dataSources.dividendYield || 'N/A'})`,
    logoUrl: `${logoUrl ? 'fetched' : 'N/A'} (${dataSources.logoUrl || 'N/A'})`,
  });

  return {
    ticker,
    currentPrice,
    pe,
    peg,
    sharpe,
    dividendYield,
    beta,
    volatility,
    marketCap,
    currency,
    companyName,
    logoUrl,
    dataSources,
  };
}

/**
 * Fetch complete stock data using multi-API fallback strategy
 * @param ticker Stock ticker (e.g., "VPBN.SW", "AAPL")
 * @returns Complete stock data merged from multiple sources
 */
export async function fetchCompleteStockData(ticker: string): Promise<CompleteStockData> {
  console.log(`[MultiAPI] Fetching complete data for ${ticker}...`);

  // Determine region from ticker
  const region = ticker.endsWith('.SW') || ticker.endsWith('.N') ? 'CH' : 'US';

  // Get ticker variants for different APIs
  const variants = getTickerVariants(ticker);

  console.log(`[MultiAPI] Ticker variants:`, variants);

  // Fetch from all APIs in parallel
  const [eodhdData, yahooData, finnhubData] = await Promise.all([
    fetchFromEODHD(variants.eodhd),
    fetchFromYahoo(variants.yahoo, region),
    fetchFromFinnhub(variants.finnhub),
  ]);

  // Merge data from all sources
  const completeData = await mergeData(eodhdData, yahooData, finnhubData, ticker);

  // Calculate completeness
  const fields = ['currentPrice', 'pe', 'peg', 'sharpe', 'dividendYield'];
  const filledFields = fields.filter((field) => completeData[field as keyof CompleteStockData] !== null);
  const completeness = (filledFields.length / fields.length) * 100;

  console.log(`[MultiAPI] Data completeness for ${ticker}: ${completeness.toFixed(0)}% (${filledFields.length}/${fields.length} fields)`);

  return completeData;
}
