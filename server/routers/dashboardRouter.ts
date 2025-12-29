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
    const { getSavedPortfolios, getPortfolioTransactions, getStockByTicker, getDb } = await import("../db");
    const portfolios = await getSavedPortfolios(ctx.user.id);
    
    const livePortfolios = portfolios.filter(p => p.isLive === 1 && p.liveStartDate);
    
    if (livePortfolios.length === 0) {
      return [];
    }
    
    const db = await getDb();
    if (!db) return [];
    
    const { getStockCurrency, convertToCHF, getHistoricalPrice } = await import("../fxHelper");
    const ytdStartDate = getYTDStartDate();
    const today = new Date().toISOString().split('T')[0];
    
    const portfolioMetrics = [];
    
    // Calculate metrics for each live portfolio
    for (const portfolio of livePortfolios) {
      const transactions = await getPortfolioTransactions(portfolio.id);
      
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
