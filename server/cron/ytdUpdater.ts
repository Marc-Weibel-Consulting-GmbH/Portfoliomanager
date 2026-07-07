/**
 * YTD Updater Cron Job
 * Runs on January 1st at 00:00 to set ytdStartPrice to December 31st close prices
 */

import cron from 'node-cron';
import { getAllStocks, updateStock } from '../db';
import { ENV } from "../_core/env";
import { toEodhdSymbol } from "../lib/eodhdSymbol";

/**
 * Fetch December 31st close price for a ticker from EODHD API
 */
async function fetchDec31ClosePrice(ticker: string, year: number): Promise<number | null> {
  try {
    const apiKey = ENV.eodhdApiKey;
    if (!apiKey) {
      console.warn('[YTD Updater] EODHD_API_KEY not set');
      return null;
    }

    // Fetch last week of December to ensure we get the last trading day
    const fromDate = `${year}-12-24`;
    const toDate = `${year}-12-31`;
    
    const url = `https://eodhd.com/api/eod/${toEodhdSymbol(ticker)}?api_token=${apiKey}&from=${fromDate}&to=${toDate}&fmt=json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`[YTD Updater] Failed to fetch ${ticker}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`[YTD Updater] No data for ${ticker}`);
      return null;
    }
    
    // Get last trading day (should be Dec 31 or closest trading day before)
    const lastDay = data[data.length - 1];
    // R-30: adjusted_close als YTD-Baseline (split-/spin-off-bereinigt) —
    // der rohe Dez-31-Close machte z. B. Holcim nach dem Amrize-Spin-off
    // zu einem ≈ −45-%-«YTD»-Ausreisser. Fallback close, falls die API
    // keinen adjustierten Kurs liefert.
    // TODO(R-11/R-30): Corporate Actions MITTEN im Jahr werden damit nicht
    // abgedeckt (currentPrice vs. fixe Jahresanfangs-Baseline) — braucht
    // Ratio-Sprung-Erkennung im täglichen Updater oder eine Splits-Tabelle.
    return lastDay.adjusted_close ?? lastDay.close ?? null;
  } catch (error) {
    console.error(`[YTD Updater] Error fetching ${ticker}:`, error);
    return null;
  }
}

/**
 * Update ytdStartPrice for all stocks
 */
async function updateYTDStartPrices() {
  console.log('[YTD Updater] Starting YTD update...');
  
  const lastYear = new Date().getFullYear() - 1;
  console.log(`[YTD Updater] Fetching Dec 31, ${lastYear} close prices`);
  
  const stocks = await getAllStocks();
  console.log(`[YTD Updater] Processing ${stocks.length} stocks`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const stock of stocks) {
    if (!stock.ticker) {
      console.warn('[YTD Updater] Skipping stock without ticker');
      continue;
    }
    
    const closePrice = await fetchDec31ClosePrice(stock.ticker, lastYear);
    
    if (closePrice && closePrice > 0) {
      await updateStock(stock.ticker, {
        ytdStartPrice: closePrice.toFixed(2),
        ytdPerformance: "0.00", // Reset to 0% at start of year
      });
      
      console.log(`[YTD Updater] ${stock.ticker}: Set ytdStartPrice to ${closePrice.toFixed(2)}`);
      successCount++;
    } else {
      console.warn(`[YTD Updater] ${stock.ticker}: Failed to fetch close price`);
      failCount++;
    }
    
    // Rate limiting: Wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`[YTD Updater] Completed: ${successCount} success, ${failCount} failed`);
}

/**
 * Manual trigger function for testing
 */
export async function manualYTDUpdate() {
  console.log('[YTD Updater] Manual trigger initiated');
  await updateYTDStartPrices();
}

/**
 * Initialize cron job
 * Runs on January 1st at 00:00 (midnight)
 */
export function initYTDUpdater() {
  // Cron format: second minute hour day month dayOfWeek
  // 0 0 0 1 1 * = January 1st at 00:00
  const cronSchedule = '0 0 0 1 1 *';
  
  cron.schedule(cronSchedule, async () => {
    console.log('[YTD Updater] Cron job triggered');
    await updateYTDStartPrices();
  });
  
  console.log('[YTD Updater] Cron job initialized (runs on January 1st at 00:00)');
}
