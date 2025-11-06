/**
 * EODHD API Integration for Fundamental Data
 * Provides PEG Ratio, P/E Ratio, Dividend Yield, and other fundamentals
 */

export interface EODHDFundamentals {
  pegRatio: number | null;
  peRatio: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  beta: number | null;
  eps: number | null;
  bookValue: number | null;
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
      pegRatio: null,
      peRatio: null,
      dividendYield: null,
      marketCap: null,
      beta: null,
      eps: null,
      bookValue: null,
    };
  }

  try {
    // EODHD API endpoint for fundamentals
    const url = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${apiKey}&fmt=json`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`[EODHD] API request failed for ${ticker}: ${response.status} ${response.statusText}`);
      return {
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
      pegRatio: null,
      peRatio: null,
      dividendYield: null,
      marketCap: null,
      beta: null,
      eps: null,
      bookValue: null,
    };

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

    // ETF-specific data handling
    if (data.ETF_Data) {
      // ETF dividend yield from Valuations_Rates_Portfolio
      if (data.ETF_Data.Valuations_Growth?.Valuations_Rates_Portfolio?.["Dividend-Yield Factor"]) {
        const divYield = parseFloat(data.ETF_Data.Valuations_Growth.Valuations_Rates_Portfolio["Dividend-Yield Factor"]);
        if (!isNaN(divYield) && divYield > 0) {
          fundamentals.dividendYield = divYield;
        }
      }
      
      // ETF performance data (for YTD calculation)
      // Note: YTD Performance is calculated separately in refreshData using real-time prices
    }

    console.log(`[EODHD] Fetched fundamentals for ${ticker}:`, {
      pegRatio: fundamentals.pegRatio,
      peRatio: fundamentals.peRatio,
      dividendYield: fundamentals.dividendYield,
      beta: fundamentals.beta,
      isETF: !!data.ETF_Data,
    });

    return fundamentals;
  } catch (error: any) {
    console.error(`[EODHD] Error fetching fundamentals for ${ticker}:`, error.message);
    return {
      pegRatio: null,
      peRatio: null,
      dividendYield: null,
      marketCap: null,
      beta: null,
      eps: null,
      bookValue: null,
    };
  }
}

