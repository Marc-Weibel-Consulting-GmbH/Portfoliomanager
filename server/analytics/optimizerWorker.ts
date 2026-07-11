/**
 * Optimizer Worker
 * ================
 * Runs the signal optimization in a child process to avoid blocking the main server.
 * Uses a simple approach: spawn a child process that runs the optimization and
 * communicates results back via IPC.
 */

import { getDb } from "../db";
import { stocks, signalWeights } from "../../drizzle/schema";
import { activeCurated } from "../lib/stockUniverse";
import { eq, desc } from "drizzle-orm";

import { ENV } from "../_core/env";
import { toEodhdSymbol } from "../lib/eodhdSymbol";
export interface WeightConfig {
  pe: number;
  peg: number;
  rsi: number;
  macd: number;
  dividend: number;
  week52: number;
  ytd: number;
  rf: number;
  sentiment: number;
  bubble: number;
  quality: number;
  momentum: number;
}

export interface OptimizerResult {
  bestWeights: WeightConfig;
  hitRate: number;
  totalBacktested: number;
  correctSignals: number;
  topCombinations: Array<{ weights: WeightConfig; hitRate: number }>;
  log: string[];
  durationMs: number;
  // Walk-Forward Validation
  walkForward?: {
    inSampleHitRate: number;
    outOfSampleHitRate: number;
    inSampleCount: number;
    outOfSampleCount: number;
    overfitRatio: number; // inSample/outOfSample - closer to 1.0 = less overfit
  };
  totalStocksProcessed?: number;
  batchInfo?: string;
}

export const DEFAULT_WEIGHTS: WeightConfig = {
  pe: 0.10,
  peg: 0.07,
  rsi: 0.14,
  macd: 0.07,
  dividend: 0.07,
  week52: 0.07,
  ytd: 0.07,
  rf: 0.08,
  sentiment: 0.05,
  bubble: 0.06,
  quality: 0.12,
  momentum: 0.10,
};

/**
 * Strategy Presets by time horizon
 * Based on academic factor research and practical portfolio management.
 */
export const STRATEGY_PRESETS: Record<string, { name: string; description: string; weights: WeightConfig }> = {
  shortTerm: {
    name: "Kurzfristig (Swing/Trading)",
    description: "Fokus auf Timing, Mean-Reversion und Breakouts. Fundamentals nur als Filter.",
    weights: {
      pe: 0.03,
      peg: 0.02,
      rsi: 0.22,
      macd: 0.15,
      dividend: 0.02,
      week52: 0.15,
      ytd: 0.05,
      rf: 0.10,
      sentiment: 0.10,
      bubble: 0.03,
      quality: 0.05,
      momentum: 0.08,
    },
  },
  midTerm: {
    name: "Mittelfristig (Trend)",
    description: "Mischung aus Trendfolge, ML und soliden Fundamentals. 6-12 Monate Horizont.",
    weights: {
      pe: 0.10,
      peg: 0.10,
      rsi: 0.10,
      macd: 0.05,
      dividend: 0.05,
      week52: 0.05,
      ytd: 0.05,
      rf: 0.15,
      sentiment: 0.05,
      bubble: 0.05,
      quality: 0.15,
      momentum: 0.10,
    },
  },
  longTerm: {
    name: "Langfristig (Investor)",
    description: "Bewertung, Qualität, Blasen-Vermeidung. Technik nur für Entry/Exit-Timing.",
    weights: {
      pe: 0.15,
      peg: 0.15,
      rsi: 0.03,
      macd: 0.02,
      dividend: 0.12,
      week52: 0.03,
      ytd: 0.03,
      rf: 0.12,
      sentiment: 0.03,
      bubble: 0.10,
      quality: 0.22,
      momentum: 0.00,
    },
  },
};

/**
 * Fetch historical prices from EODHD (non-blocking, with timeout)
 */
