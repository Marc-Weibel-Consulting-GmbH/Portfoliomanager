/**
 * Signals Router
 * ==============
 * Generates trading signals based on live Yahoo Finance data.
 * Fetches P/E, PEG, dividend yield, YTD performance, 52-week range
 * from Yahoo Finance quoteSummary and chart endpoints.
 * 
 * P1 Fix: Parallelized signal generation with batched concurrent processing
 * and per-stock timeout to prevent overall request timeout.
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { eq, desc } from "drizzle-orm";
import { savedPortfolios, stocks as stocksTable, stockSignalCache, stockScoreSnapshot } from "../../drizzle/schema";
import { inArray } from "drizzle-orm";
import { randomForestSignal } from '../analytics/mlEngine';
import { signalForSeries, getActiveSignalModel } from '../analytics/signalService';
import { analyzeSentiment, sentimentToSignalScore } from '../analytics/sentimentEngine';
import { getActiveWeights, type WeightConfig } from '../analytics/optimizerWorker';
import { detectBubble } from '../analytics/lpplsEngine';
import { calculateQualityScore, calculateMomentumScore } from '../analytics/qualityMomentumEngine';
import { runSignalOrchestrator } from '../lib/signals/signalOrchestrator';
import type { PortfolioAction } from '../lib/signals/types';
import { computeRegime } from '../lib/signals/regimeEngine';
import { regimeMitTotband } from '../lib/signals/regimeMitTotband';
// SIG-4: gewichtetes Basis-Signal aus dem geteilten Modul (auch vom
// signalCacheCron genutzt — vorher hatte der Cron eine ungewichtete Kopie).
import { generateSignal, type BaseSignal, type SignalType, type SignalStrength } from '../lib/baseSignal';
import { rsiWilder } from '../lib/rsi';

interface Signal extends BaseSignal {
  rfSignal?: string;
  rfScore?: number;
  sentimentScore?: number;
  sentimentLabel?: string;
  bubbleScore?: number;
  bubbleRegime?: string;
  qualityGrade?: string;
  qualityScore?: number;
  momentumGrade?: string;
  momentumScore?: number;
  // Das Signal aus den drei Scores (`rechneSignal`) — die EINE Formel
  // (STRATEGIE_DREI_SCORES.md §2). Der Feldname bleibt `combinedScore`,
  // weil Cache-Spalte und Konsumenten ihn seit jeher so führen.
  combinedScore?: number;
  combinedSignal?: string;
  overallGrade?: string;
  // Die drei Scores selbst, damit die Detailzeilen der Positionsliste die
  // Zusammensetzung des Signals zeigen können — nicht die alten Komponenten.
  qualitaet?: number | null;
  bewertung?: number | null;
  timing?: number | null;
  // Regime-based signal from the new signal framework
  regimeSignal?: PortfolioAction;
  // B5: Wikifolio-Konsens-Signal
  wikifolioScore?: number;
  wikifolioSignal?: string;
  wikifolioBuyCount?: number;
  wikifolioSellCount?: number;
}

// Per-stock timeout: 12 seconds max per individual stock processing
const PER_STOCK_TIMEOUT_MS = 12_000;
// Batch size for concurrent processing (9 = 2 batches for 18 stocks)
const BATCH_SIZE = 9;
// Max sentiment analyses to avoid rate limiting
const MAX_SENTIMENT = 5;

/**
 * Wrap a promise with a timeout. Returns the result or null on timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * Fetch live fundamental data (EODHD) + technicals (historicalPrices-DB) for a single ticker
 */
/**
 * Historische Schlusskurse (split-adjustiert, letzte ~400 Tage) aus der historicalPrices-DB.
 * Ersetzt Yahoo-`chart`-Abrufe (Yahoo ist aus der Deploy-Umgebung blockiert). Keyed nach dem
 * DB-Ticker (so wie importHistoricalPrices speichert). Liefert nach Datum aufsteigend sortiert.
 */
