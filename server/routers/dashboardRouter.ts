import { protectedProcedure, router } from "../_core/trpc";

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
    
    const { historicalPrices, realizedGains } = await import("../../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");
    const { getStockCurrency, convertToCHF } = await import("../fxHelper");
    
    let totalValueCHF = 0;
    let totalInvestedCHF = 0;
    let totalDividendsCHF = 0;
    
    // Calculate metrics for each live portfolio
    for (const portfolio of livePortfolios) {
      const transactions = await getPortfolioTransactions(portfolio.id);
      
      // Calculate total deposits and withdrawals
      let totalDeposits = 0;
      let totalWithdrawals = 0;
      let dividendIncome = 0;
      
      for (const tx of transactions) {
        if (tx.type === 'deposit') {
          totalDeposits += parseFloat(tx.totalCHF || '0');
        } else if (tx.type === 'withdrawal') {
          totalWithdrawals += parseFloat(tx.totalCHF || '0');
        } else if (tx.type === 'dividend') {
          dividendIncome += parseFloat(tx.totalCHF || '0');
        }
      }
      
      totalDividendsCHF += dividendIncome;
      
      // Calculate current holdings value
      const holdingsMap = new Map<string, { shares: number; totalInvestedCHF: number }>();
      
      for (const tx of transactions) {
        if (tx.type === 'buy' || tx.type === 'sell') {
          const ticker = tx.ticker;
          if (!ticker) continue;
          
          const existing = holdingsMap.get(ticker) || { shares: 0, totalInvestedCHF: 0 };
          
          if (tx.type === 'buy') {
            existing.shares += parseFloat(tx.shares || '0');
            existing.totalInvestedCHF += parseFloat(tx.totalCHF || '0');
          } else if (tx.type === 'sell') {
            const sellShares = parseFloat(tx.shares || '0');
            const avgCost = existing.shares > 0 ? existing.totalInvestedCHF / existing.shares : 0;
            existing.shares -= sellShares;
            existing.totalInvestedCHF -= sellShares * avgCost;
          }
          
          holdingsMap.set(ticker, existing);
        }
      }
      
      // Calculate current value of holdings
      let portfolioValueCHF = 0;
      let portfolioInvestedCHF = 0;
      
      for (const [ticker, holding] of holdingsMap) {
        if (holding.shares <= 0) continue;
        
        const stock = await getStockByTicker(ticker);
        if (!stock) continue;
        
        const currency = getStockCurrency(stock.ticker);
        const currentPriceCHF = await convertToCHF(stock.currentPrice, currency);
        const currentValueCHF = holding.shares * currentPriceCHF;
        
        portfolioValueCHF += currentValueCHF;
        portfolioInvestedCHF += holding.totalInvestedCHF;
      }
      
      // Add cash position
      const cashPosition = totalDeposits - totalWithdrawals - portfolioInvestedCHF;
      portfolioValueCHF += cashPosition;
      
      totalValueCHF += portfolioValueCHF;
      totalInvestedCHF += totalDeposits - totalWithdrawals;
    }
    
    const totalPerformanceCHF = totalValueCHF - totalInvestedCHF;
    const totalPerformancePercent = totalInvestedCHF > 0 ? (totalPerformanceCHF / totalInvestedCHF) * 100 : 0;
    
    return {
      totalValue: totalValueCHF,
      totalPerformance: totalPerformanceCHF,
      totalPerformancePercent: totalPerformancePercent,
      totalDividends: totalDividendsCHF,
      portfolioCount: portfolios.length,
      livePortfolioCount: livePortfolios.length,
    };
  }),
  
  // Get top portfolios by performance
  getTopPortfolios: protectedProcedure.query(async ({ ctx }) => {
    const { getSavedPortfolios, getPortfolioTransactions, getStockByTicker, getDb } = await import("../db");
    const portfolios = await getSavedPortfolios(ctx.user.id);
    
    const livePortfolios = portfolios.filter(p => p.isLive === 1 && p.liveStartDate);
    
    if (livePortfolios.length === 0) {
      return [];
    }
    
    const db = await getDb();
    if (!db) return [];
    
    const { getStockCurrency, convertToCHF } = await import("../fxHelper");
    
    const portfolioMetrics = [];
    
    // Calculate metrics for each live portfolio
    for (const portfolio of livePortfolios) {
      const transactions = await getPortfolioTransactions(portfolio.id);
      
      // Calculate total deposits and withdrawals
      let totalDeposits = 0;
      let totalWithdrawals = 0;
      
      for (const tx of transactions) {
        if (tx.type === 'deposit') {
          totalDeposits += parseFloat(tx.totalCHF || '0');
        } else if (tx.type === 'withdrawal') {
          totalWithdrawals += parseFloat(tx.totalCHF || '0');
        }
      }
      
      // Calculate current holdings value
      const holdingsMap = new Map<string, { shares: number; totalInvestedCHF: number }>();
      
      for (const tx of transactions) {
        if (tx.type === 'buy' || tx.type === 'sell') {
          const ticker = tx.ticker;
          if (!ticker) continue;
          
          const existing = holdingsMap.get(ticker) || { shares: 0, totalInvestedCHF: 0 };
          
          if (tx.type === 'buy') {
            existing.shares += parseFloat(tx.shares || '0');
            existing.totalInvestedCHF += parseFloat(tx.totalCHF || '0');
          } else if (tx.type === 'sell') {
            const sellShares = parseFloat(tx.shares || '0');
            const avgCost = existing.shares > 0 ? existing.totalInvestedCHF / existing.shares : 0;
            existing.shares -= sellShares;
            existing.totalInvestedCHF -= sellShares * avgCost;
          }
          
          holdingsMap.set(ticker, existing);
        }
      }
      
      // Calculate current value of holdings
      let portfolioValueCHF = 0;
      let portfolioInvestedCHF = 0;
      
      for (const [ticker, holding] of holdingsMap) {
        if (holding.shares <= 0) continue;
        
        const stock = await getStockByTicker(ticker);
        if (!stock) continue;
        
        const currency = getStockCurrency(stock.ticker);
        const currentPriceCHF = await convertToCHF(stock.currentPrice, currency);
        const currentValueCHF = holding.shares * currentPriceCHF;
        
        portfolioValueCHF += currentValueCHF;
        portfolioInvestedCHF += holding.totalInvestedCHF;
      }
      
      // Add cash position
      const cashPosition = totalDeposits - totalWithdrawals - portfolioInvestedCHF;
      portfolioValueCHF += cashPosition;
      
      const totalInvested = totalDeposits - totalWithdrawals;
      const performanceCHF = portfolioValueCHF - totalInvested;
      const performancePercent = totalInvested > 0 ? (performanceCHF / totalInvested) * 100 : 0;
      
      portfolioMetrics.push({
        id: portfolio.id,
        name: portfolio.name,
        description: portfolio.description,
        value: portfolioValueCHF,
        performance: performancePercent,
        performanceCHF: performanceCHF,
      });
    }
    
    // Sort by performance and return top 4
    portfolioMetrics.sort((a, b) => b.performance - a.performance);
    return portfolioMetrics.slice(0, 4);
  }),
});
