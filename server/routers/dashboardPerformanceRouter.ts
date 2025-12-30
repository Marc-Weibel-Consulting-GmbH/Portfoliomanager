import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

/**
 * Dashboard Performance Router
 * Provides aggregated historical performance data across all live portfolios
 */
export const dashboardPerformanceRouter = router({
  /**
   * Get aggregated historical performance across all live portfolios
   * Returns daily portfolio value and performance data for charting
   */
  getHistoricalPerformance: protectedProcedure
    .input(
      z.object({
        period: z.enum(['1M', '3M', '6M', '1Y', 'YTD', 'All']).default('YTD'),
      })
    )
    .query(async ({ ctx, input }) => {
      const { getSavedPortfolios } = await import("../db");
      const { batchGetPortfolioTransactions, batchGetStocks, getCachedFxRate, setCachedFxRate } = await import("../db-optimized");
      const { convertToCHF } = await import("../fxHelper");
      const { getDb } = await import("../db");
      const { historicalPrices } = await import("../../drizzle/schema");
      const { inArray, and, gte, lte } = await import("drizzle-orm");
      
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      
      // Get all live portfolios
      const portfolios = await getSavedPortfolios(ctx.user.id);
      const livePortfolios = portfolios.filter(p => p.isLive === 1 && p.liveStartDate);
      
      if (livePortfolios.length === 0) {
        return {
          dates: [],
          values: [],
          performance: [],
        };
      }
      
      // Determine date range based on period
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      let startDate = new Date();
      
      switch (input.period) {
        case '1M':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case '3M':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case '6M':
          startDate.setMonth(startDate.getMonth() - 6);
          break;
        case '1Y':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        case 'YTD':
          startDate = new Date(`${today.getFullYear()}-01-01`);
          break;
        case 'All':
          // Find earliest transaction date
          const portfolioIds = livePortfolios.map(p => p.id);
          const transactionsByPortfolio = await batchGetPortfolioTransactions(portfolioIds);
          let earliestDate = today;
          for (const transactions of Array.from(transactionsByPortfolio.values())) {
            for (const tx of transactions) {
              const txDate = new Date(tx.transactionDate);
              if (txDate < earliestDate) {
                earliestDate = txDate;
              }
            }
          }
          startDate = earliestDate;
          break;
      }
      
      const startDateStr = startDate.toISOString().split('T')[0];
      
      // Batch load ALL transactions
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
        return {
          dates: [],
          values: [],
          performance: [],
        };
      }
      
      // Batch load stocks
      const stocksMap = await batchGetStocks(Array.from(allTickers));
      
      // Get historical prices for all tickers in date range
      const pricesResult = await db
        .select()
        .from(historicalPrices)
        .where(
          and(
            inArray(historicalPrices.ticker, Array.from(allTickers)),
            gte(historicalPrices.date, startDateStr),
            lte(historicalPrices.date, todayStr)
          )
        );
      
      // Build price map: ticker -> date -> price
      const priceMap = new Map<string, Map<string, number>>();
      for (const price of pricesResult) {
        if (!priceMap.has(price.ticker)) {
          priceMap.set(price.ticker, new Map());
        }
        priceMap.get(price.ticker)!.set(price.date, parseFloat(price.close));
      }
      
      // Get all unique dates from price data
      const allDates = new Set<string>();
      for (const tickerPrices of Array.from(priceMap.values())) {
        for (const date of Array.from(tickerPrices.keys())) {
          allDates.add(date);
        }
      }
      
      const sortedDates = Array.from(allDates).sort();
      
      if (sortedDates.length === 0) {
        console.warn("[dashboardPerformance] No historical price data available for date range");
        return {
          dates: [],
          values: [],
          performance: [],
        };
      }
      
      // Pre-warm FX cache for all currencies
      const uniqueCurrencies = new Set<string>();
      for (const stock of Array.from(stocksMap.values())) {
        if (stock.currency) uniqueCurrencies.add(stock.currency);
      }
      
      const fxPromises = [];
      for (const currency of Array.from(uniqueCurrencies)) {
        if (currency !== 'CHF') {
          for (const date of [sortedDates[0], todayStr]) {
            if (!getCachedFxRate(currency, date)) {
              fxPromises.push(
                convertToCHF(1, currency, date).then(rate => {
                  setCachedFxRate(currency, date, rate);
                  return rate;
                })
              );
            }
          }
        }
      }
      await Promise.all(fxPromises);
      
      // Calculate portfolio value for each date
      const dateValues: number[] = [];
      const datePerformance: number[] = [];
      let startingValue = 0;
      
      for (let i = 0; i < sortedDates.length; i++) {
        const date = sortedDates[i];
        let totalValueCHF = 0;
        
        // For each portfolio, calculate holdings at this date
        for (const portfolio of livePortfolios) {
          const transactions = transactionsByPortfolio.get(portfolio.id) || [];
          
          // Calculate holdings up to this date
          const holdingsMap = new Map<string, number>();
          
          for (const tx of transactions) {
            const txDate = new Date(tx.transactionDate).toISOString().split('T')[0];
            if (txDate > date) break; // Only process transactions before or on this date
            
            const ticker = tx.ticker;
            if (!ticker) continue;
            
            if (tx.transactionType === 'buy') {
              const shares = parseFloat(tx.shares || '0');
              holdingsMap.set(ticker, (holdingsMap.get(ticker) || 0) + shares);
            } else if (tx.transactionType === 'sell') {
              const shares = parseFloat(tx.shares || '0');
              holdingsMap.set(ticker, (holdingsMap.get(ticker) || 0) - shares);
            }
          }
          
          // Calculate value of holdings at this date
          for (const [ticker, shares] of Array.from(holdingsMap.entries())) {
            if (shares <= 0) continue;
            
            const stock = stocksMap.get(ticker);
            if (!stock) continue;
            
            const currency = stock.currency || 'CHF';
            
            // Get price for this date (or most recent available)
            const tickerPrices = priceMap.get(ticker);
            if (!tickerPrices) continue;
            
            let price = tickerPrices.get(date);
            if (!price) {
              // Find most recent price before this date
              const availableDates = Array.from(tickerPrices.keys()).sort();
              for (let j = availableDates.length - 1; j >= 0; j--) {
                if (availableDates[j] <= date) {
                  price = tickerPrices.get(availableDates[j]);
                  break;
                }
              }
            }
            
            if (!price) continue;
            
            // Convert to CHF
            const priceCHF = await convertToCHF(price, currency, date);
            totalValueCHF += shares * priceCHF;
          }
        }
        
        dateValues.push(totalValueCHF);
        
        // Calculate performance relative to starting value
        if (i === 0) {
          startingValue = totalValueCHF;
          datePerformance.push(0);
        } else {
          const performance = startingValue > 0 
            ? ((totalValueCHF - startingValue) / startingValue) * 100 
            : 0;
          datePerformance.push(performance);
        }
      }
      
      return {
        dates: sortedDates,
        values: dateValues,
        performance: datePerformance,
        startingValue,
      };
    }),
});
