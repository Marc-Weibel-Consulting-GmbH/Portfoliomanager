import cron from 'node-cron';

const FMP_API_KEY = 'csYfpLrjCs1Z8iLLERQAfxFoisyY14Fr';
const FMP_API_URL = 'https://financialmodelingprep.com/api/v3';

interface PEGRatioData {
  symbol: string;
  pegRatio: number;
}

async function fetchPEGRatio(ticker: string): Promise<number | null> {
  try {
    // Remove exchange suffix (e.g., NVDA:US -> NVDA)
    const cleanTicker = ticker.split(':')[0];
    
    const response = await fetch(
      `${FMP_API_URL}/enterprise-values/${cleanTicker}?apikey=${FMP_API_KEY}`
    );
    
    if (!response.ok) {
      console.log(`[PEG Ratio Updater] Failed to fetch for ${cleanTicker}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (Array.isArray(data) && data.length > 0) {
      const pegRatio = data[0].pegRatio;
      if (pegRatio && typeof pegRatio === 'number') {
        return pegRatio;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`[PEG Ratio Updater] Error fetching PEG ratio for ${ticker}:`, error);
    return null;
  }
}

export async function initializePEGRatioUpdater() {
  console.log('[PEG Ratio Updater] Initialized. First update will run in 1 hour.');
  console.log('[PEG Ratio Updater] Cron schedule: Every 24 hours at 2 AM');

  // Run every 24 hours at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('[PEG Ratio Updater] Starting update...');
    
    try {
      const { getAllStocks, updateStock } = await import('./db');
      const stocks = await getAllStocks();
      
      let updatedCount = 0;
      
      for (const stock of stocks) {
        const pegRatio = await fetchPEGRatio(stock.ticker);
        
        if (pegRatio !== null) {
          await updateStock(stock.ticker, { pegRatio: pegRatio.toString() });
          updatedCount++;
          console.log(`[PEG Ratio Updater] Updated ${stock.ticker}: ${pegRatio}`);
        }
        
        // Rate limiting - wait 200ms between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      console.log(`[PEG Ratio Updater] Update completed. Updated ${updatedCount}/${stocks.length} stocks`);
    } catch (error) {
      console.error('[PEG Ratio Updater] Error during update:', error);
    }
  });
}
