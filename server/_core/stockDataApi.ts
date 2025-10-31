/**
 * Yahoo Finance API Integration via Manus Data API
 * Fetches stock data including prices, fundamentals, and historical data
 */

import { callDataApi } from "./dataApi";

export interface StockMetrics {
  currentPrice: number | null;
  pegRatio: number | null;
  peRatio: number | null;
  dividendYield: number | null;
  week52High: number | null;
  week52Low: number | null;
  marketCap: number | null;
  beta: number | null;
  sharpeRatio: number | null;
  volatility: number | null;
  currency: string;
}

interface YahooChartMeta {
  currency: string;
  regularMarketPrice: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

interface YahooChartResult {
  meta: YahooChartMeta;
  timestamp: number[];
  indicators: {
    quote: Array<{
      close: (number | null)[];
      high: (number | null)[];
      low: (number | null)[];
      open: (number | null)[];
      volume: (number | null)[];
    }>;
    adjclose?: Array<{
      adjclose: (number | null)[];
    }>;
  };
}

interface YahooInsights {
  instrumentInfo?: {
    keyTechnicals?: {
      provider?: string;
      peRatio?: number;
      pegRatio?: number;
    };
    valuation?: {
      trailingPE?: number;
      forwardPE?: number;
    };
  };
  companySnapshot?: {
    sectorInfo?: string;
    company?: {
      dividendYield?: number;
      beta?: number;
      marketCap?: number;
    };
  };
}

/**
 * Calculate annualized Sharpe Ratio from historical price data
 * Sharpe Ratio = (Average Return - Risk Free Rate) / Standard Deviation of Returns
 * Using 0% risk-free rate for simplicity
 */
function calculateSharpeRatio(prices: number[]): number | null {
  if (!prices || prices.length < 30) {
    return null; // Need at least 30 data points for reliable calculation
  }

  // Calculate daily returns
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] && prices[i - 1]) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }

  if (returns.length < 20) {
    return null;
  }

  // Calculate average return
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Calculate standard deviation
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return null; // Avoid division by zero
  }

  // Annualize the Sharpe Ratio (assuming ~252 trading days per year)
  const annualizedReturn = avgReturn * 252;
  const annualizedStdDev = stdDev * Math.sqrt(252);
  const sharpeRatio = annualizedReturn / annualizedStdDev;

  return Math.round(sharpeRatio * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate annualized volatility from historical price data
 */
function calculateVolatility(prices: number[]): number | null {
  if (!prices || prices.length < 30) {
    return null;
  }

  // Calculate daily returns
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] && prices[i - 1]) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }

  if (returns.length < 20) {
    return null;
  }

  // Calculate standard deviation
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Annualize volatility (assuming ~252 trading days per year)
  const annualizedVolatility = stdDev * Math.sqrt(252) * 100; // Convert to percentage

  return Math.round(annualizedVolatility * 100) / 100; // Round to 2 decimals
}

/**
 * Fetch comprehensive stock metrics from Yahoo Finance API
 * @param ticker Stock ticker symbol (e.g., "NESN.SW", "AAPL")
 * @param region Market region (e.g., "CH" for Switzerland, "US" for USA)
 */
