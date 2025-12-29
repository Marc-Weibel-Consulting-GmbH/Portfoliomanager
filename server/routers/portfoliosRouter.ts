import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

// Helper to get YTD start date (January 1st of current year)
function getYTDStartDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

export const portfoliosRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getSavedPortfolios, getPortfolioTransactions, getStockByTicker, getDb } = await import("../db");
      const portfolios = await getSavedPortfolios(ctx.user.id);
      
      // Batch load all stocks and historical prices for performance optimization
      const db = await getDb();
      if (!db) return portfolios;
      
      const { stocks: stocksTable, historicalPrices } = await import("../../drizzle/schema");
      const { inArray, and, eq, desc, lte } = await import("drizzle-orm");
      const { getStockCurrency, convertToCHF } = await import("../fxHelper");
      
      // Get all unique tickers from all live portfolios
      const livePortfolios = portfolios.filter(p => p.isLive && p.liveStartDate);
      const allTickers = new Set<string>();
      
      for (const portfolio of livePortfolios) {
        const transactions = await getPortfolioTransactions(portfolio.id);
        transactions.forEach((tx: any) => {
          if (tx.ticker) allTickers.add(tx.ticker);
        });
      }
      
      // Batch load all stocks
      const allStocksData = allTickers.size > 0
        ? await db.select().from(stocksTable).where(inArray(stocksTable.ticker, Array.from(allTickers)))
        : [];
      const stocksMap = new Map(allStocksData.map(s => [s.ticker, s]));
      
      // YTD start date for performance calculation
      const ytdStartDate = getYTDStartDate();
      const todayStr = new Date().toISOString().split('T')[0];
      
      // Batch load YTD start prices for all tickers
      const ytdPricesMap = new Map<string, number>();
      for (const ticker of Array.from(allTickers)) {
        // Try exact date first, then nearest previous date
        let [priceRecord] = await db
          .select()
          .from(historicalPrices)
          .where(
            and(
              eq(historicalPrices.ticker, ticker),
              eq(historicalPrices.date, ytdStartDate)
            )
          )
          .limit(1);
        
        if (!priceRecord) {
          // Find nearest previous date
          [priceRecord] = await db
            .select()
            .from(historicalPrices)
            .where(
              and(
                eq(historicalPrices.ticker, ticker),
                lte(historicalPrices.date, ytdStartDate)
              )
            )
            .orderBy(desc(historicalPrices.date))
            .limit(1);
        }
        
        if (priceRecord?.close) {
          ytdPricesMap.set(ticker, parseFloat(priceRecord.close));
        }
      }
      
      // Calculate YTD performance for each live portfolio
      const portfoliosWithPerformance = await Promise.all(
        portfolios.map(async (portfolio) => {
          if (!portfolio.isLive || !portfolio.liveStartDate) {
            return portfolio;
          }
          
          try {
            const transactions = await getPortfolioTransactions(portfolio.id);
            if (transactions.length === 0) {
              return { ...portfolio, livePerformance: 0, currentValue: 0, positionCount: 0 };
            }
            
            // Calculate current holdings from transactions
            const holdings: Record<string, number> = {};
            
            transactions.forEach((tx: any) => {
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
              
              // Get YTD start price
              const ytdStartPrice = ytdPricesMap.get(ticker) || currentPrice;
              
              // Convert to CHF
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

    get: protectedProcedure
      .input(z.number().int().positive())
      .query(async ({ input, ctx }) => {
        console.log('[portfolios.get] input:', input, 'type:', typeof input, 'userId:', ctx.user.id);
        const { getSavedPortfolioById } = await import("../db");
        const result = await getSavedPortfolioById(input, ctx.user.id);
        console.log('[portfolios.get] result:', result ? 'found' : 'not found');
        return result;
      }),

    // Get portfolio with currency conversion data
    getWithCurrency: protectedProcedure
      .input(z.number().int().positive())
      .query(async ({ input, ctx }) => {
        const { getSavedPortfolioById, getStockByTicker } = await import("../db");
        const { getStockCurrency, getCurrentFxRate, convertToCHF } = await import("../fxHelper");
        
        const portfolio = await getSavedPortfolioById(input, ctx.user.id);
        if (!portfolio) return null;
        
        // Parse portfolio data
        let portfolioData: { stocks: any[] } = { stocks: [] };
        try {
          portfolioData = JSON.parse(portfolio.portfolioData || '{}');
        } catch (e) {
          console.error('[getWithCurrency] Failed to parse portfolio data:', e);
        }
        
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Enrich stocks with currency and FX data
        const enrichedStocks = await Promise.all(
          (portfolioData.stocks || []).map(async (stock: any) => {
            const ticker = stock.ticker;
            const dbStock = await getStockByTicker(ticker);
            const currency = dbStock?.currency || await getStockCurrency(ticker);
            const currentPrice = parseFloat(stock.currentPrice) || parseFloat(dbStock?.currentPrice || '0');
            
            // Get FX rate for this currency
            let fxRate = 1.0;
            if (currency !== 'CHF') {
              fxRate = await getCurrentFxRate(`${currency}CHF`);
            }
            
            const priceCHF = currentPrice * fxRate;
            
            return {
              ...stock,
              currency,
              fxRate,
              currentPrice,
              priceCHF,
            };
          })
        );
        
        return {
          ...portfolio,
          portfolioData: JSON.stringify({ ...portfolioData, stocks: enrichedStocks }),
        };
      }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          portfolioData: z.string(),
          isLive: z.number().optional().default(0),
          liveStartDate: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { createSavedPortfolio } = await import("../db");
        const result = await createSavedPortfolio({
          userId: ctx.user.id,
          name: input.name,
          description: input.description || null,
          portfolioData: input.portfolioData,
          isLive: input.isLive,
          liveStartDate: input.liveStartDate || null,
        });
        return result;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          portfolioData: z.string().optional(),
          isLive: z.number().optional(),
          liveStartDate: z.string().optional().nullable(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { updateSavedPortfolio } = await import("../db");
        const result = await updateSavedPortfolio(input.id, ctx.user.id, {
          name: input.name,
          description: input.description,
          portfolioData: input.portfolioData,
          isLive: input.isLive,
          liveStartDate: input.liveStartDate,
        });
        return result;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const { deleteSavedPortfolio } = await import("../db");
        await deleteSavedPortfolio(input.id, ctx.user.id);
        return { success: true };
      }),

    // Get holdings with CHF performance for a portfolio
    getHoldingsWithChfPerformance: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const { getSavedPortfolioById, getPortfolioTransactions, getStockByTicker } = await import("../db");
        const { getStockCurrency, convertToCHF, getHistoricalPrice } = await import("../fxHelper");
        
        const portfolio = await getSavedPortfolioById(input.id, ctx.user.id);
        if (!portfolio || !portfolio.isLive) return [];
        
        const transactions = await getPortfolioTransactions(input.id);
        if (transactions.length === 0) return [];
        
        // Calculate holdings from transactions
        const holdings: Record<string, { shares: number; totalInvestedCHF: number }> = {};
        
        transactions.forEach((tx: any) => {
          const ticker = tx.ticker;
          if (!ticker) return;
          
          const shares = parseFloat(tx.shares || '0');
          const amount = parseFloat(tx.totalAmountCHF || '0');
          
          if (!holdings[ticker]) {
            holdings[ticker] = { shares: 0, totalInvestedCHF: 0 };
          }
          
          if (tx.transactionType === 'buy') {
            holdings[ticker].shares += shares;
            holdings[ticker].totalInvestedCHF += amount;
          } else if (tx.transactionType === 'sell') {
            const avgCost = holdings[ticker].shares > 0 
              ? holdings[ticker].totalInvestedCHF / holdings[ticker].shares 
              : 0;
            holdings[ticker].shares -= shares;
            holdings[ticker].totalInvestedCHF -= shares * avgCost;
          }
        });
        
        const todayStr = new Date().toISOString().split('T')[0];
        const ytdStartDate = `${new Date().getFullYear()}-01-01`;
        
        // Calculate CHF values for each holding
        const results = [];
        for (const [ticker, holding] of Object.entries(holdings)) {
          if (holding.shares <= 0) continue;
          
          const stock = await getStockByTicker(ticker);
          if (!stock) continue;
          
          const currency = stock.currency || 'CHF';
          const currentPrice = parseFloat(stock.currentPrice || '0');
          const ytdStartPrice = await getHistoricalPrice(ticker, ytdStartDate) || currentPrice;
          
          const currentPriceCHF = await convertToCHF(currentPrice, currency, todayStr);
          const ytdStartPriceCHF = await convertToCHF(ytdStartPrice, currency, ytdStartDate);
          
          const currentValueCHF = holding.shares * currentPriceCHF;
          const ytdStartValueCHF = holding.shares * ytdStartPriceCHF;
          const performanceCHF = currentValueCHF - ytdStartValueCHF;
          const performancePercent = ytdStartValueCHF > 0 
            ? (performanceCHF / ytdStartValueCHF) * 100 
            : 0;
          
          results.push({
            ticker,
            companyName: stock.companyName,
            shares: holding.shares,
            currency,
            currentPrice,
            currentPriceCHF,
            currentValueCHF,
            totalInvestedCHF: holding.totalInvestedCHF,
            performanceCHF,
            performancePercent,
          });
        }
        
        return results;
      }),
});
