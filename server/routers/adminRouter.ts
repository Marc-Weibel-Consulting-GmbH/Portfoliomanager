import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { importHistoricalPrices, importHistoricalPricesForTicker } from "../jobs/importHistoricalPrices";
import { checkPriceCoverage, getRelevantTickersForPortfolio, getAllPortfolioTickers } from "../priceCoverage";
import { backfillHistoricalPrices } from "../backfillHistoricalPrices";

export const adminRouter = router({
    exportData: protectedProcedure.query(async () => {
      const { getAllStocks, getDb } = await import("../db");
      const { research, transactions } = await import("../../drizzle/schema");
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const stocks = await getAllStocks();
      const researchData = await db.select().from(research);
      const transactionsData = await db.select().from(transactions);
      
      return {
        exportDate: new Date().toISOString(),
        version: "1.0",
        data: {
          stocks,
          research: researchData,
          transactions: transactionsData,
        },
      };
    }),
    importData: protectedProcedure
      .input((val: unknown) => {
        if (typeof val === "object" && val !== null) return val;
        throw new Error("Invalid input");
      })
      .mutation(async ({ input }) => {
        const { getDb } = await import("../db");
        const { stocks, research, transactions } = await import("../../drizzle/schema");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const importData = input as any;
        const { stocks: stocksData, research: researchData, transactions: transactionsData } = importData.data;
        
        // Delete existing data
        await db.delete(transactions);
        await db.delete(research);
        await db.delete(stocks);
        
        // Import new data
        let importedStocks = 0;
        let importedResearch = 0;
        let importedTransactions = 0;
        
        if (stocksData && stocksData.length > 0) {
          const stocksToInsert = stocksData.map((s: any) => {
            const { id, createdAt, updatedAt, ...rest } = s;
            return rest;
          });
          await db.insert(stocks).values(stocksToInsert);
          importedStocks = stocksData.length;
        }
        
        if (researchData && researchData.length > 0) {
          const researchToInsert = researchData.map((r: any) => {
            const { id, createdAt, updatedAt, ...rest } = r;
            return rest;
          });
          await db.insert(research).values(researchToInsert);
          importedResearch = researchData.length;
        }
        
        if (transactionsData && transactionsData.length > 0) {
          const transactionsToInsert = transactionsData.map((t: any) => {
            const { id, createdAt, ...rest } = t;
            return rest;
          });
          await db.insert(transactions).values(transactionsToInsert);
          importedTransactions = transactionsData.length;
        }
        
        return {
          success: true,
          imported: {
            stocks: importedStocks,
            research: importedResearch,
            transactions: importedTransactions,
          },
        };
      }),
    bulkUpdateSwissStocks: protectedProcedure.mutation(async ({ ctx }) => {
      // Only admin can run bulk updates
      if (ctx.user?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      const { getDb } = await import("../db");
      const { stocks } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { fetchCompleteStockData } = await import("../_core/multiApiDataMerger");
      
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get all Swiss stocks
      const allStocks = await db.select().from(stocks);
      const swissStocks = allStocks.filter(s => s.ticker.endsWith('.SW'));

      console.log(`[Bulk Update] Found ${swissStocks.length} Swiss stocks`);

      let updatedCount = 0;
      let failedCount = 0;
      const results: any[] = [];

      for (const stock of swissStocks) {
        try {
          console.log(`[${stock.ticker}] Fetching data...`);
          
          // Get complete data from multiApiDataMerger
          const completeData = await fetchCompleteStockData(stock.ticker);

          // Prepare update data
          const updateData: any = {};

          // Update price and currency
          if (completeData.currentPrice !== null) {
            updateData.currentPrice = completeData.currentPrice.toString();
          }
          if (completeData.currency) {
            updateData.currency = completeData.currency;
          }

          // Update Sharpe Ratio
          if (completeData.sharpe !== null && completeData.sharpe !== undefined) {
            updateData.sharpeRatio = completeData.sharpe.toString();
          }

          // Update other metrics
          if (completeData.pe !== null) updateData.peRatio = completeData.pe.toString();
          if (completeData.peg !== null) updateData.pegRatio = completeData.peg.toString();
          if (completeData.dividendYield !== null) updateData.dividendYield = completeData.dividendYield.toString();
          if (completeData.beta !== null) updateData.beta = completeData.beta.toString();
          if (completeData.volatility !== null) updateData.volatility = completeData.volatility.toString();

          // Update timestamp
          updateData.lastDataRefresh = new Date();

          // Execute update
          if (Object.keys(updateData).length > 1) {
            await db.update(stocks)
              .set(updateData)
              .where(eq(stocks.ticker, stock.ticker));
            
            console.log(`  ✅ Updated ${stock.ticker}`);
            updatedCount++;
            results.push({ ticker: stock.ticker, status: 'success', updates: updateData });
          }

          // Rate limiting: wait 500ms between requests
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error: any) {
          console.error(`  ❌ Failed ${stock.ticker}:`, error.message);
          failedCount++;
          results.push({ ticker: stock.ticker, status: 'failed', error: error.message });
        }
      }

      return {
        success: true,
        total: swissStocks.length,
        updated: updatedCount,
        failed: failedCount,
        results,
      };
    }),
    triggerDailyRefresh: protectedProcedure.mutation(async ({ ctx }) => {
      // Only admin can trigger daily refresh
      if (ctx.user?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      const { refreshAllStocks } = await import("../_core/dailyRefreshCron");
      const result = await refreshAllStocks();
      
      return result;
    }),
    getDataQualityMetrics: protectedProcedure.query(async ({ ctx }) => {
      // Only admin can view data quality metrics
      if (ctx.user?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      const { calculateDataQualityMetrics } = await import("../_core/dataQualityMetrics");
      const metrics = await calculateDataQualityMetrics();
      
      return metrics;
    }),
    
    triggerYTDUpdate: protectedProcedure.mutation(async ({ ctx }) => {
      // Only admin can trigger YTD update
      if (ctx.user?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      const { manualYTDUpdate } = await import("../cron/ytdUpdater");
      await manualYTDUpdate();
      
      return { success: true, message: "YTD update completed" };
    }),
    
    refreshPrices: protectedProcedure.query(async ({ ctx }) => {
      // Only admin can refresh prices
      if (ctx.user?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      const { refreshAllStocks } = await import("../_core/dailyRefreshCron");
      await refreshAllStocks();
      
      return { success: true, message: "Prices refreshed successfully" };
    }),
    
    refreshCharts: protectedProcedure.query(async ({ ctx }) => {
      // Only admin can refresh charts
      if (ctx.user?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      // Charts are updated via refreshAllStocks
      const { refreshAllStocks } = await import("../_core/dailyRefreshCron");
      await refreshAllStocks();
      
      return { success: true, message: "Charts refreshed successfully" };
    }),
    
    refreshNews: protectedProcedure.query(async ({ ctx }) => {
      // Only admin can refresh news
      if (ctx.user?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      // News updates are disabled (memory optimization)
      return { success: true, message: "News updates are currently disabled for memory optimization" };
    }),
    
    /**
     * Trigger historical price import for all tickers
     */
    importHistoricalPrices: protectedProcedure
      .input(
        z.object({
          fromDate: z.string().optional(),
          toDate: z.string().optional(),
          forceRefresh: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Only admin can import historical prices
        if (ctx.user?.role !== 'admin') {
          throw new Error('Unauthorized: Admin access required');
        }
        
        const result = await importHistoricalPrices(input.fromDate, input.toDate, input.forceRefresh);
        return result;
      }),

    /**
     * Import historical prices for a specific ticker
     */
    importHistoricalPricesForTicker: protectedProcedure
      .input(
        z.object({
          ticker: z.string(),
          fromDate: z.string().optional(),
          toDate: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Only admin can import historical prices
        if (ctx.user?.role !== 'admin') {
          throw new Error('Unauthorized: Admin access required');
        }
        
        const result = await importHistoricalPricesForTicker(input.ticker, input.fromDate, input.toDate);
        return result;
      }),

    /**
     * Check price coverage for specified tickers
     * Useful for debugging missing historical price data
     */
    priceCoverage: protectedProcedure
      .input(z.object({
        tickers: z.array(z.string()).optional(),
        portfolioId: z.number().optional(),
        from: z.string().optional(),
        to: z.string().optional()
      }))
      .query(async ({ ctx, input }) => {
        // Only admin can check price coverage
        if (ctx.user?.role !== 'admin') {
          throw new Error('Unauthorized: Admin access required');
        }

        let tickers: string[] = [];

        // If portfolioId provided, get tickers from that portfolio
        if (input.portfolioId) {
          tickers = await getRelevantTickersForPortfolio(input.portfolioId);
        }
        // If tickers array provided, use that
        else if (input.tickers && input.tickers.length > 0) {
          tickers = input.tickers;
        }
        // Otherwise get all portfolio tickers
        else {
          tickers = await getAllPortfolioTickers();
        }

        if (tickers.length === 0) {
          return {
            tickers: [],
            distinctTickerSample: [],
            requestedRange: {
              from: input.from || "2025-01-01",
              to: input.to || new Date().toISOString().split('T')[0]
            }
          };
        }

        return await checkPriceCoverage(tickers, input.from, input.to);
      }),

    /**
     * Backfill historical prices for specified tickers
     * Admin-only operation to populate missing historical price data
     */
    backfillPrices: protectedProcedure
      .input(z.object({
        tickers: z.array(z.string()).optional(),
        portfolioId: z.number().optional(),
        from: z.string(),
        to: z.string()
      }))
      .mutation(async ({ ctx, input }) => {
        // Only admin can backfill prices
        if (ctx.user?.role !== 'admin') {
          throw new Error('Unauthorized: Admin access required');
        }

        let tickers: string[] = [];

        // If portfolioId provided, get tickers from that portfolio
        if (input.portfolioId) {
          tickers = await getRelevantTickersForPortfolio(input.portfolioId);
        }
        // If tickers array provided, use that
        else if (input.tickers && input.tickers.length > 0) {
          tickers = input.tickers;
        }
        // Otherwise get all portfolio tickers
        else {
          tickers = await getAllPortfolioTickers();
        }

        if (tickers.length === 0) {
          throw new Error('No tickers found to backfill');
        }

        console.log(`[adminRouter.backfillPrices] Starting backfill for ${tickers.length} tickers`);

        const result = await backfillHistoricalPrices(tickers, input.from, input.to);

        return {
          success: result.success,
          summary: {
            tickersProcessed: result.tickersProcessed,
            pricesInserted: result.pricesInserted,
            pricesUpdated: result.pricesUpdated,
            missingTickers: result.missingTickers,
            errorCount: result.errors.length
          },
          errors: result.errors.slice(0, 10) // Return first 10 errors only
        };
      }),

    /**
     * Get all portfolio tickers
     * Useful for seeing what tickers are in use across all portfolios
     */
    getAllTickers: protectedProcedure
      .query(async ({ ctx }) => {
        // Only admin can get all tickers
        if (ctx.user?.role !== 'admin') {
          throw new Error('Unauthorized: Admin access required');
        }

        const tickers = await getAllPortfolioTickers();
        return {
          tickers,
          count: tickers.length
        };
      }),
});
