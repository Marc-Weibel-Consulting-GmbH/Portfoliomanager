import { adminProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { importHistoricalPrices, importHistoricalPricesForTicker } from "../jobs/importHistoricalPrices";
import { checkPriceCoverage, getRelevantTickersForPortfolio, getAllPortfolioTickers } from "../priceCoverage";
import { backfillHistoricalPrices } from "../backfillHistoricalPrices";
import { 
  checkSymbolDataStatus, 
  triggerMaxBackfillForSymbol, 
  ensureMaxBackfillForSymbols,
  autoBackfillNewSymbols,
  getBackfillQueueStatus,
  clearBackfillCache 
} from "../autoBackfill";

export const adminRouter = router({
    /**
     * L-18: Echte Plattform-KPIs statt hartkodierter Platzhalter-Nullen.
     * Zählt Nutzer, Neuregistrierungen (30 Tage), zahlende Nutzer (hasPaid — Stripe
     * läuft als Einmalzahlung) und angelegte Portfolios direkt aus der DB.
     */
    getPlatformKpis: adminProcedure.query(async () => {
      const { getDb } = await import("../db");
      const { users, savedPortfolios } = await import("../../drizzle/schema");
      const { sql, gte } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const countOf = async (table: any, where?: any) => {
        const base = db.select({ c: sql<number>`count(*)` }).from(table);
        const [row] = where ? await base.where(where) : await base;
        return Number(row?.c ?? 0);
      };

      const [totalUsers, newUsers30d, premiumUsers, totalPortfolios] = await Promise.all([
        countOf(users),
        countOf(users, gte(users.createdAt, thirtyDaysAgo)),
        countOf(users, sql`${users.hasPaid} = 1`),
        countOf(savedPortfolios),
      ]);

      return { totalUsers, newUsers30d, premiumUsers, totalPortfolios };
    }),

    exportData: adminProcedure.query(async () => {
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
    importData: adminProcedure
      .input(
        z.object({
          data: z.object({
            stocks: z.array(z.any()).optional(),
            research: z.array(z.any()).optional(),
            transactions: z.array(z.any()).optional(),
          }),
        })
      )
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
    bulkUpdateSwissStocks: adminProcedure.mutation(async ({ ctx }) => {
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
          if (completeData.logoUrl) updateData.logoUrl = completeData.logoUrl;

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
    triggerDailyRefresh: adminProcedure.mutation(async ({ ctx }) => {
      // Only admin can trigger daily refresh
      if (ctx.user?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      const { refreshAllStocks } = await import("../_core/dailyRefreshCron");
      const result = await refreshAllStocks();
      
      return result;
    }),
    getDataQualityMetrics: adminProcedure.query(async ({ ctx }) => {
      // Only admin can view data quality metrics
      if (ctx.user?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      const { calculateDataQualityMetrics } = await import("../_core/dataQualityMetrics");
      const metrics = await calculateDataQualityMetrics();
      
      return metrics;
    }),
    
    triggerYTDUpdate: adminProcedure.mutation(async ({ ctx }) => {
      // Only admin can trigger YTD update
      if (ctx.user?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      const { manualYTDUpdate } = await import("../cron/ytdUpdater");
      await manualYTDUpdate();
      
      return { success: true, message: "YTD update completed" };
    }),
    
    refreshPrices: adminProcedure.query(async ({ ctx }) => {
      // Only admin can refresh prices
      if (ctx.user?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      const { refreshAllStocks } = await import("../_core/dailyRefreshCron");
      await refreshAllStocks();
      
      return { success: true, message: "Prices refreshed successfully" };
    }),
    
    refreshCharts: adminProcedure.query(async ({ ctx }) => {
      // Only admin can refresh charts
      if (ctx.user?.role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      // Charts are updated via refreshAllStocks
      const { refreshAllStocks } = await import("../_core/dailyRefreshCron");
      await refreshAllStocks();
      
      return { success: true, message: "Charts refreshed successfully" };
    }),
    
    refreshNews: adminProcedure.query(async ({ ctx }) => {
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
    importHistoricalPrices: adminProcedure
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
    importHistoricalPricesForTicker: adminProcedure
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
    priceCoverage: adminProcedure
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
    backfillPrices: adminProcedure
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
    getAllTickers: adminProcedure
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

    /**
     * Get auto-backfill queue status
     * Shows pending and recently completed backfills
     */
    getBackfillStatus: adminProcedure
      .query(async ({ ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Unauthorized: Admin access required');
        }

        return getBackfillQueueStatus();
      }),

    /**
     * Check data status for specific symbols
     * Returns information about available historical data
     */
    checkSymbolsDataStatus: adminProcedure
      .input(z.object({
        tickers: z.array(z.string())
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Unauthorized: Admin access required');
        }

        const statuses = await Promise.all(
          input.tickers.map(ticker => checkSymbolDataStatus(ticker))
        );

        return {
          statuses,
          summary: {
            total: statuses.length,
            withData: statuses.filter(s => s.hasData).length,
            needingBackfill: statuses.filter(s => s.needsBackfill).length,
            currentlyBackfilling: statuses.filter(s => s.isBackfilling).length
          }
        };
      }),

    /**
     * Trigger MAX backfill for specific symbols
     * Fetches 5 years of historical data for each symbol
     */
    triggerMaxBackfill: adminProcedure
      .input(z.object({
        tickers: z.array(z.string()),
        force: z.boolean().optional().default(false)
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Unauthorized: Admin access required');
        }

        console.log(`[adminRouter.triggerMaxBackfill] Starting MAX backfill for ${input.tickers.length} tickers`);
        
        const results = await ensureMaxBackfillForSymbols(input.tickers, input.force);

        return {
          results,
          summary: {
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            totalPricesInserted: results.reduce((sum, r) => sum + r.pricesInserted, 0),
            totalDuration: results.reduce((sum, r) => sum + r.duration, 0)
          }
        };
      }),

    /**
     * Auto-detect and backfill new symbols
     * Checks all provided symbols and triggers backfill for those without sufficient data
     */
    autoBackfillSymbols: adminProcedure
      .input(z.object({
        tickers: z.array(z.string()).optional()
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Unauthorized: Admin access required');
        }

        // If no tickers provided, get all portfolio tickers
        let tickers = input.tickers || [];
        if (tickers.length === 0) {
          tickers = await getAllPortfolioTickers();
        }

        console.log(`[adminRouter.autoBackfillSymbols] Checking ${tickers.length} symbols for auto-backfill`);
        
        const result = await autoBackfillNewSymbols(tickers);

        return {
          newSymbolsDetected: result.newSymbolsDetected,
          statuses: result.statuses,
          backfillResults: result.backfillResults,
          summary: {
            totalChecked: result.statuses.length,
            newSymbols: result.newSymbolsDetected,
            successfulBackfills: result.backfillResults.filter(r => r.success).length,
            failedBackfills: result.backfillResults.filter(r => !r.success).length,
            totalPricesInserted: result.backfillResults.reduce((sum, r) => sum + r.pricesInserted, 0)
          }
        };
      }),

    /**
     * Clear backfill cache
     * Forces re-check of all symbols on next backfill request
     */
    clearBackfillCache: adminProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user?.role !== 'admin') {
          throw new Error('Unauthorized: Admin access required');
        }

        clearBackfillCache();
        return { success: true, message: 'Backfill cache cleared' };
      }),

    // ─── ML Trainer ───────────────────────────────────────────────────────────

    /**
     * Get the current status of the ML model:
     * latest artifact metadata, metrics, and whether a model is active.
     */
    mlGetStatus: adminProcedure
      .query(async ({ ctx }) => {
        if (ctx.user?.role !== 'admin') throw new Error('Unauthorized: Admin access required');

        const { getDb } = await import('../db');
        const { modelArtifacts } = await import('../../drizzle/schema');
        const { desc } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) return { hasModel: false, artifacts: [] };

        const rows = await db
          .select({
            id: modelArtifacts.id,
            kind: modelArtifacts.kind,
            version: modelArtifacts.version,
            status: modelArtifacts.status,
            format: modelArtifacts.format,
            trainStart: modelArtifacts.trainStart,
            trainEnd: modelArtifacts.trainEnd,
            universeSize: modelArtifacts.universeSize,
            metrics: modelArtifacts.metrics,
            promotedAt: modelArtifacts.promotedAt,
            createdAt: modelArtifacts.createdAt,
            // modelBlob intentionally omitted (large)
          })
          .from(modelArtifacts)
          .orderBy(desc(modelArtifacts.createdAt))
          .limit(1);

        const active = await db
          .select({
            id: modelArtifacts.id,
            kind: modelArtifacts.kind,
            version: modelArtifacts.version,
            status: modelArtifacts.status,
            trainStart: modelArtifacts.trainStart,
            trainEnd: modelArtifacts.trainEnd,
            universeSize: modelArtifacts.universeSize,
            metrics: modelArtifacts.metrics,
            promotedAt: modelArtifacts.promotedAt,
            createdAt: modelArtifacts.createdAt,
          })
          .from(modelArtifacts)
          .where((await import('drizzle-orm')).eq(modelArtifacts.status, 'active'))
          .limit(1);

        const analyticsUrl = process.env.ANALYTICS_SERVICE_URL;
        let serviceOnline = false;
        if (analyticsUrl) {
          const healthUrl = `${analyticsUrl.replace(/\/$/, '')}/health`;
          // Two attempts with 8s timeout each — Railway cold starts can take 3-5s
          for (let attempt = 0; attempt < 2 && !serviceOnline; attempt++) {
            try {
              const r = await fetch(healthUrl, { signal: AbortSignal.timeout(8000) });
              serviceOnline = r.ok;
            } catch { /* offline or timeout, try once more */ }
          }
        }

        return {
          hasModel: active.length > 0,
          activeModel: active[0] ?? null,
          latestRun: rows[0] ?? null,
          serviceOnline,
          analyticsServiceConfigured: !!analyticsUrl,
        };
      }),

    /**
     * Get full training history (all artifacts, newest first).
     */
    mlGetHistory: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(100).optional().default(20) }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') throw new Error('Unauthorized: Admin access required');

        const { getDb } = await import('../db');
        const { modelArtifacts } = await import('../../drizzle/schema');
        const { desc } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) return { runs: [] };

        const rows = await db
          .select({
            id: modelArtifacts.id,
            kind: modelArtifacts.kind,
            version: modelArtifacts.version,
            status: modelArtifacts.status,
            format: modelArtifacts.format,
            trainStart: modelArtifacts.trainStart,
            trainEnd: modelArtifacts.trainEnd,
            universeSize: modelArtifacts.universeSize,
            metrics: modelArtifacts.metrics,
            promotedAt: modelArtifacts.promotedAt,
            createdAt: modelArtifacts.createdAt,
          })
          .from(modelArtifacts)
          .orderBy(desc(modelArtifacts.createdAt))
          .limit(input.limit);

        return { runs: rows };
      }),

    // ─────────────────────────────────────────────────────────────────────
    // Signal Performance Analytics (Admin only)
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Aggregierte Signal-Performance-Metriken je Engine und Regime.
     * Basis für Admin-Dashboard zur Optimierung des Signalmix.
     */
    getSignalPerformance: adminProcedure
      .input(z.object({
        days: z.number().default(90),
        engine: z.string().optional(),
        regime: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') throw new Error('Unauthorized: Admin access required');

        const { getDb } = await import('../db');
        const { signalHistory } = await import('../../drizzle/schema');
        const { and, gte, isNotNull, sql, eq } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) throw new Error('DB not available');

        const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

        const conditions: any[] = [
          gte(signalHistory.computedAt, since),
          isNotNull(signalHistory.evaluatedAt),
          isNotNull(signalHistory.directionCorrect),
        ];
        if (input.engine) conditions.push(eq(signalHistory.selectedEngine, input.engine));
        if (input.regime) conditions.push(eq(signalHistory.regime, input.regime));

        const rows = await db
          .select()
          .from(signalHistory)
          .where(and(...conditions))
          .orderBy(sql`${signalHistory.computedAt} DESC`)
          .limit(2000);

        // Aggregation je Engine
        const engineMap: Record<string, {
          engine: string; totalSignals: number; evaluatedSignals: number;
          hitRateSum: number; returnSum: number; convictionSum: number;
          // F-14: Alpha nur über Zeilen mit Benchmark-Daten aggregieren
          alphaSum: number; alphaCount: number; alphaHitSum: number;
          byRegime: Record<string, { hitSum: number; count: number; retSum: number }>;
          byAction: Record<string, { hitSum: number; count: number; alphaSum: number; alphaCount: number; alphaHitSum: number }>;
        }> = {};

        for (const row of rows) {
          const eng = row.selectedEngine;
          if (!engineMap[eng]) {
            engineMap[eng] = { engine: eng, totalSignals: 0, evaluatedSignals: 0,
              hitRateSum: 0, returnSum: 0, convictionSum: 0,
              alphaSum: 0, alphaCount: 0, alphaHitSum: 0, byRegime: {}, byAction: {} };
          }
          const s = engineMap[eng];
          s.totalSignals++;
          s.evaluatedSignals++;
          const correct = row.directionCorrect === 1;
          s.hitRateSum += correct ? 1 : 0;
          s.returnSum += parseFloat(row.actualReturnPct?.toString() ?? '0');
          s.convictionSum += parseFloat(row.conviction.toString());

          const alpha = row.alphaPct != null ? parseFloat(row.alphaPct.toString()) : null;
          if (alpha != null && !isNaN(alpha)) {
            s.alphaSum += alpha;
            s.alphaCount++;
            s.alphaHitSum += alpha > 0 ? 1 : 0;
          }

          const reg = row.regime;
          if (!s.byRegime[reg]) s.byRegime[reg] = { hitSum: 0, count: 0, retSum: 0 };
          s.byRegime[reg].count++;
          s.byRegime[reg].hitSum += correct ? 1 : 0;
          s.byRegime[reg].retSum += parseFloat(row.actualReturnPct?.toString() ?? '0');

          const act = row.action;
          if (!s.byAction[act]) s.byAction[act] = { hitSum: 0, count: 0, alphaSum: 0, alphaCount: 0, alphaHitSum: 0 };
          s.byAction[act].count++;
          s.byAction[act].hitSum += correct ? 1 : 0;
          if (alpha != null && !isNaN(alpha)) {
            s.byAction[act].alphaSum += alpha;
            s.byAction[act].alphaCount++;
            s.byAction[act].alphaHitSum += alpha > 0 ? 1 : 0;
          }
        }

        const engineStats = Object.values(engineMap).map(s => ({
          engine: s.engine,
          totalSignals: s.totalSignals,
          evaluatedSignals: s.evaluatedSignals,
          hitRate: s.evaluatedSignals > 0 ? s.hitRateSum / s.evaluatedSignals : 0,
          avgReturn: s.evaluatedSignals > 0 ? s.returnSum / s.evaluatedSignals : 0,
          avgConviction: s.evaluatedSignals > 0 ? s.convictionSum / s.evaluatedSignals : 0,
          // F-14 (additiv): Ø Alpha & Alpha-Trefferquote (Alpha > 0), nur wo Benchmark-Daten existieren
          avgAlpha: s.alphaCount > 0 ? s.alphaSum / s.alphaCount : null,
          alphaHitRate: s.alphaCount > 0 ? s.alphaHitSum / s.alphaCount : null,
          alphaCount: s.alphaCount,
          byRegime: Object.fromEntries(Object.entries(s.byRegime).map(([k, v]) => [k, {
            hitRate: v.count > 0 ? v.hitSum / v.count : 0,
            count: v.count,
            avgReturn: v.count > 0 ? v.retSum / v.count : 0,
          }])),
          byAction: Object.fromEntries(Object.entries(s.byAction).map(([k, v]) => [k, {
            hitRate: v.count > 0 ? v.hitSum / v.count : 0,
            count: v.count,
            avgAlpha: v.alphaCount > 0 ? v.alphaSum / v.alphaCount : null,
            alphaHitRate: v.alphaCount > 0 ? v.alphaHitSum / v.alphaCount : null,
            alphaCount: v.alphaCount,
          }])),
        }));

        // Kalibrierungskurve
        const buckets = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
        const calibration = buckets.slice(0, -1).map((min, i) => {
          const max = buckets[i + 1];
          const inBucket = rows.filter(r =>
            parseFloat(r.conviction.toString()) >= min &&
            parseFloat(r.conviction.toString()) < max
          );
          const hits = inBucket.filter(r => r.directionCorrect === 1).length;
          return {
            bucket: `${Math.round(min * 100)}-${Math.round(max * 100)}%`,
            minConviction: min, maxConviction: max,
            hitRate: inBucket.length > 0 ? hits / inBucket.length : 0,
            count: inBucket.length,
          };
        });

        // Letzte 50 Signale (alle, nicht nur evaluierte)
        const recentSignals = await db
          .select()
          .from(signalHistory)
          .where(gte(signalHistory.computedAt, since))
          .orderBy(sql`${signalHistory.computedAt} DESC`)
          .limit(50);

        return {
          engineStats,
          calibration,
          recentSignals,
          totalEvaluated: rows.length,
          overallHitRate: rows.length > 0
            ? rows.filter(r => r.directionCorrect === 1).length / rows.length
            : null,
        };
      }),

    /** Manueller Trigger: Signal-Snapshot für alle Portfolio-Aktien */
    triggerSignalSnapshot: adminProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user?.role !== 'admin') throw new Error('Unauthorized: Admin access required');
        const { snapshotSignalsForPortfolio } = await import('../cron/signalEvaluationCron');
        snapshotSignalsForPortfolio().catch(console.error);
        return { started: true, message: 'Signal-Snapshot gestartet (läuft im Hintergrund)' };
      }),

    /** Manueller Trigger: Lookback-Evaluation */
    triggerSignalEvaluation: adminProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user?.role !== 'admin') throw new Error('Unauthorized: Admin access required');
        const { evaluatePendingSignals } = await import('../cron/signalEvaluationCron');
        evaluatePendingSignals().catch(console.error);
        return { started: true, message: 'Lookback-Evaluation gestartet' };
      }),

    // ── Phase 3: Risk Threshold Kalibrierung ─────────────────────────────────

    /** Kalibrierungsstatus: Cache-Stats und kalibrierte Ticker anzeigen */
    getRiskCalibrationStatus: adminProcedure
      .query(async ({ ctx }) => {
        if (ctx.user?.role !== 'admin') throw new Error('Unauthorized: Admin access required');
        const { getCacheStats } = await import('../lib/signals/riskThresholdCalibrator');
        const stats = getCacheStats();
        return {
          cachedTickers: stats.tickers,
          cacheSize: stats.size,
          description: 'Kalibrierte Schwellenwerte im In-Memory Cache (TTL: 24h)',
        };
      }),

    /** Kalibrierung für einen einzelnen Ticker triggern */
    calibrateRiskThresholdsForTicker: adminProcedure
      .input(z.object({ ticker: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') throw new Error('Unauthorized: Admin access required');
        const yahooFinance = (await import('yahoo-finance2')).default;
        const { calibrateRiskThresholds, setCachedThresholds } = await import('../lib/signals/riskThresholdCalibrator');

        const ticker = input.ticker;
        try {
          const chartResult = await (yahooFinance as any).chart(ticker, {
            period1: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            period2: new Date().toISOString().split('T')[0],
            interval: '1d',
          });
          const prices: number[] = ((chartResult as any).quotes ?? [])
            .map((q: any) => q.close)
            .filter((c: any) => c != null && c > 0);

          if (prices.length < 100) {
            return { success: false, message: `Zu wenig Daten: ${prices.length} Preispunkte (mind. 100 nötig)` };
          }

          const start = Date.now();
          const thresholds = calibrateRiskThresholds(ticker, prices);
          setCachedThresholds(ticker, thresholds);
          const durationMs = Date.now() - start;

          return {
            success: true,
            ticker,
            durationMs,
            dataPoints: prices.length,
            numFolds: thresholds.meta.numFolds,
            confidence: thresholds.meta.confidence,
            avgOosImprovement: thresholds.meta.avgOosImprovement,
            calibratedAt: thresholds.meta.calibratedAt,
            thresholds: {
              volDampLevel1: thresholds.vol.dampLevel1,
              volDampLevel2: thresholds.vol.dampLevel2,
              volBlockLevel: thresholds.vol.blockLevel,
              ddDampLevel1: thresholds.drawdown.dampLevel1,
              ddDampLevel2: thresholds.drawdown.dampLevel2,
            },
            regimeMultipliers: thresholds.regimeMultipliers,
          };
        } catch (e) {
          return { success: false, message: `Fehler: ${(e as Error).message}` };
        }
      }),

    /** Cache leeren (erzwingt Neukalibrierung beim nächsten Request) */
    clearRiskCalibrationCache: adminProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user?.role !== 'admin') throw new Error('Unauthorized: Admin access required');
        const { clearThresholdCache } = await import('../lib/signals/riskThresholdCalibrator');
        clearThresholdCache();
        return { success: true, message: 'Kalibrierungs-Cache geleert' };
      }),

    // ─── App Settings (Diversifikationsregeln, Gebühren) ───────────────
    getAppSettings: adminProcedure
      .query(async ({ ctx }) => {
        if (ctx.user?.role !== 'admin') throw new Error('Unauthorized: Admin access required');
        const { getDb } = await import("../db");
        const { appSettings } = await import("../../drizzle/schema");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const rows = await db.select().from(appSettings);
        return rows;
      }),

    updateAppSetting: adminProcedure
      .input(z.object({
        key: z.string(),
        value: z.any(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== 'admin') throw new Error('Unauthorized: Admin access required');
        const { getDb } = await import("../db");
        const { appSettings } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.insert(appSettings)
          .values({ key: input.key, value: input.value, description: input.description })
          .onDuplicateKeyUpdate({ set: { value: input.value, description: input.description } });
        return { success: true };
      }),

    // ─── KI-Alpha: regime-abhängige Signal-Konfiguration (Track A, P1+P2) ───

    /** Konfiguration je Regime: admin-gesetzte Qualität/Trading-Gewichte + gelernte Engine-Gewichte. */
    getRegimeSignalConfig: adminProcedure.query(async () => {
      const { getRegimeConfig } = await import("../analytics/regimeSignalMemory");
      return getRegimeConfig();
    }),

    /** P1: Qualität/Trading-Verhältnis eines Regimes setzen (wird auf Summe 1 normiert). */
    setRegimeBlend: adminProcedure
      .input(z.object({
        regime: z.string().min(1),
        quality: z.number().min(0),
        trading: z.number().min(0),
      }).refine((v) => v.quality + v.trading > 0, { message: "Mindestens ein Gewicht muss > 0 sein" }))
      .mutation(async ({ input }) => {
        const { setRegimeBlend } = await import("../analytics/regimeSignalMemory");
        await setRegimeBlend(input.regime, input.quality, input.trading);
        return { success: true };
      }),

    /** P2: Engine-Gewichte je Regime aus dem gemessenen Alpha (signal_history) neu lernen. */
    recomputeRegimeWeights: adminProcedure.mutation(async () => {
      const { recomputeRegimeEngineWeights } = await import("../analytics/regimeSignalMemory");
      return recomputeRegimeEngineWeights();
    }),

    /** Diagnose: ist die Python-ML-Pipeline (ANALYTICS_SERVICE_URL) konfiguriert/erreichbar? */
    analyticsServiceStatus: adminProcedure.query(async () => {
      const { getAnalyticsServiceStatus } = await import("../lib/analyticsServiceStatus");
      return getAnalyticsServiceStatus();
    }),

    /**
     * Manueller Trigger für den täglichen signalScore-Refresh + Preishistorie-Backfill.
     * Ruft den internen /api/scheduled/signalScoreRefresh Endpoint auf.
     * Nützlich um nicht auf 07:00 UTC warten zu müssen.
     */
    triggerSignalScoreRefresh: adminProcedure.mutation(async () => {
      try {
        const { runSignalScoreRefresh } = await import("../scheduled/signalScoreRefreshScheduled");
        const result = await runSignalScoreRefresh();
        if (!result.ok) {
          return {
            success: false,
            message: `Fehler: ${result.error ?? "Unbekannter Fehler"}`,
            details: null,
          };
        }
        return {
          success: true,
          message: `Refresh abgeschlossen: ${result.updated ?? 0} Scores aktualisiert, ${result.ytdRecalc?.updated ?? 0} YTD-Werte neu berechnet, ${result.backfill?.pricesImported ?? 0} Preise importiert.`,
          details: result,
        };
      } catch (err: any) {
        return {
          success: false,
          message: `Fehler: ${err?.message ?? "Unbekannter Fehler"}`,
          details: null,
        };
      }
    }),

    /**
     * Manually trigger the EODHD Gap-Filling job
     */
    triggerGapFilling: adminProcedure.mutation(async () => {
      const { runGapFilling } = await import("../cron/gapFillingCron");
      try {
        const result = await runGapFilling("manual");
        return {
          success: true,
          gapsFound: result.gapsFound,
          stocksAdded: result.stocksAdded,
          stocksSkipped: result.stocksSkipped,
          durationMs: result.durationMs,
        };
      } catch (err: any) {
        return {
          success: false,
          gapsFound: [],
          stocksAdded: [],
          stocksSkipped: 0,
          durationMs: 0,
          error: err?.message ?? "Unbekannter Fehler",
        };
      }
    }),

    /**
     * Get the last N gap-filling log entries
     */
    getGapFillLogs: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
      .query(async ({ input }) => {
        const { getDb } = await import("../db");
        const { gapFillLog } = await import("../../drizzle/schema");
        const { desc } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const rows = await db
          .select()
          .from(gapFillLog)
          .orderBy(desc(gapFillLog.runAt))
          .limit(input.limit);
        return rows;
      }),

    /**
     * List portfolio proposal logs (Multi-Agent KI-Analyse Resultate)
     * Nur im Admin-Bereich sichtbar — nicht für Endnutzer.
     */
    listProposalLogs: adminProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        confidence: z.enum(['hoch', 'mittel', 'niedrig']).optional(),
        meetsFilter: z.enum(['ja', 'nein', 'n/a']).optional(),
      }))
      .query(async ({ input }) => {
        const { getDb } = await import("../db");
        const { portfolioProposalLog } = await import("../../drizzle/schema");
        const { desc, eq, and, sql } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const conditions: any[] = [];
        if (input.confidence) conditions.push(eq(portfolioProposalLog.overallConfidence, input.confidence));
        if (input.meetsFilter) conditions.push(eq(portfolioProposalLog.meetsKennzahlenFilter, input.meetsFilter));
        const rows = await db
          .select()
          .from(portfolioProposalLog)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(portfolioProposalLog.createdAt))
          .limit(input.limit)
          .offset(input.offset);
        const [countRow] = await db
          .select({ total: sql<number>`count(*)` })
          .from(portfolioProposalLog)
          .where(conditions.length > 0 ? and(...conditions) : undefined);
        return { rows, total: Number(countRow?.total ?? 0) };
      }),

    /**
     * Mark a proposal log as accepted/rejected (Nutzer-Feedback für Training)
     */
    updateProposalAccepted: adminProcedure
      .input(z.object({
        id: z.number(),
        accepted: z.enum(['ja', 'nein']),
      }))
      .mutation(async ({ input }) => {
        const { getDb } = await import("../db");
        const { portfolioProposalLog } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.update(portfolioProposalLog)
          .set({ accepted: input.accepted })
          .where(eq(portfolioProposalLog.id, input.id));
        return { success: true };
      }),

    /**
     * Admin: Vorschlag mit angepassten Positionen genehmigen und Portfolio erstellen.
     * Nimmt einen Proposal-Log-Eintrag + editierte Positionen und erstellt daraus
     * ein neues Portfolio für den ursprünglichen Nutzer.
     */
    approveProposalAndCreate: adminProcedure
      .input(z.object({
        proposalId: z.number(),
        portfolioName: z.string().min(1),
        investmentAmount: z.number().positive(),
        portfolioType: z.enum(['demo', 'live']).default('demo'),
        // Editierte Positionen (nach Admin-Review)
        positions: z.array(z.object({
          ticker: z.string(),
          companyName: z.string(),
          sector: z.string().optional(),
          currency: z.string().default('CHF'),
          currentPrice: z.number(),
          exchangeRateToChf: z.number().default(1),
          weightPct: z.number().min(0).max(100),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const { getDb } = await import("../db");
        const { portfolioProposalLog } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // 1) Proposal-Log laden um userId zu ermitteln
        const [proposal] = await db
          .select()
          .from(portfolioProposalLog)
          .where(eq(portfolioProposalLog.id, input.proposalId))
          .limit(1);
        if (!proposal) throw new Error(`Proposal #${input.proposalId} nicht gefunden`);

        // 2) Positionen normieren (Summe muss 100% ergeben)
        const totalWeight = input.positions.reduce((s, p) => s + p.weightPct, 0);
        if (totalWeight <= 0) throw new Error('Positionen haben Gesamtgewicht 0');
        const normalizedPositions = input.positions.map(p => ({
          ...p,
          weightPct: parseFloat(((p.weightPct / totalWeight) * 100).toFixed(2)),
        }));

        // 3) portfolioData im Format der portfolios.create-Mutation aufbauen
        const portfolioData = {
          stocks: normalizedPositions.map(p => ({
            ticker: p.ticker,
            companyName: p.companyName,
            sector: p.sector ?? 'Andere',
            currency: p.currency,
            currentPrice: p.currentPrice,
            exchangeRateToChf: p.exchangeRateToChf,
            weight: p.weightPct,
          })),
        };

        // 4) Portfolio über den bestehenden DB-Helper anlegen
        const { createSavedPortfolio } = await import("../db");
        const portfolioId = await createSavedPortfolio({
          userId: proposal.userId,
          name: input.portfolioName,
          description: `KI-Vorschlag #${input.proposalId} — vom Admin geprüft und genehmigt`,
          portfolioData: JSON.stringify(portfolioData),
          portfolioType: input.portfolioType,
          investmentAmount: String(input.investmentAmount),
          isAiOptimized: 1, // Portfolio wurde vom Admin aus KI-Vorschlag mit finalAdjustments erstellt
        });

        // 5) Training-Feedback berechnen: Differenz zwischen Original und Admin-Version
        const originalPositions = Array.isArray(proposal.positions) ? (proposal.positions as any[]) : [];
        const feedbackChanges: Array<{
          ticker: string;
          action: string;
          originalWeight: number;
          adminWeight: number;
          delta: number;
          replaced: boolean;
        }> = [];

        // Check for weight changes and removals
        for (const orig of originalPositions) {
          const adminPos = normalizedPositions.find(p => p.ticker.toUpperCase() === orig.ticker?.toUpperCase());
          if (!adminPos) {
            // Position removed by admin
            feedbackChanges.push({ ticker: orig.ticker, action: 'removed', originalWeight: parseFloat(orig.weightPct ?? orig.weight ?? '0'), adminWeight: 0, delta: -parseFloat(orig.weightPct ?? orig.weight ?? '0'), replaced: false });
          } else {
            const origW = parseFloat(orig.weightPct ?? orig.weight ?? '0');
            const adminW = adminPos.weightPct;
            const delta = adminW - origW;
            if (Math.abs(delta) > 0.5) {
              feedbackChanges.push({ ticker: orig.ticker, action: delta > 0 ? 'increased' : 'reduced', originalWeight: origW, adminWeight: adminW, delta, replaced: false });
            }
          }
        }
        // Check for new positions added by admin
        for (const adminPos of normalizedPositions) {
          const wasOriginal = originalPositions.find((p: any) => p.ticker?.toUpperCase() === adminPos.ticker.toUpperCase());
          if (!wasOriginal) {
            feedbackChanges.push({ ticker: adminPos.ticker, action: 'added', originalWeight: 0, adminWeight: adminPos.weightPct, delta: adminPos.weightPct, replaced: false });
          }
        }

        const adminFeedback = feedbackChanges.length > 0 ? {
          changes: feedbackChanges,
          summary: `Admin änderte ${feedbackChanges.length} Positionen: ${feedbackChanges.map(c => `${c.ticker} ${c.action} (${c.delta > 0 ? '+' : ''}${c.delta.toFixed(1)}%)`).join(', ')}`,
          approvedAt: new Date().toISOString(),
          adminId: ctx.user.id,
        } : null;

        // 5) Proposal als übernommen markieren + Feedback speichern
        await db.update(portfolioProposalLog)
          .set({ accepted: 'ja', ...(adminFeedback ? { adminFeedback } : {}) })
          .where(eq(portfolioProposalLog.id, input.proposalId));

        if (feedbackChanges.length > 0) {
          console.log(`[admin.approveProposalAndCreate] Training feedback saved: ${feedbackChanges.length} changes for proposal #${input.proposalId}`);
        }

        console.log(`[admin.approveProposalAndCreate] Portfolio ${portfolioId} created for user ${proposal.userId} from proposal #${input.proposalId}`);

        // 6) Automatischen Backfill für neue Symbole anstoßen (fire-and-forget)
        try {
          const tickers = normalizedPositions.map(p => p.ticker).filter(Boolean);
          if (tickers.length > 0) {
            console.log(`[admin.approveProposalAndCreate] Triggering auto-backfill for ${tickers.length} symbols: ${tickers.join(',')}`);
            import("../autoBackfill").then(({ autoBackfillNewSymbols }) => {
              autoBackfillNewSymbols(tickers).then(result => {
                if (result.newSymbolsDetected > 0) {
                  console.log(`[admin.approveProposalAndCreate] Auto-backfill completed: ${result.newSymbolsDetected} new symbols processed`);
                }
              }).catch(err => {
                console.error(`[admin.approveProposalAndCreate] Auto-backfill error:`, err);
              });
            });
          }
        } catch (backfillErr) {
          console.warn('[admin.approveProposalAndCreate] Backfill trigger failed (non-blocking):', backfillErr);
        }

        // 7) Nutzer per E-Mail benachrichtigen (nicht-blockierend)
        let userEmailSent = false;
        let ownerNotificationSent = false;
        let noEmailOnFile = false;
        try {
          const { getUserById } = await import("../db");
          const { sendEmail } = await import("../_core/email");
          const { notifyOwner } = await import("../_core/notification");
          const targetUser = await getUserById(proposal.userId);
          const appUrl = process.env.VITE_APP_URL || 'https://portfoliodash-aqvizp6n.manus.space';
          const positionCount = normalizedPositions.length;
          const topPositions = [...normalizedPositions]
            .sort((a, b) => b.weightPct - a.weightPct)
            .slice(0, 5)
            .map(p => `${p.ticker} (${p.weightPct.toFixed(1)}%)`);
          if (targetUser?.email) {
            userEmailSent = await sendEmail({
              to: targetUser.email,
              subject: `Ihr KI-Portfolio «${input.portfolioName}» ist bereit`,
              html: `
<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"></head>
<body style="font-family:sans-serif;background:#0f172a;color:#e2e8f0;padding:40px 20px;">
  <div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:12px;padding:40px;">
    <h1 style="color:#14b8a6;font-size:24px;margin:0 0 8px;">Portfolio bereit ✓</h1>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">Ihr KI-generiertes Portfolio wurde vom Administrator geprüft und genehmigt.</p>
    <div style="background:#0f172a;border-radius:8px;padding:20px;margin-bottom:24px;">
      <div style="font-size:18px;font-weight:600;color:#f1f5f9;margin-bottom:4px;">«${input.portfolioName}»</div>
      <div style="color:#64748b;font-size:13px;">${positionCount} Positionen · ${input.portfolioType === 'live' ? 'Live-Portfolio' : 'Demo-Portfolio'} · CHF ${input.investmentAmount.toLocaleString('de-CH')}</div>
    </div>
    <p style="color:#94a3b8;font-size:13px;margin:0 0 8px;">Top-Positionen:</p>
    <p style="color:#e2e8f0;font-size:14px;font-family:monospace;margin:0 0 24px;">${topPositions.join(' · ')}</p>
    <a href="${appUrl}/portfolios" style="display:inline-block;padding:12px 28px;background:#14b8a6;color:#0f172a;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Portfolio ansehen →</a>
    <p style="color:#475569;font-size:12px;margin:32px 0 0;">Diese E-Mail wurde automatisch generiert. Bitte antworten Sie nicht auf diese E-Mail.</p>
  </div>
</body></html>`,
            });
            if (userEmailSent) console.log(`[admin.approveProposalAndCreate] Email sent to ${targetUser.email}`);
          } else {
            noEmailOnFile = true;
            console.log(`[admin.approveProposalAndCreate] No email on file for user ${proposal.userId}`);
          }
          // Owner-Benachrichtigung
          ownerNotificationSent = await notifyOwner({
            title: `Admin: Portfolio «${input.portfolioName}» erstellt`,
            content: `Portfolio #${portfolioId} für Nutzer ${targetUser?.name ?? proposal.userId} (${positionCount} Titel, CHF ${input.investmentAmount.toLocaleString('de-CH')}) wurde aus KI-Vorschlag #${input.proposalId} genehmigt.`,
          }).catch(() => false);
        } catch (notifyErr) {
          console.warn('[admin.approveProposalAndCreate] Notification failed (non-blocking):', notifyErr);
        }

        return { success: true, portfolioId, userEmailSent, ownerNotificationSent, noEmailOnFile };
      }),

    // ─── Feedback-Dashboard: Aggregierte adminFeedback-Signale ───────────────
    getFeedbackStats: adminProcedure.query(async () => {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) throw new Error('DB not available');
      const { portfolioProposalLog } = await import('../../drizzle/schema');
      const { isNotNull, desc } = await import('drizzle-orm');

      const rows = await db.select({
        id: portfolioProposalLog.id,
        adminFeedback: portfolioProposalLog.adminFeedback,
        createdAt: portfolioProposalLog.createdAt,
        riskProfile: portfolioProposalLog.riskProfile,
      }).from(portfolioProposalLog)
        .where(isNotNull(portfolioProposalLog.adminFeedback))
        .orderBy(desc(portfolioProposalLog.createdAt))
        .limit(50);

      const tickerActions: Record<string, { reduce: number; increase: number; replace: number; remove: number; add: number; total: number; lastSeen: Date }> = {};

      for (const row of rows) {
        const fb = row.adminFeedback as any;
        if (!fb) continue;
        const entries: Array<{ ticker: string; action: string }> = [
          ...(fb.reduced ?? []).map((t: string) => ({ ticker: t, action: 'reduce' })),
          ...(fb.increased ?? []).map((t: string) => ({ ticker: t, action: 'increase' })),
          ...(fb.replaced ?? []).map((t: string) => ({ ticker: t, action: 'replace' })),
          ...(fb.removed ?? []).map((t: string) => ({ ticker: t, action: 'remove' })),
          ...(fb.added ?? []).map((t: string) => ({ ticker: t, action: 'add' })),
        ];
        for (const e of entries) {
          if (!tickerActions[e.ticker]) tickerActions[e.ticker] = { reduce: 0, increase: 0, replace: 0, remove: 0, add: 0, total: 0, lastSeen: row.createdAt };
          (tickerActions[e.ticker] as any)[e.action]++;
          tickerActions[e.ticker].total++;
          if (row.createdAt > tickerActions[e.ticker].lastSeen) tickerActions[e.ticker].lastSeen = row.createdAt;
        }
      }

      const patterns = Object.entries(tickerActions)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([ticker, v]) => ({
          ticker,
          reduce: v.reduce,
          increase: v.increase,
          replace: v.replace,
          remove: v.remove,
          add: v.add,
          total: v.total,
          lastSeen: v.lastSeen,
          dominantAction: (['reduce', 'increase', 'replace', 'remove', 'add'] as Array<'reduce' | 'increase' | 'replace' | 'remove' | 'add'>)
            .sort((a, b) => v[b] - v[a])[0],
        }));

      return {
        totalFeedbackEntries: rows.length,
        patterns,
        recentFeedback: rows.slice(0, 10).map(r => ({
          id: r.id,
          createdAt: r.createdAt,
          riskProfile: r.riskProfile,
          summary: r.adminFeedback as any,
        })),
      };
    }),

  // Admin-Review Workflow: save reviewed positions + comments
  saveAdminReview: adminProcedure
    .input(z.object({
      proposalId: z.number(),
      reviewedPositions: z.array(z.object({
        ticker: z.string(),
        companyName: z.string().optional(),
        sector: z.string().optional(),
        currency: z.string().optional(),
        weightPct: z.number(),
        originalWeightPct: z.number().optional(),
      })),
      adminComments: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const { portfolioProposalLog } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB not available' });

      const totalWeight = input.reviewedPositions.reduce((s, p) => s + p.weightPct, 0);
      const normalizedPositions = totalWeight > 0
        ? input.reviewedPositions.map(p => ({ ...p, weightPct: Math.round(p.weightPct / totalWeight * 100 * 10) / 10 }))
        : input.reviewedPositions;

      await db.update(portfolioProposalLog)
        .set({
          adminReviewedPositions: normalizedPositions as any,
          adminComments: (input.adminComments ?? {}) as any,
          reviewStatus: 'reviewed',
          reviewedAt: new Date(),
        })
        .where(eq(portfolioProposalLog.id, input.proposalId));

      return { success: true, proposalId: input.proposalId };
    }),

  // Get a single proposal by ID (for deep-link from wizard)
  getProposalById: adminProcedure
    .input(z.object({ proposalId: z.number() }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const { portfolioProposalLog } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB not available' });
      const rows = await db.select().from(portfolioProposalLog)
        .where(eq(portfolioProposalLog.id, input.proposalId))
        .limit(1);
      if (rows.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal nicht gefunden' });
      return rows[0];
    }),
});

