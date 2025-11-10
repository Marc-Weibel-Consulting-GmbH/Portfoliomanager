/**
 * Finnhub Dividend Calendar Integration
 * Fetches upcoming dividend payments for portfolio stocks
 */

interface DividendEvent {
  ticker: string;
  exDividendDate: string;
  paymentDate: string;
  amount: number;
  currency: string;
}

/**
 * Fetch dividend history and estimate next payment for a ticker
 * Uses EODHD API to get historical dividends and predict next payment
 * @param ticker Stock ticker symbol
 * @returns Array of estimated upcoming dividend events
 */
async function fetchTickerDividends(ticker: string): Promise<DividendEvent[]> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    console.warn("[DividendCalendar] EODHD_API_KEY not configured");
    return [];
  }

  try {
    // Determine exchange suffix for EODHD API
    let tickerWithExchange = ticker;
    if (!ticker.includes('.')) {
      // No suffix - assume US stock
      tickerWithExchange = `${ticker}.US`;
    }
    // If ticker already has suffix (.SW, .US, etc.), use as-is
    
    // Fetch dividend history from EODHD
    const url = `https://eodhd.com/api/div/${tickerWithExchange}?api_token=${apiKey}&fmt=json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[DividendCalendar] EODHD API error for ${ticker}:`, response.status);
      return [];
    }

    const dividendHistory = await response.json();
    
    if (!Array.isArray(dividendHistory) || dividendHistory.length === 0) {
      console.log(`[DividendCalendar] No dividend history for ${ticker}`);
      return [];
    }

    // Sort by date descending to get most recent dividends first
    dividendHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Get last 4 dividends to determine frequency
    const recentDividends = dividendHistory.slice(0, 4);
    
    if (recentDividends.length < 2) {
      return [];
    }

    // Calculate average interval between dividends (in days)
    let totalInterval = 0;
    for (let i = 0; i < recentDividends.length - 1; i++) {
      const date1 = new Date(recentDividends[i].date);
      const date2 = new Date(recentDividends[i + 1].date);
      const interval = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
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
    const lastDate = new Date(lastDividend.date);
    const lastAmount = parseFloat(lastDividend.value);
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
          currency: lastDividend.currency || "USD"
        });
      }
      
      if (nextDate > oneYearFromNow) break;
    }

    console.log(`[DividendCalendar] ${ticker}: Found ${upcomingDividends.length} estimated dividends (${frequency})`);
    return upcomingDividends;
  } catch (error) {
    console.error(`[DividendCalendar] Failed to fetch dividends for ${ticker}:`, error);
    return [];
  }
}

/**
 * Fetch upcoming dividends for all tickers
 * @param from Start date (YYYY-MM-DD) - not used, kept for compatibility
 * @param to End date (YYYY-MM-DD) - not used, kept for compatibility
 * @returns Array of dividend events
 */
export async function fetchUpcomingDividends(from: string, to: string): Promise<DividendEvent[]> {
  // This function is kept for backward compatibility but not used
  // Individual ticker fetching is done in getPortfolioDividends
  return [];
}

/**
 * Get upcoming dividends for specific tickers in a portfolio
 * @param tickers Array of stock tickers
 * @param daysAhead Number of days to look ahead (default: 365 for next 12 months)
 * @returns Array of dividend events for the specified tickers
 */
export async function getPortfolioDividends(tickers: string[], daysAhead: number = 365): Promise<DividendEvent[]> {
  console.log(`[DividendCalendar] Fetching dividends for ${tickers.length} tickers`);
  
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
 * @param portfolioId Portfolio ID to check
 * @param notificationDays How many days ahead to notify (default: 3)
 * @returns Array of dividend events requiring notification
 */
export async function checkDividendNotifications(portfolioId: number, notificationDays: number = 3): Promise<DividendEvent[]> {
  const { getSavedPortfolioById } = await import("./db");
  
  // Get portfolio (we need user ID, so this is a placeholder - actual implementation would need user context)
  // For now, we'll just return empty array
  // In real implementation, this would be called from a cron job with proper user context
  
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
