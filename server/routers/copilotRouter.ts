/**
 * Portfolio Copilot Router
 * ========================
 * tRPC endpoints for the ML Portfolio Copilot feature.
 * Provides ranking, rebalancing, warnings, and AI-generated explanations.
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { invokeLLM } from '../_core/llm';
import { getSavedPortfolioById, getPortfolioTransactions, createPortfolioTransaction, getDb } from '../db';
import {
  runCopilotAnalysis,
  calculateRankings,
  calculateDiversificationScore,
  type PortfolioHolding,
  type CopilotAnalysis,
} from '../analytics/portfolioCopilot';
import { runCopilotBacktest } from '../analytics/copilotBacktest';
import { runWalkForwardValidation, getWalkForwardHistory, screenStocksFromEODHD, getWatchlistTickers } from '../analytics/walkForwardEngine';
import { saveCopilotRecommendations, getCopilotHistoryForPortfolio, getCopilotHistoryStats, evaluateRecommendations, markRecommendationAsApplied } from '../analytics/copilotHistory';
import { runLPPLFullBacktest, runLPPLCustomBacktest, KNOWN_BUBBLES, fitLPPLMultiScale, calculateBubbleConfidence } from '../analytics/lpplBacktest';
import { calcRiskMetrics } from '../analytics/engine';
import { userSettings } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import YahooFinance from 'yahoo-finance2';
import type { WalkForwardResult } from '../analytics/walkForwardEngine';

const yf = new YahooFinance();

// ============ Walk-Forward In-Memory State (Non-blocking) ============
let walkForwardRunning = false;
let walkForwardProgress: string[] = [];
let walkForwardResult: WalkForwardResult | null = null;
let walkForwardError: string | null = null;

// ============ LPPL Threshold DB Helpers ============
async function getLpplThresholdForUser(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 70; // default
  try {
    const rows = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
    if (rows.length > 0 && rows[0].lpplThreshold != null) {
      return rows[0].lpplThreshold;
    }
  } catch (e) { /* table might not exist yet */ }
  return 70; // default
}

async function saveLpplThresholdForUser(userId: number, threshold: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    // Upsert: try insert, on duplicate update
    await db.insert(userSettings).values({
      userId,
      lpplThreshold: threshold,
    }).onDuplicateKeyUpdate({
      set: { lpplThreshold: threshold },
    });
  } catch (e) {
    console.error('[CopilotRouter] Failed to save LPPL threshold:', e);
  }
}

/**
 * Get LPPL threshold for scheduled job (system-level, reads admin user or default)
 */
export async function getLpplThresholdForScheduledJob(): Promise<number> {
  const db = await getDb();
  if (!db) return 70;
  try {
    // Get the admin user's threshold (or first user with a setting)
    const rows = await db.select().from(userSettings).limit(1);
    if (rows.length > 0 && rows[0].lpplThreshold != null) {
      return rows[0].lpplThreshold;
    }
  } catch (e) { /* table might not exist yet */ }
  return 70;
}

function normalizeForYahoo(ticker: string): string {
  if (ticker.endsWith('.US')) return ticker.replace('.US', '');
  return ticker;
}

