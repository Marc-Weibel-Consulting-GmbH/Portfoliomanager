/**
 * Manual YTD Update Script for 2026
 * Updates ytdStartPrice to Dec 31, 2025 close prices
 */

import { getAllStocks, updateStock } from './server/db';

async function fetchDec31ClosePrice(ticker: string): Promise<number | null> {
  try {
    const apiKey = process.env.EODHD_API_KEY;
    if (!apiKey) {
      console.warn('[YTD Update] EODHD_API_KEY not set');
      return null;
    }

    // Fetch last week of December 2025 to ensure we get the last trading day
    const fromDate = '2025-12-24';
    const toDate = '2025-12-31';
    
    const url = `https://eodhd.com/api/eod/${ticker}?api_token=${apiKey}&from=${fromDate}&to=${toDate}&fmt=json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`[YTD Update] Failed to fetch ${ticker}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`[YTD Update] No data for ${ticker}`);
      return null;
    }
    
    // Get last trading day (should be Dec 31 or closest trading day before)
    const lastDay = data[data.length - 1];
    console.log(`[YTD Update] ${ticker}: Last trading day ${lastDay.date}, close: ${lastDay.close}`);
    return lastDay.close || null;
  } catch (error) {
    console.error(`[YTD Update] Error fetching ${ticker}:`, error);
    return null;
  }
}

async function updateYTDStartPrices() {
  console.log('[YTD Update] Starting YTD update for 2026...');
  console.log('[YTD Update] Fetching Dec 31, 2025 close prices');
  
  const stocks = await getAllStocks();
  console.log(`[YTD Update] Processing ${stocks.length} stocks`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const stock of stocks) {
    if (!stock.ticker) {
      console.warn('[YTD Update] Skipping stock without ticker');
      continue;
    }
    
    const closePrice = await fetchDec31ClosePrice(stock.ticker);
    
    if (closePrice && closePrice > 0) {
      // Calculate new YTD performance
      const currentPrice = parseFloat(stock.currentPrice || '0');
      let ytdPerformance = 0;
      if (currentPrice > 0 && closePrice > 0) {
        ytdPerformance = ((currentPrice - closePrice) / closePrice) * 100;
      }
      
      await updateStock(stock.ticker, {
        ytdStartPrice: closePrice.toFixed(2),
        ytdPerformance: ytdPerformance.toFixed(2),
      });
      
      console.log(`✓ ${stock.ticker}: ytdStartPrice=${closePrice.toFixed(2)}, currentPrice=${currentPrice.toFixed(2)}, YTD=${ytdPerformance.toFixed(2)}%`);
      successCount++;
    } else {
      console.warn(`✗ ${stock.ticker}: Failed to fetch close price`);
      failCount++;
    }
    
    // Rate limiting: Wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n[YTD Update] Completed: ${successCount} success, ${failCount} failed`);
}

updateYTDStartPrices().catch(console.error);
