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
 * Fetch upcoming dividends from Finnhub Calendar API
 * @param from Start date (YYYY-MM-DD)
 * @param to End date (YYYY-MM-DD)
 * @returns Array of dividend events
 */
export async function fetchUpcomingDividends(from: string, to: string): Promise<DividendEvent[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    console.warn("[DividendCalendar] FINNHUB_API_KEY not configured");
    return [];
  }

  try {
    const url = `https://finnhub.io/api/v1/calendar/dividend?from=${from}&to=${to}&token=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("[DividendCalendar] Finnhub API error:", response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    
    // Transform Finnhub response to our format
    const dividends: DividendEvent[] = [];
    
    if (data.dividendCalendar && Array.isArray(data.dividendCalendar)) {
      data.dividendCalendar.forEach((event: any) => {
        if (event.symbol && event.date && event.amount) {
          dividends.push({
            ticker: event.symbol,
            exDividendDate: event.date,
            paymentDate: event.payDate || event.date,
            amount: parseFloat(event.amount),
            currency: event.currency || "USD"
          });
        }
      });
    }

    console.log(`[DividendCalendar] Found ${dividends.length} dividend events from ${from} to ${to}`);
    return dividends;
  } catch (error) {
    console.error("[DividendCalendar] Failed to fetch dividends:", error);
    return [];
  }
}

/**
 * Get upcoming dividends for specific tickers in a portfolio
 * @param tickers Array of stock tickers
 * @param daysAhead Number of days to look ahead (default: 30)
 * @returns Array of dividend events for the specified tickers
 */
export async function getPortfolioDividends(tickers: string[], daysAhead: number = 30): Promise<DividendEvent[]> {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + daysAhead);

  const from = today.toISOString().split('T')[0];
  const to = futureDate.toISOString().split('T')[0];

  const allDividends = await fetchUpcomingDividends(from, to);
  
  // Filter to only include portfolio tickers
  const tickerSet = new Set(tickers.map(t => t.toUpperCase()));
  const portfolioDividends = allDividends.filter(div => 
    tickerSet.has(div.ticker.toUpperCase())
  );

  console.log(`[DividendCalendar] Portfolio has ${portfolioDividends.length} upcoming dividends`);
  return portfolioDividends;
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
