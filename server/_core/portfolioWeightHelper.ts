/**
 * Portfolio weighting logic with manual weight preservation:
 * - Manual weights (isManualWeight = 1) are NEVER changed automatically
 * - Only automatic weights (isManualWeight = 0) are redistributed
 * - When adding/updating: mark as manual, redistribute only automatic stocks
 * - When deleting: redistribute only automatic stocks to fill the gap
 */
export async function recalculateWeights(changedTicker?: string, isDelete: boolean = false) {
  const { getAllStocks, updateStock } = await import("../db");
  const allStocks = await getAllStocks();
  
  console.log(`[RecalculateWeights] Called with changedTicker=${changedTicker}, isDelete=${isDelete}, totalStocks=${allStocks.length}`);
  
  if (allStocks.length === 0) return;
  
  // Special case: If adding a new stock AND no manual weights exist, redistribute all equally
  if (changedTicker && !isDelete) {
    const changedStock = allStocks.find(s => s.ticker === changedTicker);
    if (changedStock) {
      const totalWeight = allStocks.reduce((sum, s) => sum + parseFloat(s.portfolioWeight || "0"), 0);
      const isNewStock = parseFloat(changedStock.portfolioWeight || "0") === 0 || totalWeight > 100;
      
      console.log(`[RecalculateWeights] Changed stock: ${changedTicker}, weight=${changedStock.portfolioWeight}, isManualWeight=${changedStock.isManualWeight}, totalWeight=${totalWeight}, isNewStock=${isNewStock}`);
      
      // Only redistribute all stocks if NO manual weights exist
      const hasManualWeights = allStocks.some(s => s.isManualWeight === 1);
      const manualStocksList = allStocks.filter(s => s.isManualWeight === 1).map(s => `${s.ticker}(${s.portfolioWeight}%)`);
      
      console.log(`[RecalculateWeights] hasManualWeights=${hasManualWeights}, manualStocks=[${manualStocksList.join(', ')}]`);
      
      if (isNewStock && !hasManualWeights) {
        // Redistribute all stocks equally to 100%
        const equalWeight = 100 / allStocks.length;
        console.log(`[RecalculateWeights] New stock detected (no manual weights), redistributing ${allStocks.length} stocks to ${equalWeight.toFixed(2)}% each`);
        for (const stock of allStocks) {
          await updateStock(stock.ticker, {
            portfolioWeight: equalWeight.toFixed(4),
            isManualWeight: 0,
          });
        }
        return;
      }
      // If manual weights exist, fall through to normal Add/Update logic below
    }
  }
  
  if (isDelete) {
    // Delete: redistribute only AUTOMATIC stocks equally to 100%
    const manualStocks = allStocks.filter(s => s.isManualWeight === 1);
    const autoStocks = allStocks.filter(s => s.isManualWeight === 0);
    
    if (autoStocks.length === 0) return; // All stocks are manual, can't redistribute
    
    // Calculate total manual weight
    const totalManualWeight = manualStocks.reduce((sum, s) => {
      return sum + parseFloat(s.portfolioWeight || "0");
    }, 0);
    
    // Distribute remaining weight equally among automatic stocks
    const remainingWeight = 100 - totalManualWeight;
    const equalWeight = remainingWeight / autoStocks.length;
    
    for (const stock of autoStocks) {
      await updateStock(stock.ticker, {
        portfolioWeight: equalWeight.toFixed(4),
      });
    }
  } else if (changedTicker) {
    // Add or Update: mark as manual, redistribute only OTHER automatic stocks
    const changedStock = allStocks.find(s => s.ticker === changedTicker);
    if (!changedStock) return;
    
    // Mark the changed stock as manual
    await updateStock(changedTicker, {
      isManualWeight: 1,
    });
    
    const changedWeight = parseFloat(changedStock.portfolioWeight || "0");
    
    // Get all manual stocks (including the one just changed)
    const manualStocks = allStocks.filter(s => 
      s.ticker === changedTicker || s.isManualWeight === 1
    );
    const autoStocks = allStocks.filter(s => 
      s.ticker !== changedTicker && s.isManualWeight === 0
    );
    
    if (autoStocks.length === 0) return; // All stocks are manual, can't redistribute
    
    // Calculate total manual weight
    const totalManualWeight = manualStocks.reduce((sum, s) => {
      const weight = s.ticker === changedTicker ? changedWeight : parseFloat(s.portfolioWeight || "0");
      return sum + weight;
    }, 0);
    
    // Distribute remaining weight equally among automatic stocks
    const remainingWeight = 100 - totalManualWeight;
    const equalWeight = remainingWeight / autoStocks.length;
    
    for (const stock of autoStocks) {
      await updateStock(stock.ticker, {
        portfolioWeight: equalWeight.toFixed(4),
      });
    }
  }
}
