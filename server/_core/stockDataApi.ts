/**
 * Yahoo Finance API Integration via Manus Data API
 * Provides stock prices, historical data, and risk metrics (Sharpe Ratio, Volatility)
 * 
 * Features:
 * - Memory caching with 5-minute TTL for quotes
 * - Retry logic handled by callDataApi
 */

import { callDataApi } from "./dataApi";
import { apiCache, CACHE_TTL } from './apiCache';

export interface StockMetrics {
  currentPrice: number | null;
  currency: string | null;
  week52High: number | null;
  week52Low: number | null;
  pegRatio: number | null;
  peRatio: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  beta: number | null;
  sharpeRatio: number | null;
  volatility: number | null;
}

/**
 * Calculate Sharpe Ratio from historical price data
 * Sharpe Ratio = (Average Return - Risk-Free Rate) / Standard Deviation of Returns
 * Using 0% risk-free rate for simplicity
 */
function calculateSharpeRatio(prices: number[]): { sharpe: number; volatility: number } | null {
  if (!prices || prices.length < 30) {
    return null; // Need at least 30 data points
  }

  // Calculate daily returns
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > 0 && prices[i - 1] > 0) {
      const dailyReturn = (prices[i] - prices[i - 1]) / prices[i - 1];
      returns.push(dailyReturn);
    }
  }

  if (returns.length < 30) {
    return null;
  }

  // Calculate average return
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Calculate standard deviation
  const squaredDiffs = returns.map((r) => Math.pow(r - avgReturn, 2));
  const variance = squaredDiffs.reduce((sum, sd) => sum + sd, 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return null;
  }

  // Annualize the metrics (assuming ~252 trading days per year)
  const annualizedReturn = avgReturn * 252;
  const annualizedVolatility = stdDev * Math.sqrt(252);

  // Sharpe Ratio (using 0% risk-free rate)
  const sharpeRatio = annualizedReturn / annualizedVolatility;

  return {
    sharpe: sharpeRatio,
    volatility: annualizedVolatility * 100, // Convert to percentage
  };
}

/**
 * Fetch comprehensive stock metrics from Yahoo Finance
 * @param ticker Stock ticker symbol (e.g., "AAPL", "NESN.SW")
 * @param region Market region ("US" or "CH" for Switzerland)
 */
export async function fetchStockMetrics(ticker: string, region: string = "US"): Promise<StockMetrics> {
  const defaultMetrics: StockMetrics = {
    currentPrice: null,
    currency: null,
    week52High: null,
    week52Low: null,
    pegRatio: null,
    peRatio: null,
    dividendYield: null,
    marketCap: null,
    beta: null,
    sharpeRatio: null,
    volatility: null,
  };

  // Check cache first
  const cacheKey = `yahoo:metrics:${ticker}:${region}`;
  const cached = apiCache.get<StockMetrics>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Fetch historical chart data (1 year for Sharpe Ratio calculation)
    const chartResponse = await callDataApi("YahooFinance/get_stock_chart", {
      query: {
        symbol: ticker,
        region: region,
        interval: "1d",
        range: "1y", // 1 year of data for reliable Sharpe Ratio
        includeAdjustedClose: "true",
        events: "div,split",
      },
    });

    if (!chartResponse || !(chartResponse as any).chart || !(chartResponse as any).chart.result || (chartResponse as any).chart.result.length === 0) {
      console.warn(`[StockDataAPI] No chart data for ${ticker}`);
      return defaultMetrics;
    }

    const result = (chartResponse as any).chart.result[0];
    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];

    // Extract current price and currency
    if (meta) {
      defaultMetrics.currentPrice = meta.regularMarketPrice || meta.previousClose || null;
      defaultMetrics.currency = meta.currency || null;
      
      // Fallback: Swiss stocks should use CHF, not USD
      if (ticker.endsWith('.SW') && defaultMetrics.currency === 'USD') {
        console.log(`[StockDataAPI] Correcting currency for Swiss stock ${ticker}: USD -> CHF`);
        defaultMetrics.currency = 'CHF';
      }
    }

    // Extract 52-week high/low from metadata
    if (meta) {
      defaultMetrics.week52High = meta.fiftyTwoWeekHigh || null;
      defaultMetrics.week52Low = meta.fiftyTwoWeekLow || null;
    }

    // Calculate Sharpe Ratio and Volatility from historical prices
    if (quote && quote.close && Array.isArray(quote.close)) {
      const closePrices = quote.close.filter((p: any) => p !== null && p !== undefined && !isNaN(p));
      
      if (closePrices.length >= 30) {
        const riskMetrics = calculateSharpeRatio(closePrices);
        if (riskMetrics) {
          defaultMetrics.sharpeRatio = riskMetrics.sharpe;
          defaultMetrics.volatility = riskMetrics.volatility;
        }
      }
    }

    console.log(`[StockDataAPI] Fetched metrics for ${ticker}:`, {
      currentPrice: defaultMetrics.currentPrice,
      sharpeRatio: defaultMetrics.sharpeRatio,
      volatility: defaultMetrics.volatility,
      week52High: defaultMetrics.week52High,
      week52Low: defaultMetrics.week52Low,
    });

    // Cache the result for 5 minutes
    apiCache.set(cacheKey, defaultMetrics, CACHE_TTL.QUOTE);

    return defaultMetrics;
  } catch (error: any) {
    console.error(`[StockDataAPI] Error fetching data for ${ticker}:`, error);
    return defaultMetrics;
  }
}




