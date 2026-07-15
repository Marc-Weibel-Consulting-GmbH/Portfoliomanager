/**
 * Portfolio Copilot Router
 * ========================
 * tRPC endpoints for the ML Portfolio Copilot feature.
 * Provides ranking, rebalancing, warnings, and AI-generated explanations.
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { invokeLLM } from '../_core/llm';
import { getResearchContextForLLM } from '../helpers/researchContext';
import { getSavedPortfolioById, getPortfolioTransactions, createPortfolioTransaction, getDb } from '../db';
import { tryConvertToCHF } from '../fxHelper';
import {
  runCopilotAnalysis,
  calculateRankings,
  calculateDiversificationScore,
  type CopilotAnalysis,
} from '../analytics/portfolioCopilot';
import { runCopilotBacktest } from '../analytics/copilotBacktest';
import { buildHoldingsEodhd } from '../lib/copilotHoldings';
import { runWalkForwardValidation, getWalkForwardHistory, screenStocksFromEODHD, getWatchlistTickers } from '../analytics/walkForwardEngine';
import { saveCopilotRecommendations, getCopilotHistoryForPortfolio, getCopilotHistoryStats, evaluateRecommendations, markRecommendationAsApplied } from '../analytics/copilotHistory';
import { runLPPLFullBacktest, runLPPLCustomBacktest, KNOWN_BUBBLES, fitLPPLMultiScale, calculateBubbleConfidence } from '../analytics/lpplBacktest';
import { calcRiskMetrics } from '../analytics/engine';
import { fetchEODHDFundamentals, type EODHDFundamentals } from '../_core/eodhdApi';
import { userSettings, lpplResults } from '../../drizzle/schema';
import { eq, desc, gte } from 'drizzle-orm';
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

/** Letzter Schlusskurs + Quote-Währung eines Tickers (leichtgewichtig, 14-Tage-Fenster). */
async function fetchLastCloseWithCurrency(
  ticker: string
): Promise<{ price: number; currency: string } | null> {
  try {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 14 * 86400000);
    const chart: any = await (yf as any).chart(normalizeForYahoo(ticker), {
      period1: startDate.toISOString().split('T')[0],
      period2: endDate.toISOString().split('T')[0],
      interval: '1d',
    });
    const quotes = chart?.quotes?.filter((q: any) => q.close != null) || [];
    if (quotes.length === 0) return null;
    return {
      price: quotes[quotes.length - 1].close as number,
      currency: chart?.meta?.currency || 'USD',
    };
  } catch {
    return null;
  }
}

type RebalancingTrade = {
  ticker: string;
  companyName?: string;
  action: 'buy' | 'sell';
  shares: number;
  pricePerShare: number;
  currency: string;
  fxRate?: number;
};

/**
 * R-36: echte Stückzahlen serverseitig ableiten statt `shares: 1`-Platzhalter.
 * shares = floor(|targetWeight × totalValueCHF − currentValueCHF| / priceCHF);
 * positive Differenz → buy, negative → sell. Ticker ohne Kurs oder ohne
 * FX-Kurs (tryConvertToCHF → null, kein stilles 1:1) werden mit Fehlermeldung
 * übersprungen.
 */