export async function fetchStockMetrics(ticker: string, region: string = "CH"): Promise<StockMetrics> {
  const defaultMetrics: StockMetrics = {
    currentPrice: null,
    pegRatio: null,
    peRatio: null,
    dividendYield: null,
    week52High: null,
    week52Low: null,
    marketCap: null,
    beta: null,
    sharpeRatio: null,
    volatility: null,
    currency: "CHF",
  };

  try {
    // Fetch historical chart data (1 year for Sharpe Ratio calculation)
    const chartResponse = await callDataApi("YahooFinance/get_stock_chart", {
      query: {
        symbol: ticker,
        region: region,
        interval: "1d",
        range: "1y", // 1 year of data for reliable Sharpe Ratio
        includeAdjustedClose: true,
        events: "div,split",
      },
    });

    if (!chartResponse || !(chartResponse as any).chart || !(chartResponse as any).chart.result || (chartResponse as any).chart.result.length === 0) {
      console.warn(`[StockDataAPI] No chart data for ${ticker}`);
      return defaultMetrics;
    }

    const chartResult: YahooChartResult = (chartResponse as any).chart.result[0];
    const meta = chartResult.meta;

    // Extract basic metrics from chart metadata
    const metrics: StockMetrics = {
      currentPrice: meta.regularMarketPrice || null,
      currency: meta.currency || "CHF",
      week52High: meta.fiftyTwoWeekHigh || null,
      week52Low: meta.fiftyTwoWeekLow || null,
      pegRatio: null,
      peRatio: null,
      dividendYield: null,
      marketCap: null,
      beta: null,
      sharpeRatio: null,
      volatility: null,
    };

    // Calculate Sharpe Ratio and Volatility from historical prices
    const closePrices = chartResult.indicators?.quote?.[0]?.close || [];
    const validPrices = closePrices.filter((p): p is number => p !== null && p !== undefined);

    if (validPrices.length >= 30) {
      metrics.sharpeRatio = calculateSharpeRatio(validPrices);
      metrics.volatility = calculateVolatility(validPrices);
    }

    // Fetch fundamental insights (PEG Ratio, P/E Ratio, etc.)
    try {
      const insightsResponse = await callDataApi("YahooFinance/get_stock_insights", {
        query: { symbol: ticker },
      });

      if (insightsResponse) {
        const insights: YahooInsights = insightsResponse;

        // Extract PEG Ratio
        if (insights.instrumentInfo?.keyTechnicals?.pegRatio) {
          metrics.pegRatio = insights.instrumentInfo.keyTechnicals.pegRatio;
        }

        // Extract P/E Ratio
        if (insights.instrumentInfo?.keyTechnicals?.peRatio) {
          metrics.peRatio = insights.instrumentInfo.keyTechnicals.peRatio;
        } else if (insights.instrumentInfo?.valuation?.trailingPE) {
          metrics.peRatio = insights.instrumentInfo.valuation.trailingPE;
        }

        // Extract additional metrics
        if (insights.companySnapshot?.company) {
          const company = insights.companySnapshot.company;
          if (company.dividendYield !== undefined) {
            metrics.dividendYield = company.dividendYield * 100; // Convert to percentage
          }
          if (company.beta !== undefined) {
            metrics.beta = company.beta;
          }
          if (company.marketCap !== undefined) {
            metrics.marketCap = company.marketCap;
          }
        }
      }
    } catch (insightsError) {
      console.warn(`[StockDataAPI] Failed to fetch insights for ${ticker}:`, insightsError);
      // Continue with chart data only
    }

    return metrics;
  } catch (error) {
    console.error(`[StockDataAPI] Error fetching data for ${ticker}:`, error);
    return defaultMetrics;
  }
}

/**
 * Batch fetch stock metrics for multiple tickers
 * Adds delay between requests to avoid rate limiting
 */
export async function batchFetchStockMetrics(
  tickers: Array<{ ticker: string; region?: string }>,
  delayMs: number = 500
): Promise<Map<string, StockMetrics>> {
  const results = new Map<string, StockMetrics>();

  for (const { ticker, region } of tickers) {
    try {
      const metrics = await fetchStockMetrics(ticker, region || "CH");
      results.set(ticker, metrics);

      // Add delay to avoid rate limiting
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error(`[StockDataAPI] Failed to fetch ${ticker}:`, error);
      results.set(ticker, {
        currentPrice: null,
        pegRatio: null,
        peRatio: null,
        dividendYield: null,
        week52High: null,
        week52Low: null,
        marketCap: null,
        beta: null,
        sharpeRatio: null,
        volatility: null,
        currency: "CHF",
      });
    }
  }

  return results;
}

