import { getDb } from "./db";
import { historicalPrices } from "../drizzle/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { getFiscalPEHistory, calculateMedianPE, type FiscalPERatio } from "./_core/fiscalApi";

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
 * Calculate TTM P/E ratios (fallback method)
 */
async function calculateTTMPE(
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

/**
 * Calculate historical P/E ratios using hybrid approach:
 * 1. Try Fiscal.ai Forward P/E (professional data)
 * 2. Fallback to TTM P/E calculation if Fiscal.ai unavailable
 */
export async function calculateHistoricalPE(
  ticker: string,
  years: number = 5
): Promise<{
  data: HistoricalPEPoint[];
  median: number;
  current: number | null;
  source: 'fiscal' | 'ttm';
}> {
  // Get current P/E from database (matches table display)
  const db = await getDb();
  let currentPEFromDB: number | null = null;
  
  if (db) {
    const { stocks } = await import("../drizzle/schema");
    const stockData = await db.select().from(stocks).where(eq(stocks.ticker, ticker)).limit(1);
    console.log(`[P/E Chart] DB query result for ${ticker}:`, stockData.length > 0 ? { peRatio: stockData[0].peRatio, ticker: stockData[0].ticker } : 'No data');
    if (stockData.length > 0 && stockData[0].peRatio) {
      currentPEFromDB = parseFloat(stockData[0].peRatio);
      console.log(`[P/E Chart] Current P/E from DB for ${ticker}: ${currentPEFromDB}`);
      
      // Write to debug file
      const fs = await import('fs');
      fs.writeFileSync('/home/ubuntu/pe-debug.json', JSON.stringify({
        ticker,
        peRatio: stockData[0].peRatio,
        parsed: currentPEFromDB,
        timestamp: new Date().toISOString()
      }, null, 2));
    } else {
      console.log(`[P/E Chart] No P/E found in DB for ${ticker}`);
    }
  }
  
  // Remove exchange suffix for Fiscal.ai (they use base tickers)
  const baseTicker = ticker.split('.')[0];
  
  // Try Fiscal.ai first (Forward P/E)
  console.log(`[P/E Chart] Attempting Fiscal.ai for ${baseTicker}...`);
  const fiscalData = await getFiscalPEHistory(baseTicker);
  
  if (fiscalData && fiscalData.length > 0) {
    console.log(`[P/E Chart] Using Fiscal.ai data for ${baseTicker} (${fiscalData.length} points)`);
    
    // Filter to last N years
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - years);
    
    const recentData = fiscalData.filter(d => new Date(d.date) >= cutoffDate);
    
    // Convert Fiscal.ai format to our HistoricalPEPoint format
    const peData: HistoricalPEPoint[] = recentData.map(d => ({
      date: d.date,
      pe: d.ratio,
      price: 0, // Not provided by Fiscal.ai
      eps: 0,   // Not provided by Fiscal.ai
    }));
    
    const median = calculateMedianPE(recentData);
    // Use database P/E as current value (matches table)
    const current = currentPEFromDB !== null ? currentPEFromDB : (peData.length > 0 ? peData[peData.length - 1].pe : null);
    
    return {
      data: peData,
      median,
      current,
      source: 'fiscal',
    };
  }
  
  // Fallback to TTM calculation
  console.log(`[P/E Chart] Fiscal.ai not available for ${baseTicker}, using TTM fallback`);
  const ttmResult = await calculateTTMPE(ticker, years);
  
  // Override current P/E with database value if available
  if (currentPEFromDB !== null) {
    ttmResult.current = currentPEFromDB;
  }
  
  return {
    ...ttmResult,
    source: 'ttm',
  };
}