async function fetchPricesEODHD(ticker: string): Promise<{
  prices: number[];
  volumes: number[];
} | null> {
  const apiKey = ENV.eodhdApiKey;
  if (!apiKey) return null;

  try {
    const endDate = new Date();
    const startDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    const fromDate = startDate.toISOString().split("T")[0];
    const toDate = endDate.toISOString().split("T")[0];

    let eodhTicker = ticker;
    if (!ticker.includes(".")) {
      eodhTicker = `${ticker}.US`;
    }
    eodhTicker = toEodhdSymbol(eodhTicker);

    const url = `https://eodhd.com/api/eod/${eodhTicker}?api_token=${apiKey}&from=${fromDate}&to=${toDate}&fmt=json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data) || data.length < 60) return null;

    return {
      prices: data.map((d: any) => d.close).filter((c: any) => c != null && c > 0),
      volumes: data.map((d: any) => d.volume || 0),
    };
  } catch {
    return null;
  }
}

/**
 * Calculate RSI from closing prices
 */
function calcRSI(prices: number[], period: number = 14): number | null {
  if (prices.length < period + 1) return null;
  const changes: number[] = [];
  for (let i = prices.length - period - 1; i < prices.length; i++) {
    if (i > 0) changes.push(prices[i] - prices[i - 1]);
  }
  const gains = changes.filter(c => c > 0);
  const losses = changes.filter(c => c < 0).map(c => Math.abs(c));
  const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Calculate MACD signal (simplified)
 */
function calcMACD(prices: number[]): number {
  if (prices.length < 26) return 0;
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);
  return ema12 - ema26;
}

function calcEMA(prices: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

/**
 * Generate weighted signal score
 */
function generateWeightedScore(
  weights: WeightConfig,
  indicators: {
    peRatio: number | null;
    pegRatio: number | null;
    rsi14: number | null;
    macdSignal: number;
    dividendYield: number;
    positionIn52W: number | null;
    ytdPerformance: number;
  }
): number {
  let score = 0;
  let totalWeight = 0;

  if (indicators.peRatio !== null && indicators.peRatio > 0) {
    let peScore = 0;
    if (indicators.peRatio < 12) peScore = 1;
    else if (indicators.peRatio < 15) peScore = 0.5;
    else if (indicators.peRatio < 20) peScore = 0;
    else if (indicators.peRatio < 30) peScore = -0.5;
    else peScore = -1;
    score += weights.pe * peScore;
    totalWeight += weights.pe;
  }

  if (indicators.pegRatio !== null && indicators.pegRatio > 0) {
    let pegScore = 0;
    if (indicators.pegRatio < 0.8) pegScore = 1;
    else if (indicators.pegRatio < 1.2) pegScore = 0.5;
    else if (indicators.pegRatio < 1.8) pegScore = 0;
    else if (indicators.pegRatio < 2.5) pegScore = -0.5;
    else pegScore = -1;
    score += weights.peg * pegScore;
    totalWeight += weights.peg;
  }

  if (indicators.rsi14 !== null) {
    let rsiScore = 0;
    if (indicators.rsi14 < 30) rsiScore = 1;
    else if (indicators.rsi14 < 40) rsiScore = 0.5;
    else if (indicators.rsi14 < 60) rsiScore = 0;
    else if (indicators.rsi14 < 70) rsiScore = -0.5;
    else rsiScore = -1;
    score += weights.rsi * rsiScore;
    totalWeight += weights.rsi;
  }

  {
    let macdScore = 0;
    if (indicators.macdSignal > 2) macdScore = 1;
    else if (indicators.macdSignal > 0.5) macdScore = 0.5;
    else if (indicators.macdSignal > -0.5) macdScore = 0;
    else if (indicators.macdSignal > -2) macdScore = -0.5;
    else macdScore = -1;
    score += weights.macd * macdScore;
    totalWeight += weights.macd;
  }

  {
    let divScore = 0;
    if (indicators.dividendYield > 4) divScore = 1;
    else if (indicators.dividendYield > 2.5) divScore = 0.5;
    else if (indicators.dividendYield > 1) divScore = 0;
    else divScore = -0.3;
    score += weights.dividend * divScore;
    totalWeight += weights.dividend;
  }

  if (indicators.positionIn52W !== null) {
    let rangeScore = 0;
    if (indicators.positionIn52W < 0.2) rangeScore = 1;
    else if (indicators.positionIn52W < 0.4) rangeScore = 0.5;
    else if (indicators.positionIn52W < 0.6) rangeScore = 0;
    else if (indicators.positionIn52W < 0.8) rangeScore = -0.3;
    else rangeScore = -0.7;
    score += weights.week52 * rangeScore;
    totalWeight += weights.week52;
  }

  {
    let ytdScore = 0;
    if (indicators.ytdPerformance > 20) ytdScore = -0.5;
    else if (indicators.ytdPerformance > 10) ytdScore = 0.3;
    else if (indicators.ytdPerformance > 0) ytdScore = 0.5;
    else if (indicators.ytdPerformance > -10) ytdScore = 0;
    else ytdScore = 0.5;
    score += weights.ytd * ytdScore;
    totalWeight += weights.ytd;
  }

  if (totalWeight === 0) return 0;
  return (score / totalWeight) * 100;
}

/**
 * Backtest a single stock with given weights
 */
function backtestStock(
  prices: number[],
  volumes: number[],
  weights: WeightConfig,
  fundamentals: { peRatio: number | null; pegRatio: number | null; dividendYield: number },
  lookforward: number = 20,
  threshold: number = 15
): { correct: number; total: number } {
  let correct = 0;
  let total = 0;

  const SIGNAL_INTERVAL = 20; // More frequent signals for more data points
  const LOOKFORWARD = lookforward;
  const MIN_HISTORY = 60;
  const THRESHOLD = threshold;

  for (let day = MIN_HISTORY; day < prices.length - LOOKFORWARD; day += SIGNAL_INTERVAL) {
    const historicalPrices = prices.slice(0, day + 1);
    const currentPrice = prices[day];
    const futurePrice = prices[day + LOOKFORWARD];

    if (!currentPrice || !futurePrice || currentPrice === 0) continue;

    const rsi14 = calcRSI(historicalPrices, 14);
    const macdSignal = calcMACD(historicalPrices);

    const last252 = historicalPrices.slice(-252);
    const high52 = Math.max(...last252);
    const low52 = Math.min(...last252);
    const positionIn52W = high52 !== low52 ? (currentPrice - low52) / (high52 - low52) : null;

    const ytdStart = historicalPrices[Math.max(0, historicalPrices.length - 180)];
    const ytdPerformance = ytdStart > 0 ? ((currentPrice - ytdStart) / ytdStart) * 100 : 0;

    const score = generateWeightedScore(weights, {
      peRatio: fundamentals.peRatio,
      pegRatio: fundamentals.pegRatio,
      rsi14,
      macdSignal,
      dividendYield: fundamentals.dividendYield,
      positionIn52W,
      ytdPerformance,
    });

    if (Math.abs(score) < THRESHOLD) continue;

    const predictedDirection = score > 0 ? "buy" : "sell";
    const actualDirection = futurePrice > currentPrice ? "up" : "down";
    const isCorrect =
      (predictedDirection === "buy" && actualDirection === "up") ||
      (predictedDirection === "sell" && actualDirection === "down");

    total++;
    if (isCorrect) correct++;
  }

  return { correct, total };
}

/**
 * Generate weight grid (200 random combinations)
 */
function generateWeightGrid(): WeightConfig[] {
  const combinations: WeightConfig[] = [];
  const peOptions = [0.06, 0.10, 0.16];
  const pegOptions = [0.04, 0.07, 0.12];
  const rsiOptions = [0.08, 0.14, 0.20];
  const macdOptions = [0.04, 0.07, 0.12];
  const dividendOptions = [0.04, 0.07, 0.12];
  const week52Options = [0.04, 0.07, 0.12];
  const ytdOptions = [0.04, 0.07, 0.12];
  const rfOptions = [0.05, 0.08, 0.14];
  const sentimentOptions = [0.02, 0.05, 0.08];
  const bubbleOptions = [0.0, 0.04, 0.06, 0.10];
  const qualityOptions = [0.06, 0.12, 0.18, 0.22];
  const momentumOptions = [0.05, 0.10, 0.15, 0.20];

  const SAMPLE_SIZE = 200;
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    combinations.push({
      pe: peOptions[Math.floor(Math.random() * peOptions.length)],
      peg: pegOptions[Math.floor(Math.random() * pegOptions.length)],
      rsi: rsiOptions[Math.floor(Math.random() * rsiOptions.length)],
      macd: macdOptions[Math.floor(Math.random() * macdOptions.length)],
      dividend: dividendOptions[Math.floor(Math.random() * dividendOptions.length)],
      week52: week52Options[Math.floor(Math.random() * week52Options.length)],
      ytd: ytdOptions[Math.floor(Math.random() * ytdOptions.length)],
      rf: rfOptions[Math.floor(Math.random() * rfOptions.length)],
      sentiment: sentimentOptions[Math.floor(Math.random() * sentimentOptions.length)],
      bubble: bubbleOptions[Math.floor(Math.random() * bubbleOptions.length)],
      quality: qualityOptions[Math.floor(Math.random() * qualityOptions.length)],
      momentum: momentumOptions[Math.floor(Math.random() * momentumOptions.length)],
    });
  }
  combinations.push(DEFAULT_WEIGHTS);
  return combinations;
}

/**
 * Run the full optimization process (designed to be non-blocking)
 * Uses setImmediate/setTimeout to yield to event loop regularly
 */
export async function runOptimizerNonBlocking(
  progressCallback?: (msg: string) => void
): Promise<OptimizerResult> {
  const startTime = Date.now();
  const log: string[] = [];
  const logMsg = (msg: string) => {
    log.push(`[${new Date().toISOString()}] ${msg}`);
    progressCallback?.(msg);
  };

  logMsg("Signal Auto-Optimizer gestartet (EODHD-basiert, Walk-Forward)...");

  // 1. Fetch all active watchlist stocks
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const allStocks = await db
    .select()
    .from(stocks)
    .where(activeCurated());

  logMsg(`${allStocks.length} aktive Watchlist-Titel gefunden`);

  // 2. Fetch historical prices for ALL stocks (batch processing with rate limiting)
  const MAX_STOCKS = allStocks.length; // Process ALL stocks now
  const BATCH_SIZE = 20; // EODHD rate limit: 20 requests per batch, then pause
  const stocksToProcess = allStocks.slice(0, MAX_STOCKS);

  const stockData: Array<{
    ticker: string;
    prices: number[];
    volumes: number[];
    fundamentals: { peRatio: number | null; pegRatio: number | null; dividendYield: number };
  }> = [];

  for (let i = 0; i < stocksToProcess.length; i++) {
    const stock = stocksToProcess[i];
    
    // Yield to event loop between each stock fetch
    await new Promise(r => setTimeout(r, 100));

    try {
      const data = await fetchPricesEODHD(stock.ticker);
      if (data && data.prices.length >= 60) {
        stockData.push({
          ticker: stock.ticker,
          prices: data.prices,
          volumes: data.volumes,
          fundamentals: {
            peRatio: stock.peRatio ? parseFloat(stock.peRatio) : null,
            pegRatio: stock.pegRatio ? parseFloat(stock.pegRatio) : null,
            dividendYield: stock.dividendYield ? parseFloat(stock.dividendYield) : 0,
          },
        });
      }
    } catch {
      // Skip failed stocks
    }

    if ((i + 1) % 10 === 0) {
      logMsg(`Preisdaten geladen: ${stockData.length}/${stocksToProcess.length} (${i + 1} verarbeitet)`);
    }

    // Batch pause: after every BATCH_SIZE requests, wait 2s for rate limiting
    if ((i + 1) % BATCH_SIZE === 0 && i < stocksToProcess.length - 1) {
      logMsg(`Batch-Pause (Rate-Limit)... nächster Batch startet in 2s`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  logMsg(`${stockData.length} Titel mit ausreichend Daten für Backtest`);

  if (stockData.length < 5) {
    throw new Error(`Zu wenige Titel mit Preisdaten (${stockData.length}/5 minimum). Bitte EODHD API Key prüfen.`);
  }

  // 3. MULTI-PASS ITERATIVE OPTIMIZATION
  // Pass 1: Find best lookforward period and threshold
  const lookforwardOptions = [5, 10, 15, 20, 30];
  const thresholdOptions = [5, 10, 15, 20, 25];
  let bestLookforward = 20;
  let bestThreshold = 15;
  let bestPassOneRate = 0;

  logMsg("Pass 1: Optimale Lookforward-Periode und Signal-Schwelle suchen...");
  for (const lf of lookforwardOptions) {
    for (const th of thresholdOptions) {
      let correct = 0, total = 0;
      for (const stock of stockData) {
        const bt = backtestStock(stock.prices, stock.volumes, DEFAULT_WEIGHTS, stock.fundamentals, lf, th);
        correct += bt.correct;
        total += bt.total;
      }
      const rate = total > 0 ? (correct / total) * 100 : 0;
      if (rate > bestPassOneRate && total >= 50) {
        bestPassOneRate = rate;
        bestLookforward = lf;
        bestThreshold = th;
      }
    }
    await new Promise(r => setTimeout(r, 0));
  }
  logMsg(`Pass 1 Ergebnis: Lookforward=${bestLookforward}d, Threshold=${bestThreshold}, Rate=${bestPassOneRate.toFixed(1)}%`);

  // Pass 2: Grid search with optimized parameters
  const weightGrid = generateWeightGrid();
  logMsg(`Pass 2: Grid Search über ${weightGrid.length} Gewichtungskombinationen (LF=${bestLookforward}d, TH=${bestThreshold})...`);

  const results: Array<{ weights: WeightConfig; hitRate: number; correct: number; total: number }> = [];

  for (let wi = 0; wi < weightGrid.length; wi++) {
    const weights = weightGrid[wi];
    let totalCorrect = 0;
    let totalSignals = 0;

    for (const stock of stockData) {
      const bt = backtestStock(stock.prices, stock.volumes, weights, stock.fundamentals, bestLookforward, bestThreshold);
      totalCorrect += bt.correct;
      totalSignals += bt.total;
    }

    const hitRate = totalSignals > 0 ? (totalCorrect / totalSignals) * 100 : 0;
    results.push({ weights, hitRate, correct: totalCorrect, total: totalSignals });

    if (wi % 10 === 0) {
      await new Promise(r => setTimeout(r, 0));
      if (wi % 50 === 0) {
        logMsg(`Grid Search Fortschritt: ${wi}/${weightGrid.length} (${((wi / weightGrid.length) * 100).toFixed(0)}%)`);
      }
    }
  }

  // Pass 3: Fine-tune around top 5 results
  results.sort((a, b) => b.hitRate - a.hitRate);
  const topResults = results.slice(0, 5);
  logMsg(`Pass 3: Feinabstimmung der Top-5 Gewichtungen...`);

  const refinedResults: typeof results = [...results];
  for (const topResult of topResults) {
    // Generate 20 variations around each top result
    for (let v = 0; v < 20; v++) {
      const variant: WeightConfig = { ...topResult.weights };
      // Randomly adjust 2-3 weights by ±0.03
      const keys = Object.keys(variant) as (keyof WeightConfig)[];
      const numAdjust = 2 + Math.floor(Math.random() * 2);
      for (let a = 0; a < numAdjust; a++) {
        const key = keys[Math.floor(Math.random() * keys.length)];
        const delta = (Math.random() - 0.5) * 0.06; // ±0.03
        variant[key] = Math.max(0.02, Math.min(0.30, variant[key] + delta));
      }

      let totalCorrect = 0, totalSignals = 0;
      for (const stock of stockData) {
        const bt = backtestStock(stock.prices, stock.volumes, variant, stock.fundamentals, bestLookforward, bestThreshold);
        totalCorrect += bt.correct;
        totalSignals += bt.total;
      }
      const hitRate = totalSignals > 0 ? (totalCorrect / totalSignals) * 100 : 0;
      refinedResults.push({ weights: variant, hitRate, correct: totalCorrect, total: totalSignals });
    }
    await new Promise(r => setTimeout(r, 0));
  }

  // 4. Sort all results and get the best
  refinedResults.sort((a, b) => b.hitRate - a.hitRate);
  const best = refinedResults[0];

  logMsg(`✅ Beste In-Sample Trefferquote: ${best.hitRate.toFixed(1)}% (${best.correct}/${best.total} Signale korrekt)`);
  logMsg(`   Lookforward: ${bestLookforward} Tage, Threshold: ${bestThreshold}`);

  // ═══════════════════════════════════════════════════════════════════
  // 5. WALK-FORWARD VALIDATION (80/20 Split)
  // Use the first 80% of each stock's price history as in-sample (training)
  // and the last 20% as out-of-sample (validation) to detect overfitting
  // ═══════════════════════════════════════════════════════════════════
  logMsg("Walk-Forward Validierung: 80/20 Split...");

  let inSampleCorrect = 0, inSampleTotal = 0;
  let outOfSampleCorrect = 0, outOfSampleTotal = 0;
  let wfProcessed = 0;
  const wfEligible = stockData.filter(s => Math.floor(s.prices.length * 0.8) >= 80).length;

  for (let si = 0; si < stockData.length; si++) {
    const stock = stockData[si];
    const splitIdx = Math.floor(stock.prices.length * 0.8);
    if (splitIdx < 80) continue; // Need enough in-sample data

    const inSamplePrices = stock.prices.slice(0, splitIdx);
    const outOfSamplePrices = stock.prices.slice(splitIdx - 60); // Overlap for indicator calculation

    // In-sample backtest
    const inBt = backtestStock(inSamplePrices, stock.volumes.slice(0, splitIdx), best.weights, stock.fundamentals, bestLookforward, bestThreshold);
    inSampleCorrect += inBt.correct;
    inSampleTotal += inBt.total;

    // Out-of-sample backtest (validation)
    const outBt = backtestStock(outOfSamplePrices, stock.volumes.slice(splitIdx - 60), best.weights, stock.fundamentals, bestLookforward, bestThreshold);
    outOfSampleCorrect += outBt.correct;
    outOfSampleTotal += outBt.total;

    wfProcessed++;
    if (wfProcessed % 10 === 0 || wfProcessed === wfEligible) {
      logMsg(`Walk-Forward Fortschritt: ${wfProcessed}/${wfEligible} Titel validiert (${((wfProcessed / wfEligible) * 100).toFixed(0)}%)`);
    }
    // Yield to event loop every 5 stocks
    if (si % 5 === 0) await new Promise(r => setTimeout(r, 0));
  }

  const inSampleHitRate = inSampleTotal > 0 ? (inSampleCorrect / inSampleTotal) * 100 : 0;
  const outOfSampleHitRate = outOfSampleTotal > 0 ? (outOfSampleCorrect / outOfSampleTotal) * 100 : 0;
  const overfitRatio = outOfSampleHitRate > 0 ? inSampleHitRate / outOfSampleHitRate : 999;

  logMsg(`📊 Walk-Forward Ergebnis:`);
  logMsg(`   In-Sample:  ${inSampleHitRate.toFixed(1)}% (${inSampleCorrect}/${inSampleTotal})`);
  logMsg(`   Out-of-Sample: ${outOfSampleHitRate.toFixed(1)}% (${outOfSampleCorrect}/${outOfSampleTotal})`);
  logMsg(`   Overfit-Ratio: ${overfitRatio.toFixed(2)} (ideal: ~1.0, >1.3 = Overfitting)`);

  if (overfitRatio > 1.3) {
    logMsg(`⚠️ Mögliches Overfitting erkannt (Ratio ${overfitRatio.toFixed(2)}). Verwende konservativere Gewichte.`);
    // Use a blend of best weights and default weights to reduce overfitting
    const blendFactor = 0.6; // 60% optimized, 40% default
    const keys = Object.keys(best.weights) as (keyof WeightConfig)[];
    for (const key of keys) {
      best.weights[key] = best.weights[key] * blendFactor + DEFAULT_WEIGHTS[key] * (1 - blendFactor);
    }
    logMsg(`   → Gewichte mit Default geblendet (60/40) zur Regularisierung`);
  }

  logMsg(`Optimale Gewichtung gefunden in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  logMsg(`Verarbeitete Titel: ${stockData.length}/${allStocks.length}`);

  return {
    bestWeights: best.weights,
    hitRate: best.hitRate,
    totalBacktested: best.total,
    correctSignals: best.correct,
    topCombinations: refinedResults.slice(0, 10).map(r => ({ weights: r.weights, hitRate: r.hitRate })),
    log,
    durationMs: Date.now() - startTime,
    walkForward: {
      inSampleHitRate,
      outOfSampleHitRate,
      inSampleCount: inSampleTotal,
      outOfSampleCount: outOfSampleTotal,
      overfitRatio,
    },
    totalStocksProcessed: stockData.length,
    batchInfo: `${stockData.length}/${allStocks.length} Titel verarbeitet`,
  };
}

/**
 * Save optimizer result to database
 */
export async function saveOptimizerResult(result: OptimizerResult): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Deactivate all existing weights
  await db.update(signalWeights).set({ isActive: 0 });

  // Insert new optimized weights
  await db.insert(signalWeights).values({
    name: `optimized_${new Date().toISOString().split('T')[0]}`,
    weights: JSON.stringify(result.bestWeights),
    hitRate: result.hitRate.toFixed(2),
    totalBacktested: result.totalBacktested,
    correctSignals: result.correctSignals,
    lastRunAt: new Date(),
    isActive: 1,
    optimizerLog: JSON.stringify({
      durationMs: result.durationMs,
      topCombinations: result.topCombinations.slice(0, 5),
      log: result.log.slice(-20),
      walkForward: result.walkForward,
      totalStocksProcessed: result.totalStocksProcessed,
      batchInfo: result.batchInfo,
    }),
  });
}

/**
 * Get active weights from DB (or default)
 */
export async function getActiveWeights(): Promise<WeightConfig> {
  const db = await getDb();
  if (!db) return DEFAULT_WEIGHTS;

  const active = await db
    .select()
    .from(signalWeights)
    .where(eq(signalWeights.isActive, 1))
    .limit(1);

  if (active.length === 0) return DEFAULT_WEIGHTS;

  try {
    const parsed = JSON.parse(active[0].weights as string);
    // Ensure backward compatibility: add missing weights from older optimizations
    if (parsed.bubble === undefined) {
      parsed.bubble = DEFAULT_WEIGHTS.bubble;
    }
    if (parsed.quality === undefined) {
      parsed.quality = DEFAULT_WEIGHTS.quality;
    }
    if (parsed.momentum === undefined) {
      parsed.momentum = DEFAULT_WEIGHTS.momentum;
    }
    return parsed as WeightConfig;
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

/**
 * Get optimizer history
 */
export async function getOptimizerHistory() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(signalWeights)
    .orderBy(desc(signalWeights.lastRunAt))
    .limit(20);
}