async function getYearCloses(ticker: string): Promise<Array<{ date: string; close: number }>> {
  try {
    const { getDb } = await import("../db");
    const { historicalPrices } = await import("../../drizzle/schema");
    const { eq, gte, and, asc } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return [];
    const from = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const rows = await db
      .select({ date: historicalPrices.date, close: historicalPrices.close, adj: historicalPrices.adjustedClose })
      .from(historicalPrices)
      .where(and(eq(historicalPrices.ticker, ticker), gte(historicalPrices.date, from)))
      .orderBy(asc(historicalPrices.date));
    return rows
      .map((r: any) => ({ date: r.date as string, close: parseFloat((r.adj ?? r.close) as any) }))
      .filter((p: { date: string; close: number }) => Number.isFinite(p.close) && p.close > 0);
  } catch (e) {
    console.warn(`[Signals] getYearCloses failed for ${ticker}:`, (e as Error).message);
    return [];
  }
}

async function fetchLiveData(ticker: string): Promise<{
  peRatio: number | null;
  pegRatio: number | null;
  dividendYield: number;
  currentPrice: number;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  ytdPerformance: number;
  rsi14: number | null;
  companyName: string;
  roe: number | null;
  debtToEquity: number | null;
  fcfYield: number | null;
  grossMargin: number | null;
}> {
  let peRatio: number | null = null;
  let pegRatio: number | null = null;
  let dividendYield = 0;
  let currentPrice = 0;
  let fiftyTwoWeekHigh: number | null = null;
  let fiftyTwoWeekLow: number | null = null;
  let ytdPerformance = 0;
  let rsi14: number | null = null;
  let companyName = ticker;
  // Qualitätskennzahlen (ROE/D-E/FCF/Marge) aus EODHD via 12h-Cache (kein Live-Abruf pro Request).
  let roe: number | null = null;
  let debtToEquity: number | null = null;
  let fcfYield: number | null = null;
  let grossMargin: number | null = null;
  try {
    const { getQualityMetrics } = await import("../lib/qualityMetricsService");
    const qm = await getQualityMetrics(ticker);
    roe = qm.returnOnEquity;
    grossMargin = qm.grossMargin;
    // netDebtToEbitda → D/E proxy: D/E ≈ netDebtToEbitda * 0.5
    if (qm.netDebtToEbitda !== null) {
      debtToEquity = Math.max(0, qm.netDebtToEbitda * 0.5);
    }
    // Echte FCF-Rendite (freier Cashflow ÷ Marktkapitalisierung).
    //
    // Vorher stand hier eine aus `qm.qualityScore` abgeleitete Stufenzahl
    // (> 60 → 3.0, > 40 → 1.0, sonst -1.0). Das war keine Messung, sondern eine
    // Umbenennung: Die FCF-Rendite geht mit Gewicht 0.25 in `calculateQualityScore`
    // ein — der Qualitätsfaktor entstand damit zu einem Viertel aus sich selbst.
    //
    // Fehlt die Zahl, bleibt sie `null`. `calculateQualityScore` rechnet die
    // übrigen Faktoren hoch, statt einen erfundenen Wert zu verarbeiten.
    fcfYield = qm.fcfYield;
  } catch { /* silent - degradiert graziös auf null */ }

  // Fundamentaldaten zuerst aus der DB-`stocks`-Tabelle (periodisch via Refresh-Cron
  // aktualisiert) — schnell und ohne externe Latenz. Das war die Timeout-Ursache: der
  // Live-EODHD-Abruf pro Titel überschritt bei vielen Positionen das Per-Titel-Limit.
  const num = (v: string | null | undefined): number | null => {
    if (v == null) return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  try {
    const db = await getDb();
    if (db) {
      const [row] = await db.select().from(stocksTable).where(eq(stocksTable.ticker, ticker)).limit(1);
      if (row) {
        peRatio = num(row.peRatio);
        pegRatio = num(row.pegRatio);
        dividendYield = num(row.dividendYield) ?? 0;
        companyName = row.companyName || ticker;
        const cp = num(row.currentPrice);
        if (cp && cp > 0) currentPrice = cp;
      }
    }
  } catch (err) {
    console.warn(`[Signals] DB-Fundamentals fehlgeschlagen für ${ticker}:`, (err as Error).message);
  }

  // Fallback: fehlende Kernfelder live via EODHD (Yahoo ist in der Deploy-Umgebung blockiert).
  if (currentPrice === 0 || peRatio === null) {
    try {
      const { fetchEODHDFundamentals, fetchEODHDRealTime } = await import("../_core/eodhdApi");
      if (peRatio === null || pegRatio === null) {
        const f = await fetchEODHDFundamentals(ticker);
        peRatio = peRatio ?? f.peRatio ?? null;
        pegRatio = pegRatio ?? f.pegRatio ?? null;
        if (!dividendYield) dividendYield = f.dividendYield ?? 0;
        if (companyName === ticker) companyName = f.companyName ?? ticker;
      }
      if (currentPrice === 0) {
        const rt = await fetchEODHDRealTime(ticker);
        if (rt.close && rt.close > 0) currentPrice = rt.close;
      }
    } catch (err) {
      console.warn(`[Signals] EODHD-Fallback fehlgeschlagen für ${ticker}:`, (err as Error).message);
    }
  }

  // YTD / RSI-14 / 52-Wochen-Range aus der historicalPrices-DB (EODHD-importiert).
  try {
    const series = await getYearCloses(ticker);
    if (series.length > 1) {
      const yearStart = `${new Date().getFullYear()}-01-01`;
      const firstYtd = series.find(p => p.date >= yearStart) ?? series[0];
      const last = series[series.length - 1];
      if (firstYtd.close > 0) {
        ytdPerformance = ((last.close - firstYtd.close) / firstYtd.close) * 100;
      }
      if (currentPrice === 0) currentPrice = last.close;
      const closes = series.map(p => p.close);
      fiftyTwoWeekHigh = Math.max(...closes);
      fiftyTwoWeekLow = Math.min(...closes);
      if (closes.length >= 15) rsi14 = rsiWilder(closes, 14);
    }
  } catch (err) {
    console.warn(`[Signals] Historie/RSI fehlgeschlagen für ${ticker}:`, (err as Error).message);
  }

  return {
    peRatio,
    pegRatio,
    dividendYield,
    currentPrice,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    ytdPerformance,
    rsi14,
    companyName,
    roe,
    debtToEquity,
    fcfYield,
    grossMargin,
  };
}


/**
 * Generate trading signal based on live fundamental + technical data
 * Uses optimized weights from the Signal Auto-Optimizer (if available)
 */
/**
 * Process a single stock completely: fetch data + generate signal + ML enhancement
 * This is the atomic unit of work that runs in parallel.
 */
async function processStock(
  stock: { ticker: string; companyName?: string; currentPrice?: number | string },
  optimizedWeights: WeightConfig | undefined,
  enableSentiment: boolean,
): Promise<Signal> {
  const ticker = stock.ticker;

  // Step 1: Fetch live fundamental data
  let liveData: Awaited<ReturnType<typeof fetchLiveData>> | null = null;
  try {
    liveData = await fetchLiveData(ticker);
  } catch (e) {
    console.warn(`[Signals] fetchLiveData failed for ${ticker}:`, (e as Error).message);
  }

  // Step 2: Generate base signal
  let signal: Signal;
  if (liveData && liveData.currentPrice > 0) {
    signal = generateSignal({
      ticker,
      companyName: liveData.companyName || stock.companyName || ticker,
      peRatio: liveData.peRatio,
      pegRatio: liveData.pegRatio,
      dividendYield: liveData.dividendYield,
      currentPrice: liveData.currentPrice,
      fiftyTwoWeekHigh: liveData.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: liveData.fiftyTwoWeekLow,
      ytdPerformance: liveData.ytdPerformance,
      rsi14: liveData.rsi14,
    }, optimizedWeights);
  } else {
    // Fallback: use stored data if live fetch fails
    const currentPrice = typeof stock.currentPrice === 'number'
      ? stock.currentPrice
      : parseFloat(stock.currentPrice as string) || 0;
    signal = generateSignal({
      ticker,
      companyName: stock.companyName || ticker,
      peRatio: null,
      pegRatio: null,
      dividendYield: 0,
      currentPrice,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      ytdPerformance: 0,
      rsi14: null,
    }, optimizedWeights);
  }

  // Step 3: Quality Factor scoring
  if (liveData) {
    try {
      const qualityResult = calculateQualityScore({
        roe: liveData.roe,
        debtToEquity: liveData.debtToEquity,
        fcfYield: liveData.fcfYield,
        grossMargin: liveData.grossMargin,
      });
      signal.qualityGrade = qualityResult.grade;
      signal.qualityScore = qualityResult.score;
      if (qualityResult.grade === 'A') {
        signal.criteria.push(`Quality: ${qualityResult.grade} (ROE ${liveData.roe?.toFixed(1) ?? 'N/A'}%, D/E ${liveData.debtToEquity?.toFixed(2) ?? 'N/A'})`);
      } else if (qualityResult.grade === 'F') {
        signal.criteria.push(`Quality: ${qualityResult.grade} - Schwache Fundamentaldaten`);
      }
    } catch (e) {
      // Quality scoring failed silently
    }
  }

  // Step 4: historische Kurse aus der DB (EODHD) für ML — Yahoo blockiert im Deploy.
  try {
    const series = await getYearCloses(ticker);
    const prices = series.map(p => p.close);
    const volumes: number[] = []; // historicalPrices führt kein Volumen — RF degradiert graziös
    const fundamentals = liveData ? {
      peRatio: liveData.peRatio,
      pegRatio: liveData.pegRatio,
      dividendYield: liveData.dividendYield,
    } : {};

    // Step 5: Random Forest signal
    if (prices.length >= 60) {
      try {
        const rf = await signalForSeries(getActiveSignalModel, () => randomForestSignal(prices, volumes, fundamentals), 'gb_signal', prices);
        signal.rfSignal = rf.signal;
        signal.rfScore = rf.score;
        if (rf.signal === 'strong_buy' || rf.signal === 'strong_sell') {
          signal.criteria.push(`RF: ${rf.signal === 'strong_buy' ? 'Starkes Kaufsignal' : 'Starkes Verkaufssignal'} (Score ${rf.score})`);
        }
      } catch (e) {
        // RF failed silently
      }
    }

    // Step 6: LPPLS Bubble analysis
    if (prices.length >= 60) {
      try {
        const bubbleResult = detectBubble({
          prices,
          sentimentScore: signal.sentimentScore,
          sentimentConfidence: signal.sentimentScore !== undefined ? 0.6 : 0,
        });
        signal.bubbleScore = bubbleResult.bubbleScore;
        signal.bubbleRegime = bubbleResult.regime;

        if (bubbleResult.regime === 'bubble' && bubbleResult.bubbleConfidence > 0.3) {
          signal.criteria.push(`Bubble-Risiko: ${(bubbleResult.bubbleConfidence * 100).toFixed(0)}% Confidence`);
        } else if (bubbleResult.regime === 'negative_bubble' && bubbleResult.negBubbleConfidence > 0.3) {
          signal.criteria.push(`Negative Bubble: Rebound-Chance (${(bubbleResult.negBubbleConfidence * 100).toFixed(0)}%)`);
        }
      } catch (e) {
        // Bubble analysis failed silently
      }
    }

    // Step 7: Momentum Factor scoring
    if (prices.length >= 60) {
      try {
        const momentumResult = calculateMomentumScore({ prices });
        signal.momentumGrade = momentumResult.grade;
        signal.momentumScore = momentumResult.score;
        if (momentumResult.grade === 'A') {
          signal.criteria.push(`Momentum: ${momentumResult.grade} (Rel. Stärke ${momentumResult.score.toFixed(0)})`);
        } else if (momentumResult.grade === 'F') {
          signal.criteria.push(`Momentum: ${momentumResult.grade} - Schwaches Momentum`);
        }
      } catch (e) {
        // Momentum scoring failed silently
      }
    }

    // Step 8a: das Signal aus den DREI Scores — dieselbe Rechnung wie im
    // Signal-Cron. Vorher stand hier `blendCombinedScore` (Momentum + Qualität
    // − LPPL): Ein Cache-Miss lieferte damit ein Signal aus einer ANDEREN
    // Formel als ein Cache-Treffer, und die Empfehlung eines Titels hing davon
    // ab, ob der Cron ihn schon besucht hatte (STRATEGIE_DREI_SCORES.md §2).
    try {
      const { leseScores } = await import('../lib/dreiScoresStore');
      const { berechneTiming, rechneSignal } = await import('../lib/dreiScoreSignal');
      const abgelegt = (await leseScores([ticker])).get(ticker);

      const positionIn52W = signal.currentPrice > 0
        && typeof signal.fiftyTwoWeekHigh === 'number' && typeof signal.fiftyTwoWeekLow === 'number'
        && signal.fiftyTwoWeekHigh > signal.fiftyTwoWeekLow
        ? (signal.currentPrice - signal.fiftyTwoWeekLow) / (signal.fiftyTwoWeekHigh - signal.fiftyTwoWeekLow)
        : null;
      const t = berechneTiming({
        momentum: signal.momentumScore ?? null,
        rsi14: signal.rsi14 ?? null,
        positionIn52W,
        ytdPerformance: signal.ytdPerformance ?? null,
        blasenScore: signal.bubbleScore ?? null,
      });

      let regimeKey = 'default';
      try { regimeKey = regimeMitTotband(prices); } catch { /* Preise zu kurz o. ä. */ }

      const sig = rechneSignal({
        qualitaet: abgelegt?.qualitaet ?? null,
        bewertung: abgelegt?.bewertung ?? null,
        timing: t.score,
        regime: regimeKey,
      });

      signal.qualitaet = abgelegt?.qualitaet ?? null;
      signal.bewertung = abgelegt?.bewertung ?? null;
      signal.timing = t.score;

      if (sig.score !== null && sig.label && sig.grade) {
        signal.combinedScore = sig.score;
        signal.overallGrade = sig.grade;
        signal.combinedSignal = sig.label;
        if (sig.label === 'STRONG BUY' || sig.label === 'BUY') {
          signal.type = 'buy';
          signal.strength = sig.label === 'STRONG BUY' ? 'strong' : 'moderate';
        } else if (sig.label === 'STRONG SELL' || sig.label === 'SELL') {
          signal.type = 'sell';
          signal.strength = sig.label === 'STRONG SELL' ? 'strong' : 'moderate';
        } else {
          signal.type = 'hold';
          signal.strength = 'moderate';
        }
      }
      // Reichen die Scores nicht (neuer Titel, Cron noch nie gelaufen), bleibt
      // `combinedScore` leer. Ehrlicher als eine Zahl aus der alten Formel —
      // der nächste Cron-Lauf füllt die Lücke.
    } catch (e) {
      // Combined scoring failed silently
    }

    // Step 8b: Regime-based signal via signalOrchestrator
    if (prices.length >= 60) {
      try {
        const lpplRisk = signal.bubbleScore !== undefined
          ? { bubbleScore: signal.bubbleScore, regime: signal.bubbleRegime ?? 'normal', confidence: 0.6 }
          : null;
        // SIG-7: gelernte Engine-Priors laden (gecacht) — schliesst die Gedächtnis-Schleife.
        const { getLearnedEnginePriors } = await import('../analytics/regimeSignalMemory');
        signal.regimeSignal = runSignalOrchestrator({
          ticker,
          marketType: 'single_stock',
          prices,
          dates: [],
          lpplRisk: signal.bubbleScore ?? null,
          qualityScore: signal.qualityScore ?? null,
          momentumScore: signal.momentumScore ?? null,
          learnedEnginePriorsByRegime: await getLearnedEnginePriors(),
        });
      } catch (e) {
        // Regime signal failed silently
      }
    }

    // Step 8: Sentiment analysis (only if enabled for this stock)
    if (enableSentiment) {
      try {
        const sentiment = await analyzeSentiment(signal.ticker, signal.companyName);
        if (sentiment.newsCount > 0 && sentiment.confidence > 0.3) {
          signal.sentimentScore = sentiment.score;
          signal.sentimentLabel = sentiment.sentiment;
          const sentContrib = sentimentToSignalScore(sentiment);
          if (Math.abs(sentContrib) >= 1) {
            signal.criteria.push(
              `Sentiment: ${sentiment.sentiment === 'bullish' ? 'Positiv' : sentiment.sentiment === 'bearish' ? 'Negativ' : 'Neutral'} (${sentiment.score > 0 ? '+' : ''}${sentiment.score})`
            );
          }
        }
      } catch (e) {
        // Sentiment failed silently
      }
    }
  } catch (e) {
    // Chart/ML enhancement failed silently — signal still has base data
    console.warn(`[Signals] ML enhancement failed for ${ticker}:`, (e as Error).message);
  }

  return signal;
}

export const signalsRouter = router({
  /**
   * F-14: Empfehlungs-Historie (read-only) aus signal_history.
   * Neueste zuerst, max. 100. Optional nur bereits evaluierte Signale.
   * Alpha-Felder sind erst für Signale gefüllt, die nach dem Alpha-Deployment
   * evaluiert wurden (ältere Zeilen bleiben null).
   */
  getHistory: protectedProcedure
    .input(z.object({ onlyEvaluated: z.boolean().default(false) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { signalHistory } = await import("../../drizzle/schema");
      const { desc, isNotNull } = await import("drizzle-orm");

      const rows = await db
        .select()
        .from(signalHistory)
        .where(input?.onlyEvaluated ? isNotNull(signalHistory.evaluatedAt) : undefined)
        .orderBy(desc(signalHistory.computedAt))
        .limit(100);

      const num = (v: unknown): number | null => {
        if (v == null) return null;
        const n = parseFloat(String(v));
        return isNaN(n) ? null : n;
      };

      return rows.map((r) => ({
        id: r.id,
        date: r.computedAt,
        ticker: r.ticker,
        action: r.action,
        conviction: num(r.conviction),
        priceAtSignal: num(r.priceAtSignal),
        evaluated: r.evaluatedAt != null,
        evaluatedAt: r.evaluatedAt,
        actualReturnPct: num(r.actualReturnPct),
        benchmarkReturnPct: num(r.benchmarkReturnPct),
        alphaPct: num(r.alphaPct),
        directionCorrect: r.directionCorrect,
      }));
    }),

  /**
   * Get regime-based signal for a single ticker (on-demand, for StockDetail page)
   */
  getRegimeSignal: protectedProcedure
    .input(z.object({ ticker: z.string() }))
    .query(async ({ input }) => {
      const ticker = input.ticker;
      try {
        // Historische Kurse aus der DB (EODHD) statt Yahoo (im Deploy blockiert).
        const series = await getYearCloses(ticker);
        const prices: number[] = series.map(p => p.close);
        if (prices.length < 60) return null;

        // Quick quality + momentum for regime context
        const { score: momentumScore } = calculateMomentumScore({ prices });
        const bubbleResult = detectBubble({ prices });

        // SIG-7: gelernte Engine-Priors laden (gecacht) — schliesst die Gedächtnis-Schleife.
        const { getLearnedEnginePriors } = await import('../analytics/regimeSignalMemory');
        return runSignalOrchestrator({
          ticker,
          marketType: 'single_stock',
          prices,
          dates: [],
          lpplRisk: bubbleResult.bubbleScore ?? null,
          momentumScore,
          qualityScore: null,
          learnedEnginePriorsByRegime: await getLearnedEnginePriors(),
        });
      } catch (e) {
        console.warn(`[signals.getRegimeSignal] Failed for ${ticker}:`, (e as Error).message);
        return null;
      }
    }),

  /**
   * Generate trading signals for a portfolio.
   * Cache-first strategy: reads from stock_signal_cache (pre-computed every 2h).
   * Only falls back to live computation for cache misses (new stocks not yet cached).
   * Expected response time: <1s for cache hits vs 15-30s for live computation.
   */
  generate: protectedProcedure
    .input(z.object({
      portfolioId: z.number()
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Fetch portfolio
      const [portfolio] = await db
        .select()
        .from(savedPortfolios)
        .where(eq(savedPortfolios.id, input.portfolioId))
        .limit(1);

      if (!portfolio) {
        throw new Error("Portfolio not found");
      }

      // Parse portfolio data to get ticker list
      const portfolioData = JSON.parse(portfolio.portfolioData);
      const stocks = portfolioData.stocks || [];
      const tickers: string[] = stocks.map((s: any) => s.ticker);
      const startTime = Date.now();

      // ─── Step 1: Read from signal cache (fast path) ───────────────────────
      const CACHE_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours
      const cacheRows = tickers.length > 0
        ? await db.select().from(stockSignalCache).where(inArray(stockSignalCache.ticker, tickers))
        : [];
      const cacheMap = new Map(cacheRows.map((r) => [r.ticker, r]));

      const cachedSignals: Signal[] = [];
      const missedStocks: any[] = [];
      const now = Date.now();
      const num = (v: string | null | undefined) => v != null ? parseFloat(v) : null;

      for (const stock of stocks) {
        const cached = cacheMap.get(stock.ticker);
        const cacheAge = cached ? now - new Date(cached.computedAt).getTime() : Infinity;
        if (cached && cacheAge < CACHE_MAX_AGE_MS) {
          cachedSignals.push({
            ticker: cached.ticker,
            companyName: cached.companyName,
            type: cached.signalType as SignalType,
            strength: cached.signalStrength as SignalStrength,
            currentPrice: num(cached.currentPrice) ?? 0,
            targetPrice: num(cached.targetPrice) ?? 0,
            peRatio: num(cached.peRatio),
            pegRatio: num(cached.pegRatio),
            dividendYield: num(cached.dividendYield) ?? 0,
            ytdPerformance: num(cached.ytdPerformance) ?? 0,
            fiftyTwoWeekHigh: num(cached.fiftyTwoWeekHigh),
            fiftyTwoWeekLow: num(cached.fiftyTwoWeekLow),
            rsi14: num(cached.rsi14),
            reason: cached.reason ?? 'Keine Begründung verfügbar.',
            criteria: (cached.criteria as string[]) ?? [],
            rfSignal: cached.rfSignal ?? undefined,
            rfScore: cached.rfScore ?? undefined,
            qualityGrade: cached.qualityGrade ?? undefined,
            qualityScore: cached.qualityScore ?? undefined,
            momentumGrade: cached.momentumGrade ?? undefined,
            momentumScore: cached.momentumScore ?? undefined,
            combinedScore: num(cached.combinedScore) ?? undefined,
            combinedSignal: cached.combinedSignal ?? undefined,
            overallGrade: cached.overallGrade ?? undefined,
            bubbleScore: num(cached.bubbleScore) ?? undefined,
            bubbleRegime: cached.bubbleRegime ?? undefined,
            sentimentScore: cached.sentimentScore ?? undefined,
            sentimentLabel: cached.sentimentLabel ?? undefined,
            // B5: Wikifolio-Konsens-Signal
            wikifolioScore: cached.wikifolioScore ?? undefined,
            wikifolioSignal: cached.wikifolioSignal ?? undefined,
            wikifolioBuyCount: cached.wikifolioBuyCount ?? undefined,
            wikifolioSellCount: cached.wikifolioSellCount ?? undefined,
          });
        } else {
          missedStocks.push(stock);
        }
      }
      console.log(`[Signals] Cache: ${cachedSignals.length} hits, ${missedStocks.length} misses (age limit: 4h)`);

      // ─── Step 2: Live compute only for cache misses ───────────────────────
      const liveSignals: Signal[] = [];
      if (missedStocks.length > 0) {
        const optimizedWeights = await getActiveWeights();
        console.log(`[Signals] Live computing ${missedStocks.length} stocks (batch ${BATCH_SIZE})...`);
        for (let i = 0; i < missedStocks.length; i += BATCH_SIZE) {
          const batch = missedStocks.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.allSettled(
            batch.map((stock: any, batchIdx: number) => {
              const globalIdx = i + batchIdx;
              const enableSentiment = globalIdx < MAX_SENTIMENT;
              return withTimeout(
                processStock(stock, optimizedWeights, enableSentiment),
                PER_STOCK_TIMEOUT_MS
              );
            })
          );
          for (let j = 0; j < batchResults.length; j++) {
            const result = batchResults[j];
            const stock = batch[j];
            if (result.status === "fulfilled" && result.value !== null) {
              liveSignals.push(result.value);
            } else {
              const reason = result.status === "rejected" 
                ? `Fehler: ${(result.reason as Error)?.message || 'Unbekannt'}`
                : 'Timeout bei Datenabfrage';
              console.warn(`[Signals] ${stock.ticker}: ${reason}`);
              const currentPrice = typeof stock.currentPrice === 'number'
                ? stock.currentPrice
                : parseFloat(stock.currentPrice) || 0;
              liveSignals.push({
                ticker: stock.ticker,
                companyName: stock.companyName || stock.ticker,
                type: "hold",
                strength: "weak",
                currentPrice,
                targetPrice: currentPrice,
                peRatio: null,
                pegRatio: null,
                dividendYield: 0,
                ytdPerformance: 0,
                fiftyTwoWeekHigh: null,
                fiftyTwoWeekLow: null,
                rsi14: null,
                reason: `Daten konnten nicht vollständig geladen werden (${reason}). Bitte später erneut versuchen.`,
                criteria: [`⚠️ ${reason}`],
              });
            }
          }
        }
      }

      // ─── Step 3: Merge and sort ───────────────────────────────────────────
      const signals = [...cachedSignals, ...liveSignals];

      // Die drei Scores an alle Signale hängen — EINE Bulk-Abfrage, kein Abruf
      // je Titel. Der Cache-Treffer-Pfad (der häufigste) hätte sie sonst nicht,
      // und die Detailzeile der Positionsliste zeigte «—», obwohl die Werte
      // vorliegen. Live gerechnete Signale behalten ihr frischeres Timing.
      try {
        const { leseScores } = await import('../lib/dreiScoresStore');
        const abgelegt = await leseScores(signals.map((s) => s.ticker));
        for (const s of signals) {
          const a = abgelegt.get(s.ticker);
          if (!a) continue;
          if (s.qualitaet === undefined) s.qualitaet = a.qualitaet;
          if (s.bewertung === undefined) s.bewertung = a.bewertung;
          if (s.timing === undefined) s.timing = a.timing;
        }
      } catch { /* ohne Ablage bleiben die Felder leer — Anzeige zeigt «—» */ }
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Signals] Completed ${signals.length}/${stocks.length} stocks in ${elapsed}s`);

      // Sort by signal strength and type (strong buy first, then moderate buy, etc.)
      const signalOrder: Record<string, number> = { buy: 0, hold: 1, sell: 2 };
      const strengthOrder: Record<string, number> = { strong: 0, moderate: 1, weak: 2 };

      signals.sort((a, b) => {
        if (signalOrder[a.type] !== signalOrder[b.type]) {
          return signalOrder[a.type] - signalOrder[b.type];
        }
        return strengthOrder[a.strength] - strengthOrder[b.strength];
      });

      return signals;
    }),

  // Returns the last 30 daily score snapshots for a given ticker
  getScoreHistory: protectedProcedure
    .input(z.object({ ticker: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(stockScoreSnapshot)
        .where(eq(stockScoreSnapshot.ticker, input.ticker))
        .orderBy(desc(stockScoreSnapshot.snapshotDate))
        .limit(30);
      return rows.reverse(); // chronological order for charts
    }),

  // Clears the signal cache for all tickers in a portfolio, forcing a fresh recalculation
  refreshSignals: protectedProcedure
    .input(z.object({ portfolioId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Verify portfolio belongs to user
      const [portfolio] = await db
        .select()
        .from(savedPortfolios)
        .where(eq(savedPortfolios.id, input.portfolioId))
        .limit(1);
      if (!portfolio || portfolio.userId !== ctx.user.id) {
        throw new Error("Portfolio not found");
      }
      const portfolioData = JSON.parse(portfolio.portfolioData);
      const tickers: string[] = (portfolioData.stocks || []).map((s: any) => s.ticker);
      if (tickers.length > 0) {
        await db.delete(stockSignalCache).where(inArray(stockSignalCache.ticker, tickers));
      }
      return { cleared: tickers.length };
    })
});
