/**
 * Yahoo Finance API Integration via Manus Data API
 * Provides stock prices, historical data, and risk metrics (Sharpe Ratio, Volatility)
 */

import { callDataApi } from "./dataApi";

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

    return defaultMetrics;
  } catch (error: any) {
    console.error(`[StockDataAPI] Error fetching data for ${ticker}:`, error);
    return defaultMetrics;
  }
}