async function fetchHoldingData(ticker: string): Promise<{
  prices: number[];
  volumes: number[];
  currentPrice: number;
  currency: string;
  sector?: string;
  fundamentals: {
    peRatio?: number;
    pegRatio?: number;
    dividendYield?: number;
    beta?: number;
    marketCap?: number;
  };
}> {
  const yahooTicker = normalizeForYahoo(ticker);
  let resolvedTicker = yahooTicker;
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);

  let chart: any;
  try {
    chart = await (yf as any).chart(resolvedTicker, {
      period1: startDate.toISOString().split('T')[0],
      period2: endDate.toISOString().split('T')[0],
      interval: '1d',
    });
  } catch {
    if (!resolvedTicker.includes('.')) {
      resolvedTicker = resolvedTicker + '.SW';
      chart = await (yf as any).chart(resolvedTicker, {
        period1: startDate.toISOString().split('T')[0],
        period2: endDate.toISOString().split('T')[0],
        interval: '1d',
      });
    }
  }

  const quotes = chart?.quotes?.filter((q: any) => q.close != null) || [];
  const prices = quotes.map((q: any) => q.close as number);
  const volumes = quotes.map((q: any) => (q.volume as number) || 0);
  const currentPrice = prices.length > 0 ? prices[prices.length - 1] : 0;
  const currency = chart?.meta?.currency || 'USD';

  // Fetch fundamentals
  let fundamentals: any = {};
  let sector: string | undefined;
  try {
    const quote = await (yf as any).quoteSummary(resolvedTicker, {
      modules: ['defaultKeyStatistics', 'summaryDetail', 'assetProfile'],
    });
    fundamentals = {
      peRatio: quote?.summaryDetail?.trailingPE || quote?.defaultKeyStatistics?.forwardPE || undefined,
      pegRatio: quote?.defaultKeyStatistics?.pegRatio || undefined,
      dividendYield: (quote?.summaryDetail?.dividendYield || 0) * 100,
      beta: quote?.defaultKeyStatistics?.beta || 1,
      marketCap: quote?.summaryDetail?.marketCap || undefined,
    };
    sector = quote?.assetProfile?.sector || undefined;
  } catch {}

  return { prices, volumes, currentPrice, currency, sector, fundamentals };
}

