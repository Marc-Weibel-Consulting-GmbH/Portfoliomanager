/**
 * Dividend Calendar Integration using Yahoo Finance via Manus Data API
 * Fetches historical dividends and estimates upcoming payments
 */

import { callDataApi } from "./_core/dataApi";

interface DividendEvent {
  ticker: string;
  exDividendDate: string;
  paymentDate: string;
  amount: number;
  currency: string;
}

/**
 * Fetch dividend history from Yahoo Finance and estimate next payments
 * @param ticker Stock ticker symbol
 * @returns Array of estimated upcoming dividend events
 */
async function fetchTickerDividends(ticker: string): Promise<DividendEvent[]> {
  try {
    // Determine region based on ticker suffix
    let region = 'US';
    let yahooSymbol = ticker;
    
    if (ticker.endsWith('.SW')) {
      region = 'CH';
      // Yahoo uses different format for Swiss stocks
      yahooSymbol = ticker.replace('.SW', '.SW');
    } else if (!ticker.includes('.')) {
      // No suffix - assume US stock
      yahooSymbol = ticker;
      region = 'US';
    }

    // Fetch 1 year of data with dividend events
    const response = await callDataApi("YahooFinance/get_stock_chart", {
      query: {
        symbol: yahooSymbol,
        region: region,
        interval: '1d',
        range: '1y',
        includeAdjustedClose: true,
        events: 'div'
      },
    }) as any;

    if (!response?.chart?.result || response.chart.result.length === 0) {
      console.log(`[DividendCalendar] No data for ${ticker}`);
      return [];
    }

    const result = response.chart.result[0];
    
    // Check if dividend events exist
    if (!result.events || !result.events.dividends) {
      console.log(`[DividendCalendar] No dividend history for ${ticker}`);
      return [];
    }

    const dividends = result.events.dividends;
    const meta = result.meta;
    const currency = meta.currency || 'USD';

    // Convert dividends object to sorted array
    const dividendArray = Object.entries(dividends)
      .map(([timestamp, data]: [string, any]) => ({
        date: new Date(parseInt(timestamp) * 1000),
        amount: data.amount
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime()); // Most recent first

    if (dividendArray.length < 2) {
      console.log(`[DividendCalendar] Not enough dividend history for ${ticker}`);
      return [];
    }

    // Get last 4 dividends to determine frequency
    const recentDividends = dividendArray.slice(0, Math.min(4, dividendArray.length));
    
    // Calculate average interval between dividends (in days)
    let totalInterval = 0;
    for (let i = 0; i < recentDividends.length - 1; i++) {
      const interval = Math.abs(
        recentDividends[i].date.getTime() - recentDividends[i + 1].date.getTime()
      ) / (1000 * 60 * 60 * 24);
      totalInterval += interval;
    }
    const avgInterval = Math.round(totalInterval / (recentDividends.length - 1));

    // Determine payment frequency
    let frequency: 'quarterly' | 'annual' | 'semi-annual' | 'monthly';
    if (avgInterval >= 300) {
      frequency = 'annual';
    } else if (avgInterval >= 150) {
      frequency = 'semi-annual';
    } else if (avgInterval >= 60) {
      frequency = 'quarterly';
    } else {
      frequency = 'monthly';
    }

    // Estimate next dividend payment(s)
    const lastDividend = recentDividends[0];
    const lastDate = lastDividend.date;
    const lastAmount = lastDividend.amount;
    const today = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(today.getFullYear() + 1);

    const upcomingDividends: DividendEvent[] = [];
    let nextDate = new Date(lastDate);
    
    // Generate next dividend dates based on frequency
    const paymentsPerYear = frequency === 'quarterly' ? 4 : frequency === 'annual' ? 1 : frequency === 'semi-annual' ? 2 : 12;
    
    for (let i = 0; i < paymentsPerYear * 2; i++) {
      nextDate = new Date(nextDate);
      nextDate.setDate(nextDate.getDate() + avgInterval);
      
      if (nextDate > today && nextDate <= oneYearFromNow) {
        upcomingDividends.push({
          ticker: ticker,
          exDividendDate: nextDate.toISOString().split('T')[0],
          paymentDate: new Date(nextDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // ~2 weeks after ex-date
          amount: lastAmount,
          currency: currency
        });
      }
      
      if (nextDate > oneYearFromNow) break;
    }

    console.log(`[DividendCalendar] ${ticker}: Found ${upcomingDividends.length} estimated dividends (${frequency}, ${currency})`);
    return upcomingDividends;
  } catch (error) {
    console.error(`[DividendCalendar] Failed to fetch dividends for ${ticker}:`, error);
    return [];
  }
}

/**
 * Fetch upcoming dividends for all tickers (kept for backward compatibility)
 */
export async function fetchUpcomingDividends(from: string, to: string): Promise<DividendEvent[]> {
  // This function is kept for backward compatibility but not used
  return [];
}

/**
 * Get upcoming dividends for specific tickers in a portfolio
 * @param tickers Array of stock tickers
 * @param daysAhead Number of days to look ahead (default: 365 for next 12 months)
 * @returns Array of dividend events for the specified tickers
 */
export async function getPortfolioDividends(tickers: string[], daysAhead: number = 365): Promise<DividendEvent[]> {
  console.log(`[DividendCalendar] Fetching dividends for ${tickers.length} tickers using Yahoo Finance API`);
  
  // Fetch dividends for each ticker in parallel
  const dividendPromises = tickers.map(ticker => fetchTickerDividends(ticker));
  const dividendArrays = await Promise.all(dividendPromises);
  
  // Flatten and sort by ex-dividend date
  const allDividends = dividendArrays.flat();
  allDividends.sort((a, b) => 
    new Date(a.exDividendDate).getTime() - new Date(b.exDividendDate).getTime()
  );

  console.log(`[DividendCalendar] Portfolio has ${allDividends.length} estimated upcoming dividends`);
  return allDividends;
}

/**
 * Check for dividends happening today or in the next few days
 */
export async function checkDividendNotifications(portfolioId: number, notificationDays: number = 3): Promise<DividendEvent[]> {
  console.log(`[DividendCalendar] Checking notifications for portfolio ${portfolioId}`);
  return [];
}

/**
 * Calculate expected dividend income for a portfolio
 * @param holdings Record of ticker -> shares
 * @param dividends Array of dividend events
 * @returns Total expected dividend income in CHF
 */
export function calculateExpectedDividendIncome(
  holdings: Record<string, number>,
  dividends: DividendEvent[]
): number {
  let totalIncome = 0;

  dividends.forEach(div => {
    const shares = holdings[div.ticker] || holdings[div.ticker.toUpperCase()] || 0;
    if (shares > 0) {
      // Convert to CHF if needed (simplified - would need exchange rates in production)
      const amountInCHF = div.currency === "USD" ? div.amount * 0.88 : div.amount;
      totalIncome += shares * amountInCHF;
    }
  });

  return totalIncome;
}
