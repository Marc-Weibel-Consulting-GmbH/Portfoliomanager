import { getDb } from "./db";
import { historicalPrices } from "../drizzle/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

interface QuarterlyEarnings {
  date: string;
  eps: number;
}

interface HistoricalPEPoint {
  date: string;
  pe: number;
  price: number;
  eps: number;
}

/**
 * Fetch quarterly earnings from EODHD API
 */
async function fetchQuarterlyEarnings(ticker: string): Promise<QuarterlyEarnings[]> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    throw new Error("EODHD_API_KEY not configured");
  }

  // EODHD uses format: TICKER.EXCHANGE (e.g., AAPL.US, NESN.SW)
  const url = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${apiKey}&fmt=json`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`EODHD API error: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Extract quarterly earnings from Earnings -> History
  const earnings: QuarterlyEarnings[] = [];
  
  if (data.Earnings?.History) {
    // Quarterly data is in the History object
    for (const [date, quarterData] of Object.entries(data.Earnings.History)) {
      const epsValue = (quarterData as any).epsActual;
      if (epsValue && !isNaN(parseFloat(epsValue))) {
        earnings.push({
          date,
          eps: parseFloat(epsValue),
        });
      }
    }
  }

  // Sort by date (oldest first)
  earnings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  return earnings;
}

/**
 * Get historical price for a specific date (or closest available date)
 */
async function getHistoricalPrice(ticker: string, targetDate: Date): Promise<number | null> {
  const dateStr = targetDate.toISOString().split('T')[0];
  
  // Try to find price within ±7 days of target date
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date(targetDate);
  endDate.setDate(endDate.getDate() + 7);

  const db = await getDb();
  if (!db) return null;
  
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  
  const prices = await db
    .select()
    .from(historicalPrices)
    .where(
      and(
        eq(historicalPrices.ticker, ticker),
        sql`${historicalPrices.date} >= ${startDateStr}`,
        sql`${historicalPrices.date} <= ${endDateStr}`
      )
    )
    .orderBy(historicalPrices.date);

  if (prices.length === 0) {
    return null;
  }

  // Find closest date
  let closestPrice = prices[0];
  let minDiff = Math.abs(new Date(prices[0].date).getTime() - targetDate.getTime());

  for (const price of prices) {
    const diff = Math.abs(new Date(price.date).getTime() - targetDate.getTime());
    if (diff < minDiff) {
      minDiff = diff;
      closestPrice = price;
    }
  }

  return parseFloat(closestPrice.close);
}

/**
 * Calculate historical P/E ratios
 */
export async function calculateHistoricalPE(
  ticker: string,
  years: number = 5
): Promise<{
  data: HistoricalPEPoint[];
  median: number;
  current: number | null;
}> {
  // Fetch quarterly earnings from EODHD
  const earnings = await fetchQuarterlyEarnings(ticker);
  
  // Filter to last N years
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - years);
  
  const recentEarnings = earnings.filter(e => new Date(e.date) >= cutoffDate);
  
  // Calculate P/E for each quarter using TTM (Trailing Twelve Months) EPS
  const peData: HistoricalPEPoint[] = [];
  
  for (let i = 3; i < recentEarnings.length; i++) {
    const earning = recentEarnings[i];
    const quarterEndDate = new Date(earning.date);
    const price = await getHistoricalPrice(ticker, quarterEndDate);
    
    if (price) {
      // Calculate TTM EPS (sum of last 4 quarters)
      const ttmEps = recentEarnings.slice(i - 3, i + 1).reduce((sum, e) => sum + e.eps, 0);
      
      if (ttmEps > 0) {
        const pe = price / ttmEps;
        
        // Filter out unrealistic P/E values (< 0 or > 500)
        if (pe > 0 && pe < 500) {
          peData.push({
            date: earning.date,
            pe,
            price,
            eps: ttmEps,
          });
        }
      }
    }
  }

  // Calculate median P/E
  const peValues = peData.map(d => d.pe).sort((a, b) => a - b);
  const median = peValues.length > 0
    ? peValues[Math.floor(peValues.length / 2)]
    : 0;

  // Get current P/E (most recent)
  const current = peData.length > 0 ? peData[peData.length - 1].pe : null;

  return {
    data: peData,
    median,
    current,
  };
}
