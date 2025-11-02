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




/**
 * Fetch historical prices for portfolio performance calculation
 * Returns daily closing prices for the last 5 years
 */
export async function fetchHistoricalPrices(
  ticker: string,
  years: number = 5
): Promise<{ date: string; close: number }[] | null> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - years);

    const result = await callDataApi("YahooFinance/get_stock_chart", {
      query: {
        symbol: ticker,
        interval: "1d",
        range: `${years}y`,
      },
    });

    if (!result || !result.chart || !result.chart.result || result.chart.result.length === 0) {
      console.warn(`[StockDataAPI] No historical data for ${ticker}`);
      return null;
    }

    const chartData = result.chart.result[0];
    const timestamps = chartData.timestamp || [];
    const quotes = chartData.indicators?.quote?.[0] || {};
    const closes = quotes.close || [];

    if (timestamps.length === 0 || closes.length === 0) {
      return null;
    }

    // Convert to date/price pairs
    const historicalData: { date: string; close: number }[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] !== null && closes[i] !== undefined) {
        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
        historicalData.push({
          date,
          close: closes[i],
        });
      }
    }

    return historicalData;
  } catch (error) {
    console.error(`[StockDataAPI] Error fetching historical prices for ${ticker}:`, error);
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

    // Find common date range (intersection of all dates)
    const dateArrays = validStocks.map((s) => s.data.map((d) => d.date));
    const commonDates = dateArrays.reduce((acc, dates) => {
      return acc.filter((date) => dates.includes(date));
    });

    if (commonDates.length === 0) {
      return [];
    }

    // Sort dates chronologically
    commonDates.sort();

    // Calculate portfolio value for each date
    const portfolioPerformance: PortfolioPerformancePoint[] = [];
    const initialValue = 10000; // Start with CHF 10,000
    let firstPortfolioValue: number | null = null;

    for (const date of commonDates) {
      let portfolioValue = 0;

      for (const stock of validStocks) {
        const priceData = stock.data.find((d) => d.date === date);
        if (priceData) {
          portfolioValue += priceData.close * stock.weight;
        }
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

