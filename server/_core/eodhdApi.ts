/**
 * EODHD API Integration for Fundamental Data
 * Provides PEG Ratio, P/E Ratio, Dividend Yield, and other fundamentals
 * 
 * Features:
 * - Memory caching with 1-hour TTL
 * - Retry logic with exponential backoff
 * - Graceful error handling
 */

import { apiCache, CACHE_TTL } from './apiCache';
import { retryFetch } from './retryUtil';
import { eodhdRealTimeSchema, eodhdFundamentalsSchema, payloadSample } from './externalSchemas';

import { ENV } from "./env";
export interface EODHDFundamentals {
  companyName: string | null;
  sector: string | null;
  industry: string | null;
  pegRatio: number | null;
  peRatio: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  beta: number | null;
  eps: number | null;
  bookValue: number | null;
  earningsGrowth: number | null; // Calculated from quarterly earnings (annual %)
}

export interface EODHDRealTime {
  close: number | null;
  previousClose: number | null;
  changePercent: number | null; // Today's change in % (e.g. 1.23 = +1.23%)
}

/**
 * Fetch real-time (delayed) quote from EODHD, used for the daily change ("Heute").
 * @param ticker Stock ticker (e.g., "NESN.SW" for Swiss stocks)
 */
export async function fetchEODHDRealTime(ticker: string): Promise<EODHDRealTime> {
  const empty: EODHDRealTime = { close: null, previousClose: null, changePercent: null };
  const apiKey = ENV.eodhdApiKey;
  if (!apiKey) {
    console.warn('[EODHD] API key not configured');
    return empty;
  }

  const cacheKey = `eodhd:realtime:${ticker}`;
  const cached = apiCache.get<EODHDRealTime>(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://eodhd.com/api/real-time/${ticker}?api_token=${apiKey}&fmt=json`;
    const response = await retryFetch(url, {}, { maxRetries: 3, baseDelay: 1000 });
    if (!response.ok) {
      console.warn(`[EODHD] real-time request failed for ${ticker}: ${response.status} ${response.statusText}`);
      return empty;
    }
    const raw = await response.json();
    // A-05: validate the shape before reading — provider error pages must not
    // become NaN prices downstream.
    const parsed = eodhdRealTimeSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn(`[EODHD] Unexpected real-time payload for ${ticker}. Sample: ${payloadSample(raw)}`);
      return empty;
    }
    const data = parsed.data;
    const toNum = (v: number | string | null | undefined) => {
      if (v === undefined || v === null || v === 'NA') return null;
      const n = Number(v);
      return Number.isNaN(n) ? null : n;
    };
    const result: EODHDRealTime = {
      close: toNum(data.close),
      previousClose: toNum(data.previousClose),
      changePercent: toNum(data.change_p),
    };
    apiCache.set(cacheKey, result, CACHE_TTL.FUNDAMENTALS);
    return result;
  } catch (error: any) {
    console.error(`[EODHD] Error fetching real-time for ${ticker}:`, error.message);
    return empty;
  }
}

/**
 * Fetch fundamental data from EODHD API
 * @param ticker Stock ticker (e.g., "NESN.SW" for Swiss stocks)
 */
