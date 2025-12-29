import { protectedProcedure, router } from "../_core/trpc";

// Helper to get YTD start date (January 1st of current year)
function getYTDStartDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

export const dashboardRouter = router({
  // Get aggregated metrics across all live portfolios
  getAggregatedMetrics: protectedProcedure.query(async ({ ctx }) => {
    const { getSavedPortfolios, getPortfolioTransactions, getStockByTicker, getDb } = await import("../db");
    const portfolios = await getSavedPortfolios(ctx.user.id);
    
    const livePortfolios = portfolios.filter(p => p.isLive === 1 && p.liveStartDate);
    
    if (livePortfolios.length === 0) {
      return {
        totalValue: 0,
        totalPerformance: 0,
        totalPerformancePercent: 0,
        totalDividends: 0,
        portfolioCount: portfolios.length,
        livePortfolioCount: 0,
      };
    }
    
    const db = await getDb();
    if (!db) {
      return {
        totalValue: 0,
        totalPerformance: 0,
        totalPerformancePercent: 0,
        totalDividends: 0,
        portfolioCount: portfolios.length,
        livePortfolioCount: livePortfolios.length,
      };
    }
    
    const { getStockCurrency, convertToCHF, getHistoricalPrice } = await import("../fxHelper");
    const ytdStartDate = getYTDStartDate();
    const today = new Date().toISOString().split('T')[0];
    
    let totalValueCHF = 0;
    let totalValueYTDStartCHF = 0;  // Value at start of year
    let totalDividendsCHF = 0;
    
    // Calculate metrics for each live portfolio
    for (const portfolio of livePortfolios) {
      const transactions = await getPortfolioTransactions(portfolio.id);
      
      // Calculate dividend income
      let dividendIncome = 0;
      for (const tx of transactions) {
        if (tx.transactionType === 'dividend') {
          dividendIncome += parseFloat(tx.totalAmountCHF || '0');
        }
      }
      totalDividendsCHF += dividendIncome;
      
      // Calculate current holdings
      const holdingsMap = new Map<string, { shares: number; totalInvestedCHF: number }>();
      
      for (const tx of transactions) {
        if (tx.transactionType === 'buy' || tx.transactionType === 'sell') {
          const ticker = tx.ticker;
          if (!ticker) continue;
          
          const existing = holdingsMap.get(ticker) || { shares: 0, totalInvestedCHF: 0 };
          
          if (tx.transactionType === 'buy') {
            existing.shares += parseFloat(tx.shares || '0');
            existing.totalInvestedCHF += parseFloat(tx.totalAmountCHF || '0');
          } else if (tx.transactionType === 'sell') {
            const sellShares = parseFloat(tx.shares || '0');
            const avgCost = existing.shares > 0 ? existing.totalInvestedCHF / existing.shares : 0;
            existing.shares -= sellShares;
            existing.totalInvestedCHF -= sellShares * avgCost;
          }
          
          holdingsMap.set(ticker, existing);
        }
      }
      
      // Calculate current value and YTD start value
      let portfolioValueCHF = 0;
      let portfolioValueYTDStartCHF = 0;
      
      for (const [ticker, holding] of Array.from(holdingsMap.entries())) {
        if (holding.shares <= 0) continue;
        
        const stock = await getStockByTicker(ticker);
        if (!stock) continue;
        
        const currency = await getStockCurrency(stock.ticker);
        const currentPrice = parseFloat(stock.currentPrice || '0');
        
        // Get YTD start price from historical data
        const ytdStartPrice = await getHistoricalPrice(ticker, ytdStartDate) || currentPrice;
        
        // Convert to CHF
        const currentPriceCHF = await convertToCHF(currentPrice, currency, today);
        const ytdStartPriceCHF = await convertToCHF(ytdStartPrice, currency, ytdStartDate);
        
        portfolioValueCHF += holding.shares * currentPriceCHF;
        portfolioValueYTDStartCHF += holding.shares * ytdStartPriceCHF;
      }
      
      totalValueCHF += portfolioValueCHF;
      totalValueYTDStartCHF += portfolioValueYTDStartCHF;
    }
    
    // Calculate YTD performance
    const totalPerformanceCHF = totalValueCHF - totalValueYTDStartCHF;
    const totalPerformancePercent = totalValueYTDStartCHF > 0 
      ? (totalPerformanceCHF / totalValueYTDStartCHF) * 100 
      : 0;
    
    return {
      totalValue: totalValueCHF,
      totalPerformance: totalPerformanceCHF,
      totalPerformancePercent: totalPerformancePercent,
      totalDividends: totalDividendsCHF,
      portfolioCount: portfolios.length,
      livePortfolioCount: livePortfolios.length,
    };
  }),
  
  // Get all portfolios with YTD performance
  getTopPortfolios: protectedProcedure.query(async ({ ctx }) => {
    const { getSavedPortfolios } = await import("../db");
    const { batchGetPortfolioTransactions, batchGetStocks, batchGetHistoricalPrices, getCachedFxRate, setCachedFxRate } = await import("../db-optimized");
    const { convertToCHF } = await import("../fxHelper");
    
    const portfolios = await getSavedPortfolios(ctx.user.id);
    const livePortfolios = portfolios.filter(p => p.isLive === 1 && p.liveStartDate);
    
    if (livePortfolios.length === 0) {
      return [];
    }
    
    const ytdStartDate = getYTDStartDate();
    const today = new Date().toISOString().split('T')[0];
    
    // Batch load all data
    const portfolioIds = livePortfolios.map(p => p.id);
    const transactionsByPortfolio = await batchGetPortfolioTransactions(portfolioIds);
    
    // Collect all unique tickers
    const allTickers = new Set<string>();
    for (const transactions of Array.from(transactionsByPortfolio.values())) {
      transactions.forEach(tx => {
        if (tx.ticker) allTickers.add(tx.ticker);
      });
    }
    
    if (allTickers.size === 0) {
      return [];
    }
    
    // Batch load stocks and historical prices
    const stocksMap = await batchGetStocks(Array.from(allTickers));
    const ytdPricesMap = await batchGetHistoricalPrices(Array.from(allTickers), ytdStartDate);
    
    // Pre-warm FX cache
    const uniqueCurrencies = new Set<string>();
    for (const stock of Array.from(stocksMap.values())) {
      if (stock.currency) uniqueCurrencies.add(stock.currency);
    }
    
    const fxPromises = [];
    for (const currency of Array.from(uniqueCurrencies)) {
      if (currency !== 'CHF') {
        if (!getCachedFxRate(currency, today)) {
          fxPromises.push(
            convertToCHF(1, currency, today).then(rate => {
              setCachedFxRate(currency, today, rate);
              return rate;
            })
          );
        }
        if (!getCachedFxRate(currency, ytdStartDate)) {
          fxPromises.push(
            convertToCHF(1, currency, ytdStartDate).then(rate => {
              setCachedFxRate(currency, ytdStartDate, rate);
              return rate;
            })
          );
        }
      }
    }
    
    await Promise.all(fxPromises);
    
    // Calculate metrics for each portfolio
    const portfolioMetrics = [];
    
    for (const portfolio of livePortfolios) {
      const transactions = transactionsByPortfolio.get(portfolio.id) || [];
      
      // Calculate current holdings
      const holdingsMap = new Map<string, { shares: number; totalInvestedCHF: number }>();
      
      for (const tx of transactions) {
        if (tx.transactionType === 'buy' || tx.transactionType === 'sell') {
          const ticker = tx.ticker;
          if (!ticker) continue;
          
          const existing = holdingsMap.get(ticker) || { shares: 0, totalInvestedCHF: 0 };
          
          if (tx.transactionType === 'buy') {
            existing.shares += parseFloat(tx.shares || '0');
            existing.totalInvestedCHF += parseFloat(tx.totalAmountCHF || '0');
          } else if (tx.transactionType === 'sell') {
            const sellShares = parseFloat(tx.shares || '0');
            const avgCost = existing.shares > 0 ? existing.totalInvestedCHF / existing.shares : 0;
            existing.shares -= sellShares;
            existing.totalInvestedCHF -= sellShares * avgCost;
          }
          
          holdingsMap.set(ticker, existing);
        }
      }
      
      // Calculate current value and YTD start value
      let portfolioValueCHF = 0;
      let portfolioValueYTDStartCHF = 0;
      
      for (const [ticker, holding] of Array.from(holdingsMap.entries())) {
        if (holding.shares <= 0) continue;
        
        const stock = stocksMap.get(ticker);
        if (!stock) continue;
        
        const currency = stock.currency || 'CHF';
        const currentPrice = parseFloat(stock.currentPrice || '0');
        
        // Get YTD start price from pre-loaded map
        const ytdStartPrice = ytdPricesMap.get(ticker) || currentPrice;
        
        // Convert to CHF (using cached FX rates)
        const currentPriceCHF = await convertToCHF(currentPrice, currency, today);
        const ytdStartPriceCHF = await convertToCHF(ytdStartPrice, currency, ytdStartDate);
        
        portfolioValueCHF += holding.shares * currentPriceCHF;
        portfolioValueYTDStartCHF += holding.shares * ytdStartPriceCHF;
      }
      
      // Calculate YTD performance
      const performanceCHF = portfolioValueCHF - portfolioValueYTDStartCHF;
      const performancePercent = portfolioValueYTDStartCHF > 0 
        ? (performanceCHF / portfolioValueYTDStartCHF) * 100 
        : 0;
      
      portfolioMetrics.push({
        id: portfolio.id,
        name: portfolio.name,
        description: portfolio.description,
        value: portfolioValueCHF,
        performance: performancePercent,
        performanceCHF: performanceCHF,
      });
    }
    
    // Sort by performance and return all portfolios
    portfolioMetrics.sort((a, b) => b.performance - a.performance);
    return portfolioMetrics;
  }),
});
