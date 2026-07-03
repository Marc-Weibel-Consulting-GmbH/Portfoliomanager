import { getAllStocks, updateStock, getDb } from "./db";
import { fetchEODHDFundamentals } from "./_core/eodhdApi";

// Estimated earnings growth rates for stocks (annual %)
// These are typical growth rates for different sectors
const GROWTH_RATE_ESTIMATES: Record<string, number> = {
  // Tech/AI stocks - high growth
  'NVDA': 25,
  'META': 20,
  'MSFT': 15,
  'GOOGL': 12,
  'AMZN': 18,
  'AMD': 20,
  'PLTR': 25,
  'CRWD': 25,
  'SNPS': 12,
  'ARM': 20,
  'MU': 15,
  'MRVL': 15,
  'ANET': 18,
  'ALAB': 30,
  'MDB': 20,
  'NET': 25,
  'SNOW': 20,
  'PATH': 30,
  'CIFR': 40,
  'IREN': 35,
  'AXON': 15,
  'TRMB': 12,
  'APP': 20,
  'BE': 50,
  
  // Growth stocks
  'TSLA': 22,
  'MELI': 20,
  'SOFI': 30,
  'NTLA': 35,
  'TEM': 40,
  
  // Dividend/Mature stocks - lower growth
  'JNJ': 8,
  'V': 12,
  'KNIN.SW': 5,
  'SGKN.SW': 6,
  'NEE': 10,
  'NESN.SW': 7,
  'SU.PA': 8,
  'SQN.SW': 8,
  'STMN.SW': 12,
  'BRK-B': 10,
  'LISN.SW': 5,
  'SCMN.SW': 5,
  'GALD.SW': 8,
  'MONC.MI': 10,
  'FHZN.SW': 5,
  'ZURN.SW': 6,
  'SREN.SW': 5,
  'GALE.SW': 6,
  'MC.PA': 8,
  'SLHN.SW': 5,
  'HOLN.SW': 6,
  'BKW.SW': 5,
  'CMBN.SW': 8,
  'DELL': 10,
  'RMD': 12,
  'CRWV': 50,
  'HIMS': 25,
  'VST': 12,
  'REMX': 15,
  'CSL': 10,
  'MOH': 10,
  'KLAC': 10,
  'EOSE': 40,
  'NOVOB.CO': 15,
  'TSM': 15,
  'AVGO': 15,
};

// Fetch PEG ratio from EODHD (fallback: calculate from P/E and estimated growth)
async function fetchAndCalculatePEG(ticker: string): Promise<string | null> {
  try {
    const fundamentals = await fetchEODHDFundamentals(ticker);

    // Prefer the PEG ratio EODHD provides directly (Highlights.PEGRatio)
    if (fundamentals.pegRatio !== null && fundamentals.pegRatio > 0) {
      return fundamentals.pegRatio.toFixed(2);
    }

    // Fallback: calculate PEG = P/E / estimated growth rate
    const peRatio = fundamentals.peRatio;
    if (!peRatio || peRatio <= 0) {
      console.warn(`[PEG Updater] No valid P/E ratio for ${ticker}`);
      return null;
    }

    // Get estimated growth rate for this ticker
    const growthRate = GROWTH_RATE_ESTIMATES[ticker] || 15; // Default 15% if not specified

    const pegRatio = peRatio / growthRate;

    return pegRatio.toFixed(2);
  } catch (error) {
    console.error(`[PEG Updater] Error fetching ratios for ${ticker}:`, error);
    return null;
  }
}

// Update PEG ratios for all stocks
export async function updatePEGRatios() {
  console.log("[PEG Updater] Starting PEG ratio update...");
  
  try {
    const stocks = await getAllStocks();
    let updatedCount = 0;
    let failedCount = 0;
    
    for (const stock of stocks) {
      const pegRatio = await fetchAndCalculatePEG(stock.ticker);
      
      if (pegRatio) {
        await updateStock(stock.ticker, { pegRatio });
        updatedCount++;
        console.log(`[PEG Updater] Updated PEG ratio for ${stock.ticker}: ${pegRatio}`);
      } else {
        failedCount++;
        console.warn(`[PEG Updater] Failed to update PEG ratio for ${stock.ticker}`);
      }
      
      // Rate limiting: wait 100ms between requests to avoid API rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`[PEG Updater] PEG ratio update completed. Updated: ${updatedCount}, Failed: ${failedCount}`);
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