export async function fetchEODHDFundamentals(ticker: string): Promise<EODHDFundamentals> {
  const apiKey = ENV.eodhdApiKey;
  
  if (!apiKey) {
    console.warn('[EODHD] API key not configured');
    return {
      companyName: null,
      sector: null,
      industry: null,
      pegRatio: null,
      peRatio: null,
      dividendYield: null,
      marketCap: null,
      beta: null,
      eps: null,
      bookValue: null,
      earningsGrowth: null,
    };
  }

  // Check cache first
  const cacheKey = `eodhd:fundamentals:${ticker}`;
  const cached = apiCache.get<EODHDFundamentals>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // EODHD API endpoint for fundamentals
    const url = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${apiKey}&fmt=json`;
    
    // Use retry logic with exponential backoff
    const response = await retryFetch(url, {}, { maxRetries: 3, baseDelay: 1000 });
    
    if (!response.ok) {
      console.warn(`[EODHD] API request failed for ${ticker}: ${response.status} ${response.statusText}`);
      return {
        companyName: null,
        sector: null,
        industry: null,
        pegRatio: null,
        peRatio: null,
        dividendYield: null,
        marketCap: null,
        beta: null,
        eps: null,
        bookValue: null,
        earningsGrowth: null,
      };
    }

    const raw = await response.json();

    // Extract fundamental metrics
    const fundamentals: EODHDFundamentals = {
      companyName: null,
      sector: null,
      industry: null,
      pegRatio: null,
      peRatio: null,
      dividendYield: null,
      marketCap: null,
      beta: null,
      eps: null,
      bookValue: null,
      earningsGrowth: null,
    };

    // A-05: validate the subset of the payload we read; on mismatch return
    // the all-null fallback instead of propagating garbage into the DB.
    const parsedResponse = eodhdFundamentalsSchema.safeParse(raw);
    if (!parsedResponse.success) {
      console.warn(`[EODHD] Unexpected fundamentals payload for ${ticker}. Sample: ${payloadSample(raw)}`);
      return fundamentals;
    }
    const data = parsedResponse.data;
    // parseFloat semantics for values that may arrive as strings
    const pf = (v: number | string): number => (typeof v === 'number' ? v : parseFloat(v));

    // Extract company info from General section
    if (data.General) {
      if (data.General.Name) {
        fundamentals.companyName = data.General.Name;
      }
      if (data.General.Sector) {
        fundamentals.sector = data.General.Sector;
      }
      if (data.General.Industry) {
        fundamentals.industry = data.General.Industry;
      }
    }

    // Highlights section contains key metrics
    if (data.Highlights) {
      const highlights = data.Highlights;
      
      if (highlights.PEGRatio !== undefined && highlights.PEGRatio !== null) {
        fundamentals.pegRatio = pf(highlights.PEGRatio);
      }
      
      if (highlights.PERatio !== undefined && highlights.PERatio !== null) {
        fundamentals.peRatio = pf(highlights.PERatio);
      }
      
      if (highlights.DividendYield !== undefined && highlights.DividendYield !== null) {
        // EODHD returns dividend yield as decimal (0.03 = 3%)
        fundamentals.dividendYield = pf(highlights.DividendYield) * 100;
      }
      
      if (highlights.MarketCapitalization !== undefined && highlights.MarketCapitalization !== null) {
        fundamentals.marketCap = pf(highlights.MarketCapitalization);
      }
      
      if (highlights.Beta !== undefined && highlights.Beta !== null) {
        fundamentals.beta = pf(highlights.Beta);
      }
      
      if (highlights.EarningsShare !== undefined && highlights.EarningsShare !== null) {
        fundamentals.eps = pf(highlights.EarningsShare);
      }
      
      if (highlights.BookValue !== undefined && highlights.BookValue !== null) {
        fundamentals.bookValue = pf(highlights.BookValue);
      }
    }

    // Valuation section may contain additional P/E data
    if (data.Valuation && !fundamentals.peRatio) {
      if (data.Valuation.TrailingPE !== undefined && data.Valuation.TrailingPE !== null) {
        fundamentals.peRatio = pf(data.Valuation.TrailingPE);
      }
    }

    // Technicals section may contain beta
    if (data.Technicals && !fundamentals.beta) {
      if (data.Technicals.Beta !== undefined && data.Technicals.Beta !== null) {
        fundamentals.beta = pf(data.Technicals.Beta);
      }
    }

    // Calculate earnings growth from quarterly earnings if available
    if (data.Earnings && data.Earnings.History) {
      try {
        const quarters = Object.entries(data.Earnings.History)
          .map(([date, earnings]: [string, any]) => ({
            date: new Date(date),
            eps: parseFloat(earnings.epsActual || earnings.reportedEPS || 0),
          }))
          .filter(q => q.eps > 0)
          .sort((a, b) => b.date.getTime() - a.date.getTime());

        if (quarters.length >= 5) {
          const recentEPS = quarters.slice(0, 4).reduce((sum, q) => sum + q.eps, 0);
          const previousEPS = quarters.slice(4, 8).reduce((sum, q) => sum + q.eps, 0);
          
          if (previousEPS > 0) {
            fundamentals.earningsGrowth = ((recentEPS - previousEPS) / previousEPS);
            console.log(`[EODHD] Calculated earnings growth for ${ticker}: ${(fundamentals.earningsGrowth * 100).toFixed(2)}%`);
          }
        }
      } catch (error) {
        console.warn(`[EODHD] Could not calculate earnings growth for ${ticker}:`, error);
      }
    }

    console.log(`[EODHD] Fetched fundamentals for ${ticker}:`, {
      pegRatio: fundamentals.pegRatio,
      peRatio: fundamentals.peRatio,
      dividendYield: fundamentals.dividendYield,
      beta: fundamentals.beta,
      earningsGrowth: fundamentals.earningsGrowth,
    });

    // Cache the result for 1 hour
    apiCache.set(cacheKey, fundamentals, CACHE_TTL.FUNDAMENTALS);

    return fundamentals;
  } catch (error: any) {
    console.error(`[EODHD] Error fetching fundamentals for ${ticker}:`, error.message);
    return {
      companyName: null,
      sector: null,
      industry: null,
      pegRatio: null,
      peRatio: null,
      dividendYield: null,
      marketCap: null,
      beta: null,
      eps: null,
      bookValue: null,
      earningsGrowth: null,
    };
  }
}

