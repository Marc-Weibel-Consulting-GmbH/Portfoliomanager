import { getAllStocks, updateStock, getDb } from "./db";

const FMP_API_KEY = process.env.FMP_API_KEY || "csYfpLrjCs1Z8iLLERQAfxFoisyY14Fr";
const FMP_API_URL = "https://financialmodelingprep.com/api/v3";

// Fetch PEG ratio from FMP API
async function fetchPEGRatio(ticker: string): Promise<string | null> {
  try {
    // Remove exchange suffix if present
    const cleanTicker = ticker.split(":")[0];
    
    // FMP API endpoint for company ratios
    const response = await fetch(
      `${FMP_API_URL}/ratios/${cleanTicker}?apikey=${FMP_API_KEY}`
    );
    
    if (!response.ok) {
      console.warn(`[PEG Updater] Failed to fetch PEG for ${cleanTicker}: ${response.statusText}`);
      return null;
    }
    
    const data = await response.json() as any;
    
    // FMP returns an array of ratios, get the most recent one
    if (Array.isArray(data) && data.length > 0) {
      const latestRatio = data[0];
      
      // PEG ratio might be in different fields depending on the API response
      if (latestRatio.pegRatio) {
        return latestRatio.pegRatio.toFixed(2);
      }
      
      // Alternative: calculate PEG from P/E and growth rate if available
      if (latestRatio.peRatio && latestRatio.earningsYield) {
        // PEG = P/E ratio / earnings growth rate
        // This is a simplified calculation
        const pegRatio = latestRatio.peRatio / (latestRatio.earningsYield * 100);
        return pegRatio.toFixed(2);
      }
    }
    
    return null;
  } catch (error) {
    console.error(`[PEG Updater] Error fetching PEG for ${ticker}:`, error);
    return null;
  }
}

// Update PEG ratios for all stocks
export async function updatePEGRatios() {
  console.log("[PEG Updater] Starting PEG ratio update...");
  
  try {
    const stocks = await getAllStocks();
    let updatedCount = 0;
    
    for (const stock of stocks) {
      const pegRatio = await fetchPEGRatio(stock.ticker);
      
      if (pegRatio) {
        await updateStock(stock.ticker, { pegRatio });
        updatedCount++;
        console.log(`[PEG Updater] Updated PEG ratio for ${stock.ticker}: ${pegRatio}`);
      }
      
      // Rate limiting: wait 300ms between requests to avoid API rate limits
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(`[PEG Updater] PEG ratio update completed. Updated ${updatedCount} stocks.`);
  } catch (error) {
    console.error("[PEG Updater] Error updating PEG ratios:", error);
  }
}

// Schedule PEG ratio updates to run daily at 2 AM
export function initializePEGUpdater() {
  console.log("[PEG Updater] Initialized. First update will run at 2 AM.");
  
  // Calculate time until next 2 AM
  const now = new Date();
  const nextUpdate = new Date();
  nextUpdate.setHours(2, 0, 0, 0);
  
  // If it's already past 2 AM, schedule for tomorrow
  if (now.getTime() > nextUpdate.getTime()) {
    nextUpdate.setDate(nextUpdate.getDate() + 1);
  }
  
  const timeUntilNextUpdate = nextUpdate.getTime() - now.getTime();
  
  console.log(`[PEG Updater] Next update scheduled in ${Math.round(timeUntilNextUpdate / 1000 / 60)} minutes`);
  
  // Schedule first update
  setTimeout(() => {
    updatePEGRatios();
    
    // Then schedule daily updates
    setInterval(() => {
      updatePEGRatios();
    }, 24 * 60 * 60 * 1000); // Every 24 hours
  }, timeUntilNextUpdate);
}

// Also provide a manual trigger for testing
export async function manualUpdatePEGRatios() {
  console.log("[PEG Updater] Manual update triggered");
  await updatePEGRatios();
}