export const copilotRouter = router({
  /**
   * Full copilot analysis for a portfolio
   */
  analyze: protectedProcedure
    .input(z.object({ portfolioId: z.number() }))
    .query(async ({ ctx, input }) => {
      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) {
        return { error: 'Portfolio nicht gefunden', analysis: null, explanation: null };
      }

      // Parse portfolioData from JSON string
      let stocks: any[] = [];
      try {
        const portfolioData = JSON.parse(portfolio.portfolioData || '{}');
        stocks = Array.isArray(portfolioData) ? portfolioData : (portfolioData.stocks || []);
      } catch (e) {
        stocks = [];
      }
      if (stocks.length === 0) {
        return { error: 'Portfolio enthält keine Aktien', analysis: null, explanation: null };
      }

      // Calculate total portfolio value for weights
      const totalValue = stocks.reduce((sum: number, s: any) => sum + (s.shares || 1) * (s.currentPrice || s.avgPrice || 100), 0);

      // Fetch data for all holdings in parallel (batches of 5)
      const holdings: PortfolioHolding[] = [];
      const batchSize = 5;
      
      for (let i = 0; i < stocks.length; i += batchSize) {
        const batch = stocks.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (stock: any) => {
            try {
              const data = await fetchHoldingData(stock.ticker);
              const value = (stock.shares || 1) * data.currentPrice;
              return {
                ticker: stock.ticker,
                companyName: stock.companyName || stock.name || stock.ticker,
                weight: totalValue > 0 ? value / totalValue : 1 / stocks.length,
                shares: parseFloat(stock.shares || '1'),
                currentPrice: data.currentPrice,
                currency: data.currency,
                sector: data.sector || stock.sector || 'Unknown',
                prices: data.prices,
                volumes: data.volumes,
                fundamentals: data.fundamentals,
              } as PortfolioHolding;
            } catch (err) {
              return {
                ticker: stock.ticker,
                companyName: stock.name || stock.ticker,
                weight: 1 / stocks.length,
                shares: stock.shares || 1,
                currentPrice: stock.currentPrice || stock.avgPrice || 0,
                currency: 'USD',
                prices: [],
                volumes: [],
                fundamentals: {},
              } as PortfolioHolding;
            }
          })
        );
        
        for (const result of results) {
          if (result.status === 'fulfilled') {
            holdings.push(result.value);
          }
        }
        
        // Small delay between batches
        if (i + batchSize < stocks.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      // Run copilot analysis
      const analysis = runCopilotAnalysis(holdings);

      // Override portfolioMetrics with the canonical calcRiskMetrics from analytics engine
      // This ensures consistency with the Risiko-Analyse page
      try {
        const holdingsForRisk = holdings
          .filter(h => h.ticker && h.weight > 0)
          .map(h => ({ ticker: h.ticker, weight: h.weight, currency: h.currency || 'USD' }));
        
        if (holdingsForRisk.length > 0) {
          const riskResult = await calcRiskMetrics({ holdings: holdingsForRisk, benchmark: 'SPY', lookbackDays: 252 });
          if (riskResult?.portfolio) {
            analysis.portfolioMetrics = {
              expectedReturn: riskResult.portfolio.annualReturn / 100, // convert from % to decimal
              expectedVolatility: riskResult.portfolio.volatility / 100, // convert from % to decimal
              sharpeRatio: riskResult.portfolio.sharpeRatio,
              maxDrawdownRisk: Math.abs(riskResult.portfolio.maxDrawdown) / 100, // convert from % to decimal
            };
          }
        }
      } catch (riskErr) {
        console.warn('[Copilot] calcRiskMetrics failed, using internal metrics:', riskErr);
        // Keep the original portfolioMetrics from runCopilotAnalysis as fallback
      }

      // Generate LLM explanation
      let explanation: string | null = null;
      try {
        explanation = await generateCopilotExplanation(analysis, (portfolio as any).name || 'Portfolio');
      } catch (err) {
        console.error('[Copilot] LLM explanation failed:', err);
        explanation = generateFallbackExplanation(analysis);
      }

      // === AUTO-SAVE to Copilot History ===
      try {
        const recommendations = analysis.rankings.map((r: any) => ({
          portfolioId: input.portfolioId,
          userId: ctx.user.id,
          ticker: r.ticker,
          companyName: r.companyName || r.ticker,
          signal: r.signal as 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell',
          rankScore: r.totalScore || 0,
          confidence: r.confidence || null,
          priceAtSignal: String(r.currentPrice || 0),
          currency: r.currency || 'USD',
          targetWeight: r.targetWeight ? String(r.targetWeight) : null,
          currentWeight: r.currentWeight ? String(r.currentWeight) : null,
          source: 'copilot_analysis' as const,
        }));
        const saved = await saveCopilotRecommendations(recommendations);
        console.log(`[Copilot] Auto-saved ${saved} recommendations to history`);
      } catch (histErr) {
        console.error('[Copilot] Failed to auto-save history:', histErr);
      }

      return { error: null, analysis, explanation };
    }),

  /**
   * Quick ranking only (faster, no LLM call)
   */
  quickRanking: protectedProcedure
    .input(z.object({ portfolioId: z.number() }))
    .query(async ({ ctx, input }) => {
      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) {
        return { error: 'Portfolio nicht gefunden', rankings: [] };
      }

      // Parse portfolioData from JSON string
      let stocks: any[] = [];
      try {
        const portfolioData = JSON.parse(portfolio.portfolioData || '{}');
        stocks = Array.isArray(portfolioData) ? portfolioData : (portfolioData.stocks || []);
      } catch (e) {
        stocks = [];
      }
      if (stocks.length === 0) {
        return { error: 'Portfolio enthält keine Aktien', rankings: [] };
      }

      const totalValue = stocks.reduce((sum: number, s: any) => sum + (s.shares || 1) * (s.currentPrice || s.avgPrice || 100), 0);

      const holdings: PortfolioHolding[] = [];
      const batchSize = 5;
      
      for (let i = 0; i < stocks.length; i += batchSize) {
        const batch = stocks.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (stock: any) => {
            try {
              const data = await fetchHoldingData(stock.ticker);
              const value = (stock.shares || 1) * data.currentPrice;
              return {
                ticker: stock.ticker,
                companyName: stock.companyName || stock.name || stock.ticker,
                weight: totalValue > 0 ? value / totalValue : 1 / stocks.length,
                shares: parseFloat(stock.shares || '1'),
                currentPrice: data.currentPrice,
                currency: data.currency,
                sector: data.sector || stock.sector || 'Unknown',
                prices: data.prices,
                volumes: data.volumes,
                fundamentals: data.fundamentals,
              } as PortfolioHolding;
            } catch {
              return null;
            }
          })
        );
        
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            holdings.push(result.value);
          }
        }
        
        if (i + batchSize < stocks.length) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      const rankings = calculateRankings(holdings);
      return { error: null, rankings };
    }),

  /**
   * Backtest: Simulate copilot rebalancing over the past 12 months
   * and compare performance vs. buy-and-hold
   */
  backtest: protectedProcedure
    .input(z.object({
      portfolioId: z.number(),
      months: z.number().min(3).max(36).optional().default(12),
      tradingCostBps: z.number().min(0).max(100).optional().default(10),
      maxTurnoverPerMonth: z.number().min(0.05).max(2).optional().default(0.30),
    }))
    .query(async ({ ctx, input }) => {
      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) {
        return { error: 'Portfolio nicht gefunden', result: null };
      }

      // Parse portfolio stocks
      let stocks: any[] = [];
      try {
        const portfolioData = JSON.parse(portfolio.portfolioData || '{}');
        stocks = Array.isArray(portfolioData) ? portfolioData : (portfolioData.stocks || []);
      } catch (e) {
        stocks = [];
      }
      if (stocks.length < 2) {
        return { error: 'Portfolio benötigt mindestens 2 Aktien für den Backtest', result: null };
      }

      const tickers = stocks.map((s: any) => s.ticker as string);

      // Fetch 18 months of historical daily prices for all tickers
      const totalDaysNeeded = (input.months + 6) * 22; // ~18 months of trading days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - (input.months + 7)); // Extra buffer

      const allPrices = new Map<string, Array<{ date: string; close: number }>>();

      // Fetch in batches of 5
      const batchSize = 5;
      for (let i = 0; i < tickers.length; i += batchSize) {
        const batch = tickers.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (ticker) => {
            const yahooTicker = normalizeForYahoo(ticker);
            let resolvedTicker = yahooTicker;
            let chart: any;

            try {
              chart = await (yf as any).chart(resolvedTicker, {
                period1: startDate.toISOString().split('T')[0],
                period2: endDate.toISOString().split('T')[0],
                interval: '1d',
              });
            } catch {
              // Try with .SW suffix for Swiss stocks
              if (!resolvedTicker.includes('.')) {
                resolvedTicker = resolvedTicker + '.SW';
                chart = await (yf as any).chart(resolvedTicker, {
                  period1: startDate.toISOString().split('T')[0],
                  period2: endDate.toISOString().split('T')[0],
                  interval: '1d',
                });
              }
            }

            const quotes = chart?.quotes?.filter((q: any) => q.close != null && q.date) || [];
            const priceData = quotes.map((q: any) => ({
              date: new Date(q.date).toISOString().split('T')[0],
              close: q.close as number,
            }));

            return { ticker, priceData };
          })
        );

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.priceData.length > 0) {
            allPrices.set(result.value.ticker, result.value.priceData);
          }
        }

        // Small delay between batches
        if (i + batchSize < tickers.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      // Run backtest
      try {
        const backtestResult = runCopilotBacktest(allPrices, tickers, {
          months: input.months,
          tradingCostBps: input.tradingCostBps,
          maxTurnoverPerMonth: input.maxTurnoverPerMonth,
        });
        return { error: null, result: backtestResult };
      } catch (err: any) {
        return { error: err.message || 'Backtest fehlgeschlagen', result: null };
      }
    }),

  // ============================================================
  // REBALANCING ACTIONS - Apply trades as real transactions
  // ============================================================
  applyRebalancing: protectedProcedure
    .input(z.object({
      portfolioId: z.number(),
      trades: z.array(z.object({
        ticker: z.string(),
        companyName: z.string().optional(),
        action: z.enum(['buy', 'sell']),
        shares: z.number().positive(),
        pricePerShare: z.number().positive(),
        currency: z.string().default('USD'),
        fxRate: z.number().optional(),
      })),
      saveToHistory: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) {
        return { error: 'Portfolio nicht gefunden', applied: 0 };
      }

      let applied = 0;
      const errors: string[] = [];

      for (const trade of input.trades) {
        try {
          const totalAmount = trade.shares * trade.pricePerShare;
          const fxRate = trade.fxRate || 1;
          const totalAmountCHF = totalAmount * fxRate;

          await createPortfolioTransaction({
            portfolioId: input.portfolioId,
            transactionType: trade.action,
            ticker: trade.ticker,
            shares: trade.shares.toString(),
            pricePerShare: trade.pricePerShare.toString(),
            currency: trade.currency,
            totalAmount: totalAmount.toFixed(2),
            fxRate: fxRate.toString(),
            totalAmountCHF: totalAmountCHF.toFixed(2),
            fees: '0',
            notes: `Copilot Rebalancing: ${trade.action} ${trade.shares} ${trade.ticker}`,
            transactionDate: new Date(),
          });
          applied++;
        } catch (err: any) {
          errors.push(`${trade.ticker}: ${err.message}`);
        }
      }

      // Save to history
      if (input.saveToHistory) {
        const recs = input.trades.map(trade => ({
          portfolioId: input.portfolioId,
          userId: ctx.user.id,
          ticker: trade.ticker,
          companyName: trade.companyName || trade.ticker,
          signal: trade.action === 'buy' ? 'buy' as const : 'sell' as const,
          rankScore: 0,
          priceAtSignal: trade.pricePerShare.toString(),
          currency: trade.currency,
          source: 'rebalancing' as const,
        }));
        await saveCopilotRecommendations(recs);
      }

      return { error: errors.length > 0 ? errors.join('; ') : null, applied, total: input.trades.length };
    }),

  // ============================================================
  // COPILOT HISTORY
  // ============================================================
  getHistory: protectedProcedure
    .input(z.object({
      portfolioId: z.number(),
      limit: z.number().optional().default(50),
    }))
    .query(async ({ ctx, input }) => {
      return getCopilotHistoryForPortfolio(input.portfolioId, ctx.user.id, input.limit);
    }),

  getHistoryStats: protectedProcedure
    .input(z.object({
      portfolioId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return getCopilotHistoryStats(ctx.user.id, input.portfolioId);
    }),

  evaluateHistory: protectedProcedure
    .mutation(async () => {
      return evaluateRecommendations();
    }),

  // ============================================================
  // WALK-FORWARD VALIDATION (Non-blocking with progress)
  // ============================================================
  startWalkForward: protectedProcedure
    .input(z.object({
      universeSource: z.enum(['watchlist', 'screener', 'combined']),
      trainWindowMonths: z.number().min(3).max(12).default(6),
      testWindowMonths: z.number().min(1).max(3).default(1),
      topQuartilePercent: z.number().min(10).max(50).default(25),
      strategyProfile: z.enum(['shortTerm', 'midTerm', 'longTerm']).optional(),
      screeningCriteria: z.object({
        region: z.string().optional(),
        exchange: z.string().optional(),
        sector: z.string().optional(),
        minMarketCap: z.number().optional(),
        maxMarketCap: z.number().optional(),
        minScore: z.number().optional(),
        targetSharpe: z.number().optional(),
        maxTickers: z.number().optional().default(100),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (walkForwardRunning) {
        return { error: 'Walk-Forward läuft bereits. Bitte warten.', started: false };
      }

      // Start non-blocking
      walkForwardRunning = true;
      walkForwardProgress = ['Walk-Forward gestartet...'];
      walkForwardResult = null;
      walkForwardError = null;

      (async () => {
        try {
          const result = await runWalkForwardValidation({
            trainWindowMonths: input.trainWindowMonths,
            testWindowMonths: input.testWindowMonths,
            topQuartilePercent: input.topQuartilePercent,
            universeSource: input.universeSource,
            screeningCriteria: input.screeningCriteria,
            strategyProfile: input.strategyProfile,
          }, ctx.user.id, (msg: string) => {
            walkForwardProgress.push(msg);
            if (walkForwardProgress.length > 100) {
              walkForwardProgress = walkForwardProgress.slice(-100);
            }
          });
          walkForwardResult = result;
          walkForwardProgress.push('✅ Walk-Forward abgeschlossen!');
        } catch (err: any) {
          walkForwardError = err.message || 'Walk-Forward fehlgeschlagen';
          walkForwardProgress.push(`❌ Fehler: ${err.message}`);
        } finally {
          walkForwardRunning = false;
        }
      })();

      return { error: null, started: true };
    }),

  getWalkForwardStatus: protectedProcedure
    .query(async () => {
      return {
        isRunning: walkForwardRunning,
        progress: walkForwardProgress,
        result: walkForwardResult,
        error: walkForwardError,
      };
    }),

  getWalkForwardHistory: protectedProcedure
    .query(async ({ ctx }) => {
      return getWalkForwardHistory(ctx.user.id);
    }),

  // ============================================================
  // LPPL THRESHOLD SETTINGS (Server-side persistence)
  // ============================================================
  getLpplThreshold: protectedProcedure
    .query(async ({ ctx }) => {
      return getLpplThresholdForUser(ctx.user.id);
    }),

  setLpplThreshold: protectedProcedure
    .input(z.object({ threshold: z.number().min(50).max(95) }))
    .mutation(async ({ ctx, input }) => {
      await saveLpplThresholdForUser(ctx.user.id, input.threshold);
      return { success: true, threshold: input.threshold };
    }),

  // ============================================================
  // LPPL BUBBLE INDICATOR BACKTEST
  // ============================================================
  runLpplBacktest: protectedProcedure
    .mutation(async () => {
      try {
        const result = await runLPPLFullBacktest();
        return { error: null, result };
      } catch (err: any) {
        return { error: err.message || 'LPPL Backtest fehlgeschlagen', result: null };
      }
    }),

  runLpplCustom: protectedProcedure
    .input(z.object({
      ticker: z.string(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ input }) => {
      try {
        const signals = await runLPPLCustomBacktest(input.ticker, input.startDate, input.endDate);
        return { error: null, signals };
      } catch (err: any) {
        return { error: err.message || 'LPPL Custom Backtest fehlgeschlagen', signals: [] };
      }
    }),

  getLpplBubblePeriods: protectedProcedure
    .query(() => {
      return KNOWN_BUBBLES;
    }),

  // ============================================================
  // LIVE LPPL CHECK (Echtzeit Bubble-Score für S&P 500 + NASDAQ)
  // ============================================================
  liveLpplCheck: protectedProcedure
    .mutation(async () => {
      const indices = [
        { ticker: '^GSPC', name: 'S&P 500' },
        { ticker: '^IXIC', name: 'NASDAQ Composite' },
      ];

      const results: Array<{
        ticker: string;
        name: string;
        currentPrice: number;
        bubbleConfidence: number;
        regime: 'bubble' | 'normal' | 'crash';
        predictedCrashDate: string | null;
        daysToPredict: number | null;
        fitQuality: number | null;
        priceChange30d: number;
        priceChange90d: number;
        analysisDate: string;
        windowsAnalyzed: number;
        validFits: number;
      }> = [];

      for (const idx of indices) {
        try {
          // Fetch last 12 months of data for multi-scale analysis
          const endDate = new Date();
          const startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 12);

          const chartResult: any = await yf.chart(idx.ticker, {
            period1: startDate.toISOString().split('T')[0],
            period2: endDate.toISOString().split('T')[0],
            interval: '1d'
          });

          if (!chartResult?.quotes || chartResult.quotes.length < 60) {
            results.push({
              ticker: idx.ticker,
              name: idx.name,
              currentPrice: 0,
              bubbleConfidence: 0,
              regime: 'normal',
              predictedCrashDate: null,
              daysToPredict: null,
              fitQuality: null,
              priceChange30d: 0,
              priceChange90d: 0,
              analysisDate: new Date().toISOString().split('T')[0],
              windowsAnalyzed: 0,
              validFits: 0,
            });
            continue;
          }

          const prices = chartResult.quotes
            .filter((q: any) => q.close != null && q.date != null)
            .map((q: any) => ({
              date: new Date(q.date).toISOString().split('T')[0],
              close: q.close as number
            }));

          const currentPrice = prices[prices.length - 1].close;

          // Calculate price changes
          const price30dAgo = prices.length >= 22 ? prices[prices.length - 22].close : prices[0].close;
          const price90dAgo = prices.length >= 66 ? prices[prices.length - 66].close : prices[0].close;
          const priceChange30d = ((currentPrice - price30dAgo) / price30dAgo) * 100;
          const priceChange90d = ((currentPrice - price90dAgo) / price90dAgo) * 100;

          // Run multi-scale LPPL fitting
          const fitResult = fitLPPLMultiScale(prices, [60, 90, 120, 180]);
          const confidence = calculateBubbleConfidence(fitResult, prices);

          // Determine regime
          let regime: 'bubble' | 'normal' | 'crash' = 'normal';
          if (confidence >= 45) regime = 'bubble';
          // Check for recent crash (>10% drop in last 20 days)
          if (prices.length >= 20) {
            const recent20 = prices.slice(-20);
            const maxRecent = Math.max(...recent20.map((p: any) => p.close));
            if ((currentPrice - maxRecent) / maxRecent < -0.10) {
              regime = 'crash';
            }
          }

          // Predict crash date
          let predictedCrashDate: string | null = null;
          let daysToPredict: number | null = null;
          if (fitResult.bestFit && confidence >= 40) {
            const params = fitResult.bestFit.params;
            const effectiveWindow = Math.min(prices.length, 180);
            const daysToTc = Math.round((params.tc - 1) * effectiveWindow);
            if (daysToTc > 0 && daysToTc < 365) {
              const crashDate = new Date();
              crashDate.setDate(crashDate.getDate() + daysToTc);
              predictedCrashDate = crashDate.toISOString().split('T')[0];
              daysToPredict = daysToTc;
            }
          }

          results.push({
            ticker: idx.ticker,
            name: idx.name,
            currentPrice,
            bubbleConfidence: confidence,
            regime,
            predictedCrashDate,
            daysToPredict,
            fitQuality: fitResult.bestFit?.r2 ?? null,
            priceChange30d,
            priceChange90d,
            analysisDate: new Date().toISOString().split('T')[0],
            windowsAnalyzed: fitResult.totalAttempts,
            validFits: fitResult.validFitCount,
          });

          // Rate limiting between Yahoo Finance calls
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error: any) {
          console.error(`[LiveLPPL] Error checking ${idx.name}:`, error.message);
          results.push({
            ticker: idx.ticker,
            name: idx.name,
            currentPrice: 0,
            bubbleConfidence: 0,
            regime: 'normal',
            predictedCrashDate: null,
            daysToPredict: null,
            fitQuality: null,
            priceChange30d: 0,
            priceChange90d: 0,
            analysisDate: new Date().toISOString().split('T')[0],
            windowsAnalyzed: 0,
            validFits: 0,
          });
        }
      }

      return { results, checkedAt: new Date().toISOString() };
    }),

  getLatestWeeklyReview: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return null;
      try {
        const [rows] = await (db as any).execute(
          `SELECT settingValue FROM userSettings WHERE settingKey = 'weeklyReview' LIMIT 1`
        );
        if (!rows || rows.length === 0) return null;
        return JSON.parse(rows[0].settingValue || '{}');
      } catch {
        return null;
      }
    }),
});