async function deriveTradesFromTargetWeights(
  portfolioId: number,
  targets: Array<{ ticker: string; companyName?: string; targetWeight: number }>,
  errors: string[]
): Promise<RebalancingTrade[]> {
  const today = new Date().toISOString().split('T')[0];

  // Ist-Bestand aus Transaktionen (buy/entry +, sell −)
  const txs = await getPortfolioTransactions(portfolioId);
  const sharesByTicker: Record<string, number> = {};
  for (const tx of txs as any[]) {
    if (!tx.ticker) continue;
    const sh = parseFloat(tx.shares || '0');
    if (!Number.isFinite(sh) || sh === 0) continue;
    if (tx.transactionType === 'buy' || tx.transactionType === 'entry') {
      sharesByTicker[tx.ticker] = (sharesByTicker[tx.ticker] || 0) + sh;
    } else if (tx.transactionType === 'sell') {
      sharesByTicker[tx.ticker] = (sharesByTicker[tx.ticker] || 0) - sh;
    }
  }

  // Kurse in CHF für alle beteiligten Ticker (Bestand + Ziele)
  const allTickers = Array.from(new Set([
    ...Object.keys(sharesByTicker).filter((t) => sharesByTicker[t] > 0),
    ...targets.map((t) => t.ticker),
  ]));
  const priceInfo: Record<string, { price: number; currency: string; priceCHF: number }> = {};
  for (const ticker of allTickers) {
    const quote = await fetchLastCloseWithCurrency(ticker);
    if (!quote || quote.price <= 0) {
      errors.push(`${ticker}: kein aktueller Kurs verfügbar — übersprungen`);
      continue;
    }
    const priceCHF = await tryConvertToCHF(quote.price, quote.currency, today);
    if (priceCHF === null || priceCHF <= 0) {
      errors.push(`${ticker}: kein FX-Kurs ${quote.currency}CHF verfügbar — übersprungen`);
      continue;
    }
    priceInfo[ticker] = { price: quote.price, currency: quote.currency, priceCHF };
  }

  // Gesamtwert des Portfolios in CHF (nur bewertbare Positionen)
  let totalValueCHF = 0;
  for (const [ticker, sh] of Object.entries(sharesByTicker)) {
    if (sh > 0 && priceInfo[ticker]) totalValueCHF += sh * priceInfo[ticker].priceCHF;
  }
  if (totalValueCHF <= 0) {
    errors.push('Portfoliowert CHF 0 — keine Trades ableitbar');
    return [];
  }

  const trades: RebalancingTrade[] = [];
  for (const target of targets) {
    const info = priceInfo[target.ticker];
    if (!info) continue; // bereits als Fehler vermerkt
    const currentValueCHF = (sharesByTicker[target.ticker] || 0) * info.priceCHF;
    const deltaCHF = target.targetWeight * totalValueCHF - currentValueCHF;
    // Abrunden Richtung 0: nie mehr kaufen/verkaufen als die Zielgewichtung verlangt
    const qty = Math.floor(Math.abs(deltaCHF) / info.priceCHF);
    if (qty <= 0) continue;
    trades.push({
      ticker: target.ticker,
      companyName: target.companyName,
      action: deltaCHF > 0 ? 'buy' : 'sell',
      shares: qty,
      pricePerShare: info.price,
      currency: info.currency,
      fxRate: info.priceCHF / info.price,
    });
  }
  return trades;
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

      // Holdings ausschliesslich aus EODHD (Kurse + Fundamentaldaten + Währung);
      // Yahoo ist in der Produktion blockiert. Titel ohne Kursreihe erhalten weight 0
      // und werden aus der Risiko-/Analyse-Berechnung gefiltert (keine Platzhalter).
      const holdings = await buildHoldingsEodhd(stocks);

      // Signal-Cache laden für Konsistenz mit Signale-Tab
      const signalCacheMap = new Map<string, { combinedScore: number | null; signalType: string | null; signalStrength: string | null }>();
      try {
        const { stockSignalCache } = await import('../../drizzle/schema');
        const { inArray } = await import('drizzle-orm');
        const db = await getDb();
        const allTickers = holdings.map(h => h.ticker);
        if (db && allTickers.length > 0) {
          const cacheRows = await db.select().from(stockSignalCache).where(inArray(stockSignalCache.ticker, allTickers));
          for (const row of cacheRows) {
            signalCacheMap.set(row.ticker, {
              combinedScore: row.combinedScore ? parseFloat(row.combinedScore as string) : null,
              signalType: row.signalType ?? null,
              signalStrength: row.signalStrength ?? null,
            });
          }
        }
      } catch (e) { console.warn('[Copilot] Signal-Cache nicht verfügbar:', e); }

      // Run copilot analysis
      const analysis = await runCopilotAnalysis(holdings);

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

      // Signal-Cache-Scores in rebalancingSuggestions integrieren für Konsistenz mit Signale-Tab
      analysis.rebalancingSuggestions = analysis.rebalancingSuggestions.map(s => {
        const sc = signalCacheMap.get(s.ticker);
        if (!sc) return s;
        const score = sc.combinedScore;
        const sigType = sc.signalType;
        const sigStrength = sc.signalStrength;

        // Signal-Typ-Label
        const sigLabel = sigType === 'buy' ? 'KAUF' : sigType === 'sell' ? 'VERKAUF' : 'HALTEN';
        const scoreStr = score != null ? ` (Signal-Score ${Math.round(score)}/100)` : '';
        const strengthStr = sigStrength === 'strong' ? 'Starkes ' : sigStrength === 'weak' ? 'Schwaches ' : '';

        // Aktion basierend auf Signal-Cache erzwingen:
        // VERKAUF/SELL -> nur decrease/exit erlaubt
        // KAUF/BUY -> increase erlaubt
        // HALTEN -> hold oder decrease (kein increase)
        let action = s.action;
        let reason = s.reason;

        if (score !== null) {
          if (score >= 60 || sigType === 'buy') {
            // Gutes Signal: Empfehlung beibehalten
            reason = `${strengthStr}${sigLabel}-Signal${scoreStr}. ${s.reason.replace(/Ranking-Score \d+\/100[^.]*\.?\s*/g, '').replace(/Starkes Verkaufssignal[^.]*\.?\s*/g, '').trim()}`;
          } else if (score <= 40 || sigType === 'sell') {
            // Verkaufssignal: increase -> decrease
            if (action === 'increase') action = 'decrease';
            reason = `${strengthStr}${sigLabel}-Signal${scoreStr}. ${s.reason.replace(/Ranking-Score \d+\/100[^.]*\.?\s*/g, '').trim()}`;
          } else {
            // Halten: increase -> hold
            if (action === 'increase') action = 'hold';
            reason = `${sigLabel}-Signal${scoreStr}. Kein Handlungsbedarf.`;
          }
        }

        return { ...s, action, reason };
      }).filter(s => s.action !== 'hold'); // hold-Einträge aus Liste entfernen

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

      // Holdings ausschliesslich aus EODHD (siehe analyze — Yahoo in Prod blockiert).
      const holdings = await buildHoldingsEodhd(stocks);

      const rankings = await calculateRankings(holdings);
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
        const backtestResult = await runCopilotBacktest(allPrices, tickers, {
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
      // Legacy path: explicit trades (back-compat, R-36 — new clients send
      // targetWeights instead and let the server derive real share counts).
      trades: z.array(z.object({
        ticker: z.string(),
        companyName: z.string().optional(),
        action: z.enum(['buy', 'sell']),
        shares: z.number().positive(),
        pricePerShare: z.number().positive(),
        currency: z.string().default('USD'),
        fxRate: z.number().optional(),
      })).optional(),
      // R-36: target weights (fractions, 0–1); the server computes
      // shares = floor(|targetWeight × totalValueCHF − currentValueCHF| / priceCHF).
      targetWeights: z.array(z.object({
        ticker: z.string(),
        companyName: z.string().optional(),
        targetWeight: z.number().min(0).max(1),
      })).optional(),
      saveToHistory: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) {
        return { error: 'Portfolio nicht gefunden', applied: 0, total: 0 };
      }

      let applied = 0;
      const errors: string[] = [];

      let trades = input.trades ?? [];
      if (input.targetWeights && input.targetWeights.length > 0) {
        const derived = await deriveTradesFromTargetWeights(
          input.portfolioId,
          input.targetWeights,
          errors
        );
        trades = derived;
      } else if (!input.trades) {
        return { error: 'Weder trades noch targetWeights übergeben', applied: 0, total: 0 };
      }

      for (const trade of trades) {
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
      if (input.saveToHistory && trades.length > 0) {
        const recs = trades.map(trade => ({
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

      return { error: errors.length > 0 ? errors.join('; ') : null, applied, total: trades.length };
    }),

  // ============================================================
  // COPILOT HISTORY
  // ============================================================
  getHistory: protectedProcedure
    .input(z.object({
      portfolioId: z.number().optional(),
      limit: z.number().optional().default(50),
    }).optional().default({ limit: 50 }))
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
      quickMode: z.boolean().optional().default(false),
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
            quickMode: input.quickMode,
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

      // Persist results to DB
      try {
        const db = await getDb();
        if (db) {
          for (const r of results) {
            if (r.currentPrice > 0) {
              let wl: string = 'none';
              if (r.bubbleConfidence >= 70) wl = 'high';
              else if (r.bubbleConfidence >= 45) wl = 'medium';
              else if (r.bubbleConfidence >= 25) wl = 'low';
              await db.insert(lpplResults).values({
                indexSymbol: r.ticker,
                indexName: r.name,
                bubbleConfidence: r.bubbleConfidence,
                fitR2: r.fitQuality?.toFixed(3) ?? null,
                currentPrice: r.currentPrice.toFixed(2),
                predictedTurningPoint: r.predictedCrashDate ?? null,
                momentum30d: r.priceChange30d.toFixed(2),
                momentum90d: r.priceChange90d.toFixed(2),
                validFits: r.validFits,
                totalCombinations: r.windowsAnalyzed,
                warningLevel: wl,
              });
            }
          }
        }
      } catch (e: any) {
        console.error('[LiveLPPL] DB persist error:', e.message);
      }

      return { results, checkedAt: new Date().toISOString() };
    }),

  // LPPL History (Trend-Daten aus DB)
  // ============================================================
  lpplHistory: protectedProcedure
    .input(z.object({
      days: z.number().min(7).max(365).default(90),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { history: [] };
      const days = input?.days ?? 90;
      const since = new Date();
      since.setDate(since.getDate() - days);
      try {
        const rows = await db.select().from(lpplResults)
          .where(gte(lpplResults.checkedAt, since))
          .orderBy(lpplResults.checkedAt);
        return { history: rows };
      } catch (e: any) {
        console.error('[LPPL History] Error:', e.message);
        return { history: [] };
      }
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

  /**
   * Portfolio Deep-Dive: EODHD-Fundamentaldaten + KI-Zusammenfassung
   */
  portfolioDeepDive: protectedProcedure
    .input(z.object({ portfolioId: z.number() }))
    .query(async ({ ctx, input }) => {
      const portfolio = await getSavedPortfolioById(input.portfolioId, ctx.user.id);
      if (!portfolio) throw new Error('Portfolio nicht gefunden');

      let stocks: any[] = [];
      try {
        const portfolioData = JSON.parse(portfolio.portfolioData || '{}');
        stocks = Array.isArray(portfolioData) ? portfolioData : (portfolioData.stocks || []);
      } catch { stocks = []; }

      // Deduplicate by ticker: merge shares and keep first entry's metadata
      // This prevents the same stock (e.g. RO.SW) from appearing multiple times
      // when portfolioData has duplicate entries from multiple buy transactions.
      const tickerMap = new Map<string, any>();
      for (const s of stocks) {
        if (!s.ticker) continue;
        const key = s.ticker.toUpperCase();
        if (tickerMap.has(key)) {
          // Accumulate shares
          const existing = tickerMap.get(key);
          existing.shares = (parseFloat(existing.shares || '0') + parseFloat(s.shares || '0'));
        } else {
          tickerMap.set(key, { ...s, shares: parseFloat(s.shares || '0') });
        }
      }
      stocks = Array.from(tickerMap.values());

      if (stocks.length === 0) return { error: 'Keine Positionen im Portfolio', holdings: [], sectorBreakdown: [], portfolioMetrics: null, topDividend: [], highBeta: [], aiSummary: null };

      // Prefer explicit weight field (set at portfolio creation time) over shares×price calculation.
      // shares×price can be misleading after transactions because avgPrice reflects purchase price,
      // not current market price, leading to distorted sector weights (e.g. SON.LS at 58.9%).
      const hasExplicitWeights = stocks.some((s: any) => s.weight !== undefined && s.weight !== null && parseFloat(s.weight) > 0);
      const totalValue = hasExplicitWeights
        ? 100 // weights are already in percent, totalValue=100 makes weight = s.weight directly
        : stocks.reduce((sum: number, s: any) =>
            sum + (s.shares || 1) * (s.currentPrice || s.avgPrice || 100), 0);

      // Fetch EODHD fundamentals in parallel batches of 4
      const fundamentalsMap: Record<string, EODHDFundamentals> = {};
      const batchSize = 4;
      for (let i = 0; i < stocks.length; i += batchSize) {
        const batch = stocks.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (s: any) => ({ ticker: s.ticker, f: await fetchEODHDFundamentals(s.ticker) }))
        );
        for (const r of results) {
          if (r.status === 'fulfilled') fundamentalsMap[r.value.ticker] = r.value.f;
        }
        if (i + batchSize < stocks.length) await new Promise(res => setTimeout(res, 250));
      }

      // Build enriched holdings
      const holdings = stocks.map((s: any) => {
        const value = hasExplicitWeights
          ? parseFloat(s.weight || '0') // weight is already in percent (e.g. 8.9 = 8.9%)
          : (s.shares || 1) * (s.currentPrice || s.avgPrice || 100);
        const weight = hasExplicitWeights
          ? Math.round(parseFloat(s.weight || '0') * 10) / 10 // already a percentage
          : (totalValue > 0 ? Math.round((value / totalValue) * 1000) / 10 : Math.round(1000 / stocks.length) / 10);
        const f = fundamentalsMap[s.ticker] || {} as EODHDFundamentals;
        return {
          ticker: s.ticker,
          name: f.companyName || s.companyName || s.name || s.ticker,
          weight,
          value: Math.round(value * 100) / 100,
          sector: f.sector || s.sector || 'Unbekannt',
          industry: f.industry || null,
          peRatio: f.peRatio !== null ? Math.round((f.peRatio ?? 0) * 10) / 10 : null,
          pegRatio: f.pegRatio !== null ? Math.round((f.pegRatio ?? 0) * 100) / 100 : null,
          // Treat 0% dividend yield as null so it sorts to the end (non-payers)
          dividendYield: (f.dividendYield !== null && (f.dividendYield ?? 0) > 0) ? Math.round((f.dividendYield ?? 0) * 10) / 10 : null,
          beta: f.beta !== null ? Math.round((f.beta ?? 0) * 100) / 100 : null,
          eps: f.eps,
          marketCap: f.marketCap,
          earningsGrowth: f.earningsGrowth !== null ? Math.round((f.earningsGrowth ?? 0) * 1000) / 10 : null,
        };
      });

      // Sector breakdown
      const sectorMap: Record<string, { weight: number; count: number; tickers: string[] }> = {};
      for (const h of holdings) {
        const sec = h.sector;
        if (!sectorMap[sec]) sectorMap[sec] = { weight: 0, count: 0, tickers: [] };
        sectorMap[sec].weight += h.weight;
        sectorMap[sec].count++;
        sectorMap[sec].tickers.push(h.ticker);
      }
      const sectorBreakdown = Object.entries(sectorMap)
        .map(([sector, d]) => ({ sector, weight: Math.round(d.weight * 10) / 10, count: d.count, tickers: d.tickers }))
        .sort((a, b) => b.weight - a.weight);

      // Weighted average helper
      const wavg = (field: keyof typeof holdings[0]) => {
        const valid = holdings.filter(h => h[field] !== null && h[field] !== undefined);
        if (!valid.length) return null;
        const tw = valid.reduce((s, h) => s + h.weight, 0);
        return tw > 0 ? Math.round(valid.reduce((s, h) => s + (h[field] as number) * h.weight, 0) / tw * 100) / 100 : null;
      };

      const portfolioMetrics = {
        avgPE: wavg('peRatio'),
        avgPEG: wavg('pegRatio'),
        avgBeta: wavg('beta'),
        avgDividendYield: wavg('dividendYield'),
        avgEarningsGrowth: wavg('earningsGrowth'),
        totalValue,
        positionCount: holdings.length,
      };

      const topDividend = [...holdings]
        .filter(h => h.dividendYield !== null && (h.dividendYield as number) > 0)
        .sort((a, b) => (b.dividendYield as number) - (a.dividendYield as number))
        .slice(0, 5)
        .map(h => ({ ticker: h.ticker, name: h.name, yield: h.dividendYield }));

      const highBeta = [...holdings]
        .filter(h => h.beta !== null)
        .sort((a, b) => Math.abs(b.beta as number) - Math.abs(a.beta as number))
        .slice(0, 5)
        .map(h => ({ ticker: h.ticker, name: h.name, beta: h.beta }));

      // AI summary
      let aiSummary: string | null = null;
      try {
        const topSectors = sectorBreakdown.slice(0, 3).map(s => `${s.sector} (${s.weight.toFixed(1)}%)`).join(', ');
        const prompt = `Erstelle eine pr\u00e4zise Portfolio-Zusammenfassung auf Deutsch (max. 180 W\u00f6rter):\n\nPortfolio: ${(portfolio as any).name}\nPositionen: ${portfolioMetrics.positionCount}\nTop-Sektoren: ${topSectors}\nDurchschn. KGV: ${portfolioMetrics.avgPE ?? 'n/a'}\nDurchschn. PEG: ${portfolioMetrics.avgPEG ?? 'n/a'}\nDurchschn. Beta: ${portfolioMetrics.avgBeta ?? 'n/a'}\nDurchschn. Dividendenrendite: ${portfolioMetrics.avgDividendYield ?? 'n/a'}%\nDurchschn. Gewinnwachstum: ${portfolioMetrics.avgEarningsGrowth ?? 'n/a'}%\n\nBewerte: Ist das Portfolio g\u00fcnstig oder teuer bewertet? Defensiv oder aggressiv? Dividendenst\u00e4rke? Gib 2 konkrete Handlungsempfehlungen.`;
        // Inject research context into AI recommendations
        const researchCtx = await getResearchContextForLLM();
        const systemContent = 'Du bist ein erfahrener Schweizer Portfoliomanager. Antworte pr\u00e4zise auf Deutsch.' + researchCtx.contextString;
        const response = await invokeLLM({
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: prompt },
          ],
        });
        const content = response?.choices?.[0]?.message?.content;
        aiSummary = typeof content === 'string' ? content : null;
      } catch (e) {
        console.warn('[portfolioDeepDive] LLM failed:', e);
      }

      return { error: null, portfolioName: (portfolio as any).name, holdings, sectorBreakdown, portfolioMetrics, topDividend, highBeta, aiSummary };
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

  // Inject research context
  const researchCtx2 = await getResearchContextForLLM();
  const sysContent2 = 'Du bist ein Schweizer Portfolio-Analyst der prägnante, faktenbasierte Zusammenfassungen schreibt. Antworte immer auf Deutsch.' + researchCtx2.contextString;
  const result = await invokeLLM({
    messages: [
      { role: 'system', content: sysContent2 },
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
