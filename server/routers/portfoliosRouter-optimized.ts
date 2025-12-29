import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

// Helper to get YTD start date (January 1st of current year)
function getYTDStartDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

export const portfoliosRouterOptimized = router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getSavedPortfolios } = await import("../db");
      const { batchGetPortfolioTransactions, batchGetStocks, batchGetHistoricalPrices, getCachedFxRate, setCachedFxRate } = await import("../db-optimized");
      const { getStockCurrency, convertToCHF } = await import("../fxHelper");
      
      // Step 1: Get all portfolios for user
      const portfolios = await getSavedPortfolios(ctx.user.id);
      const livePortfolios = portfolios.filter(p => p.isLive && p.liveStartDate);
      
      if (livePortfolios.length === 0) {
        return portfolios;
      }
      
      // Step 2: Batch load ALL transactions for ALL portfolios in ONE query
      const portfolioIds = livePortfolios.map(p => p.id);
      const transactionsByPortfolio = await batchGetPortfolioTransactions(portfolioIds);
      
      // Step 3: Collect all unique tickers
      const allTickers = new Set<string>();
      for (const transactions of Array.from(transactionsByPortfolio.values())) {
        transactions.forEach(tx => {
          if (tx.ticker) allTickers.add(tx.ticker);
        });
      }
      
      if (allTickers.size === 0) {
        return portfolios;
      }
      
      // Step 4: Batch load ALL stocks in ONE query
      const stocksMap = await batchGetStocks(Array.from(allTickers));
      
      // Step 5: Batch load ALL historical prices in ONE query
      const ytdStartDate = getYTDStartDate();
      const todayStr = new Date().toISOString().split('T')[0];
      const ytdPricesMap = await batchGetHistoricalPrices(Array.from(allTickers), ytdStartDate);
      
      // Step 6: Pre-fetch FX rates for all unique currencies
      const uniqueCurrencies = new Set<string>();
      for (const stock of Array.from(stocksMap.values())) {
        if (stock.currency) uniqueCurrencies.add(stock.currency);
      }
      
      // Pre-warm FX cache
      const fxPromises = [];
      for (const currency of Array.from(uniqueCurrencies)) {
        if (currency !== 'CHF') {
          // Check cache first
          if (!getCachedFxRate(currency, todayStr)) {
            fxPromises.push(
              convertToCHF(1, currency, todayStr).then(rate => {
                setCachedFxRate(currency, todayStr, rate);
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
      
      // Wait for all FX rates to be cached
      await Promise.all(fxPromises);
      
      // Step 7: Calculate performance for each portfolio (now all data is in memory)
      const portfoliosWithPerformance = await Promise.all(
        portfolios.map(async (portfolio) => {
          if (!portfolio.isLive || !portfolio.liveStartDate) {
            return portfolio;
          }
          
          try {
            const transactions = transactionsByPortfolio.get(portfolio.id) || [];
            if (transactions.length === 0) {
              return { ...portfolio, livePerformance: 0, currentValue: 0, positionCount: 0 };
            }
            
            // Calculate current holdings from transactions
            const holdings: Record<string, number> = {};
            
            transactions.forEach(tx => {
              const shares = parseFloat(tx.shares || '0');
              const ticker = tx.ticker;
              
              if (!ticker) return;
              
              if (tx.transactionType === 'buy') {
                holdings[ticker] = (holdings[ticker] || 0) + shares;
              } else if (tx.transactionType === 'sell') {
                holdings[ticker] = (holdings[ticker] || 0) - shares;
              }
            });
            
            // Calculate current value and YTD start value
            let currentValueCHF = 0;
            let ytdStartValueCHF = 0;
            
            for (const [ticker, shares] of Object.entries(holdings)) {
              if (shares <= 0) continue;
              
              const stock = stocksMap.get(ticker);
              if (!stock) continue;
              
              const currency = stock.currency || 'CHF';
              const currentPrice = parseFloat(stock.currentPrice || '0');
              
              // Get YTD start price from pre-loaded map
              const ytdStartPrice = ytdPricesMap.get(ticker) || currentPrice;
              
              // Convert to CHF (using cached FX rates)
              const currentPriceCHF = await convertToCHF(currentPrice, currency, todayStr);
              const ytdStartPriceCHF = await convertToCHF(ytdStartPrice, currency, ytdStartDate);
              
              currentValueCHF += shares * currentPriceCHF;
              ytdStartValueCHF += shares * ytdStartPriceCHF;
            }
            
            // Calculate YTD performance
            const performanceCHF = currentValueCHF - ytdStartValueCHF;
            const performancePercent = ytdStartValueCHF > 0 
              ? (performanceCHF / ytdStartValueCHF) * 100 
              : 0;
            
            // Count unique positions with shares > 0
            const positionCount = Object.values(holdings).filter(s => s > 0).length;
            
            return { 
              ...portfolio, 
              livePerformance: performancePercent,
              currentValue: currentValueCHF,
              positionCount: positionCount
            };
          } catch (error) {
            console.error(`Error calculating YTD performance for portfolio ${portfolio.id}:`, error);
            return portfolio;
          }
        })
      );
      
      return portfoliosWithPerformance;
    }),
});