// ============================================================
// LLM EXPLANATION GENERATION
// ============================================================

async function generateCopilotExplanation(analysis: CopilotAnalysis, portfolioName: string): Promise<string> {
  const { rankings, rebalancingSuggestions, warnings, diversificationScore, portfolioMetrics } = analysis;

  const topRanked = rankings.slice(0, 3).map(r => `${r.companyName} (Score ${r.rankScore}, ${r.signal})`).join(', ');
  const bottomRanked = rankings.slice(-3).map(r => `${r.companyName} (Score ${r.rankScore}, ${r.signal})`).join(', ');
  const actionItems = rebalancingSuggestions.filter(s => s.action !== 'hold');
  const highWarnings = warnings.filter(w => w.severity === 'high');

  const prompt = `Du bist ein erfahrener Portfolio-Analyst. Erstelle eine kurze, prägnante Zusammenfassung (max. 200 Wörter) der folgenden Portfolio-Analyse für "${portfolioName}".

DATEN:
- Erwartete Rendite: ${(portfolioMetrics.expectedReturn * 100).toFixed(1)}% p.a.
- Erwartete Volatilität: ${(portfolioMetrics.expectedVolatility * 100).toFixed(1)}% p.a.
- Sharpe Ratio: ${portfolioMetrics.sharpeRatio}
- Max Drawdown-Risiko: ${(portfolioMetrics.maxDrawdownRisk * 100).toFixed(1)}%
- Diversifikations-Score: ${diversificationScore.overall}/100

TOP-POSITIONEN: ${topRanked}
SCHWÄCHSTE POSITIONEN: ${bottomRanked}

HANDLUNGSEMPFEHLUNGEN: ${actionItems.length} Umschichtungen vorgeschlagen
${actionItems.slice(0, 5).map(a => `- ${a.companyName}: ${a.action === 'increase' ? 'Aufstocken' : a.action === 'decrease' ? 'Reduzieren' : 'Verkaufen'} (${(a.delta * 100).toFixed(1)}pp)`).join('\n')}

WARNUNGEN: ${highWarnings.length} kritische
${highWarnings.slice(0, 3).map(w => `- ${w.title}: ${w.description}`).join('\n')}

Schreibe die Zusammenfassung auf Deutsch. Strukturiere sie in: 1) Gesamteinschätzung (1-2 Sätze), 2) Stärken, 3) Schwächen/Risiken, 4) Empfohlene Massnahmen. Verwende keine Markdown-Formatierung, nur Fliesstext mit Absätzen.`;

  const result = await invokeLLM({
    messages: [
      { role: 'system', content: 'Du bist ein Schweizer Portfolio-Analyst der prägnante, faktenbasierte Zusammenfassungen schreibt. Antworte immer auf Deutsch.' },
      { role: 'user', content: prompt },
    ],
    maxTokens: 500,
  });

  const content = result.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
  }
  return generateFallbackExplanation(analysis);
}

