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

/**
 * Fetch fundamental data from EODHD API
 * @param ticker Stock ticker (e.g., "NESN.SW" for Swiss stocks)
 */
export async function fetchEODHDFundamentals(ticker: string): Promise<EODHDFundamentals> {
  const apiKey = process.env.EODHD_API_KEY;
  
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
      };
    }

    const data = await response.json();

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
        fundamentals.pegRatio = parseFloat(highlights.PEGRatio);
      }
      
      if (highlights.PERatio !== undefined && highlights.PERatio !== null) {
        fundamentals.peRatio = parseFloat(highlights.PERatio);
      }
      
      if (highlights.DividendYield !== undefined && highlights.DividendYield !== null) {
        // EODHD returns dividend yield as decimal (0.03 = 3%)
        fundamentals.dividendYield = parseFloat(highlights.DividendYield) * 100;
      }
      
      if (highlights.MarketCapitalization !== undefined && highlights.MarketCapitalization !== null) {
        fundamentals.marketCap = parseFloat(highlights.MarketCapitalization);
      }
      
      if (highlights.Beta !== undefined && highlights.Beta !== null) {
        fundamentals.beta = parseFloat(highlights.Beta);
      }
      
      if (highlights.EarningsShare !== undefined && highlights.EarningsShare !== null) {
        fundamentals.eps = parseFloat(highlights.EarningsShare);
      }
      
      if (highlights.BookValue !== undefined && highlights.BookValue !== null) {
        fundamentals.bookValue = parseFloat(highlights.BookValue);
      }
    }

    // Valuation section may contain additional P/E data
    if (data.Valuation && !fundamentals.peRatio) {
      if (data.Valuation.TrailingPE !== undefined && data.Valuation.TrailingPE !== null) {
        fundamentals.peRatio = parseFloat(data.Valuation.TrailingPE);
      }
    }

    // Technicals section may contain beta
    if (data.Technicals && !fundamentals.beta) {
      if (data.Technicals.Beta !== undefined && data.Technicals.Beta !== null) {
        fundamentals.beta = parseFloat(data.Technicals.Beta);
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