/**
 * Fetch historical prices for portfolio performance calculation
 * Returns daily closing prices for the last 5 years
 */
export async function fetchHistoricalPrices(
  ticker: string,
  years: number = 5
): Promise<{ date: string; close: number }[] | null> {
  const apiKey = process.env.EODHD_API_KEY;
  
  if (!apiKey) {
    console.warn('[fetchHistoricalPrices] EODHD API key not configured');
    return null;
  }

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - years);
    
    const fromDate = startDate.toISOString().split('T')[0];
    const toDate = endDate.toISOString().split('T')[0];
    
    // Convert ticker format (e.g., NESN -> NESN.SW for Swiss stocks)
    let cleanTicker = ticker;
    if (!ticker.includes('.')) {
      // Assume Swiss stock if no exchange suffix
      cleanTicker = `${ticker}.SW`;
    }
    
    console.log(`[fetchHistoricalPrices] Fetching ${years} years for ${cleanTicker} from ${fromDate} to ${toDate}`);
    
    const url = `https://eodhd.com/api/eod/${cleanTicker}?api_token=${apiKey}&from=${fromDate}&to=${toDate}&fmt=json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`[fetchHistoricalPrices] API request failed for ${cleanTicker}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`[fetchHistoricalPrices] No data returned for ${cleanTicker}`);
      return null;
    }
    
    // Convert EODHD format to our format
    const historicalData = data.map((item: any) => ({
      date: item.date,
      close: item.close,
    }));
    
    console.log(`[fetchHistoricalPrices] Fetched ${historicalData.length} data points for ${cleanTicker} spanning ${years} years`);
    
    return historicalData;
  } catch (error) {
    console.error(`[fetchHistoricalPrices] Error fetching historical prices for ${ticker}:`, error);
    return null;
  }
}

/**
 * Calculate portfolio performance over time based on current holdings and weights
 */
export interface PortfolioPerformancePoint {
  date: string;
  value: number;
  percentChange: number;
}

export async function calculatePortfolioPerformance(
  stocks: Array<{ ticker: string; portfolioWeight: string }>
): Promise<PortfolioPerformancePoint[]> {
  try {
    // Fetch historical data for all stocks
    const historicalDataPromises = stocks.map(async (stock) => {
      const data = await fetchHistoricalPrices(stock.ticker, 5);
      return {
        ticker: stock.ticker,
        weight: parseFloat(stock.portfolioWeight) / 100,
        data: data || [],
      };
    });

    const allHistoricalData = await Promise.all(historicalDataPromises);

    // Filter out stocks with no data
    const validStocks = allHistoricalData.filter((s) => s.data.length > 0);

    if (validStocks.length === 0) {
      return [];
    }

    // Use UNION of all dates (not intersection) to avoid data loss when stocks are added
    const allDatesSet = new Set<string>();
    validStocks.forEach((s) => {
      s.data.forEach((d) => allDatesSet.add(d.date));
    });

    const allDates = Array.from(allDatesSet).sort();

    if (allDates.length === 0) {
      return [];
    }

    // Build price maps with forward-fill for missing dates
    const stockPriceMaps = validStocks.map((stock) => {
      const priceMap = new Map<string, number>();
      let lastKnownPrice: number | null = null;

      for (const date of allDates) {
        const priceData = stock.data.find((d) => d.date === date);
        if (priceData) {
          lastKnownPrice = priceData.close;
          priceMap.set(date, priceData.close);
        } else if (lastKnownPrice !== null) {
          // Forward-fill: use last known price
          priceMap.set(date, lastKnownPrice);
        }
        // If no price available yet (stock not added), don't include in portfolio
      }

      return { ...stock, priceMap };
    });

    // Calculate portfolio value for each date
    const portfolioPerformance: PortfolioPerformancePoint[] = [];
    const initialValue = 10000; // Start with CHF 10,000
    let firstPortfolioValue: number | null = null;

    for (const date of allDates) {
      let portfolioValue = 0;
      let totalWeight = 0; // Track actual weight of stocks present on this date

      for (const stockMap of stockPriceMaps) {
        const price = stockMap.priceMap.get(date);
        if (price !== undefined) {
          portfolioValue += price * stockMap.weight;
          totalWeight += stockMap.weight;
        }
      }

      // Skip dates where no stocks have data yet
      if (totalWeight === 0) {
        continue;
      }

      // Store first portfolio value for normalization
      if (firstPortfolioValue === null) {
        firstPortfolioValue = portfolioValue;
      }

      // Normalize to initial value (CHF 10,000)
      const normalizedValue = (portfolioValue / firstPortfolioValue) * initialValue;
      const percentChange = ((normalizedValue - initialValue) / initialValue) * 100;

      portfolioPerformance.push({
        date,
        value: normalizedValue,
        percentChange,
      });
    }

    return portfolioPerformance;
  } catch (error) {
    console.error("[StockDataAPI] Error calculating portfolio performance:", error);
    return [];
  }
}