function generateFallbackExplanation(analysis: CopilotAnalysis): string {
  const { rankings, warnings, diversificationScore, portfolioMetrics } = analysis;
  
  const topTickers = rankings.slice(0, 3).map(r => r.companyName).join(', ');
  const bottomTickers = rankings.slice(-2).map(r => r.companyName).join(', ');
  const highWarnings = warnings.filter(w => w.severity === 'high');

  let text = `Gesamteinschätzung: Das Portfolio zeigt eine erwartete Rendite von ${(portfolioMetrics.expectedReturn * 100).toFixed(1)}% bei ${(portfolioMetrics.expectedVolatility * 100).toFixed(1)}% Volatilität (Sharpe ${portfolioMetrics.sharpeRatio}). Der Diversifikations-Score liegt bei ${diversificationScore.overall}/100.\n\n`;
  
  text += `Stärken: Die Top-Positionen ${topTickers} zeigen starke relative Attraktivität mit hohem Momentum und gutem Chance/Risiko-Verhältnis.\n\n`;
  
  if (bottomTickers) {
    text += `Schwächen: ${bottomTickers} zeigen schwächere relative Performance und könnten von einer Umschichtung profitieren.\n\n`;
  }
  
  if (highWarnings.length > 0) {
    text += `Risiken: ${highWarnings.map(w => w.title).join('; ')}.\n\n`;
  }
  
  text += `Empfehlung: ${rankings.filter(r => r.signal === 'strong_buy' || r.signal === 'buy').length} Positionen aufstocken, ${rankings.filter(r => r.signal === 'sell' || r.signal === 'strong_sell').length} reduzieren. Max. Drawdown-Risiko: ${(portfolioMetrics.maxDrawdownRisk * 100).toFixed(1)}%.`;

  return text;
}
