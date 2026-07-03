/**
 * Signal Auto-Optimizer
 * =====================
 * Backtests all watchlist stocks (113 titles), iteratively tunes indicator weights
 * via grid search to maximize the hit rate of trading signals.
 * 
 * Hit Rate = % of signals where the price moved in the predicted direction
 * within 30 trading days after the signal was generated.
 * 
 * Indicators and their weight ranges:
 * - P/E Ratio: 0.05 – 0.25
 * - PEG Ratio: 0.05 – 0.20
 * - RSI (14): 0.05 – 0.25
 * - MACD: 0.05 – 0.20
 * - Dividend Yield: 0.05 – 0.15
 * - 52-Week Range: 0.05 – 0.15
 * - YTD Performance: 0.05 – 0.15
 * - Random Forest: 0.05 – 0.25
 * - Sentiment: 0.02 – 0.10
 */

import { getDb } from "../db";
import { watchlistStocks, signalWeights } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { randomForestSignal } from "./mlEngine";

import { ENV } from "../_core/env";
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
}

export interface OptimizerResult {
  bestWeights: WeightConfig;
  hitRate: number;
  totalBacktested: number;
  correctSignals: number;
  topCombinations: Array<{ weights: WeightConfig; hitRate: number }>;
  log: string[];
  durationMs: number;
}

// Default weights (pre-optimization)
export const DEFAULT_WEIGHTS: WeightConfig = {
  pe: 0.15,
  peg: 0.10,
  rsi: 0.20,
  macd: 0.10,
  dividend: 0.10,
  week52: 0.10,
  ytd: 0.10,
  rf: 0.10,
  sentiment: 0.05,
};

/**
 * Normalize ticker: strip .US suffix for US stocks, keep .SW for Swiss
 */
function normalizeTicker(ticker: string): string {
  if (ticker.endsWith(".US")) return ticker.slice(0, -3);
  return ticker;
}

/**
 * Calculate RSI from closing prices
 */
function calcRSI(prices: number[], period: number = 14): number | null {
  if (prices.length < period + 1) return null;
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  const relevantChanges = changes.slice(-period * 3);
  if (relevantChanges.length < period) return null;

  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (relevantChanges[i] > 0) avgGain += relevantChanges[i];
    else avgLoss += Math.abs(relevantChanges[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period; i < relevantChanges.length; i++) {
    const change = relevantChanges[i];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

/**
 * Calculate MACD signal
 * Returns: positive = bullish, negative = bearish
 */
function calcMACD(prices: number[]): number {
  if (prices.length < 26) return 0;
  
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);
  const macdLine = ema12 - ema26;
  
  // Simple signal: MACD line relative to zero
  return macdLine / (prices[prices.length - 1] || 1) * 100; // Normalize to percentage
}

function calcEMA(prices: number[], period: number): number {
  const multiplier = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  return ema;
}

/**
 * Generate a weighted signal score for a stock at a given point in time
 * Returns a score from -100 (strong sell) to +100 (strong buy)
 */
function generateWeightedScore(
  weights: WeightConfig,
  indicators: {
    peRatio: number | null;
    pegRatio: number | null;
    rsi14: number | null;
    macdSignal: number;
    dividendYield: number;
    positionIn52W: number | null; // 0-1 position in 52-week range
    ytdPerformance: number;
    rfScore: number | null;
    sentimentScore: number | null;
  }
): number {
  let score = 0;
  let totalWeight = 0;

  // P/E contribution (-1 to +1)
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

  // PEG contribution
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

  // RSI contribution
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

  // MACD contribution
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

  // Dividend contribution
  {
    let divScore = 0;
    if (indicators.dividendYield > 5) divScore = 1;
    else if (indicators.dividendYield > 3) divScore = 0.5;
    else if (indicators.dividendYield > 1.5) divScore = 0.2;
    else divScore = 0;
    score += weights.dividend * divScore;
    totalWeight += weights.dividend;
  }

  // 52-Week Range contribution
  if (indicators.positionIn52W !== null) {
    let w52Score = 0;
    if (indicators.positionIn52W < 0.2) w52Score = 1;
    else if (indicators.positionIn52W < 0.35) w52Score = 0.5;
    else if (indicators.positionIn52W < 0.65) w52Score = 0;
    else if (indicators.positionIn52W < 0.85) w52Score = -0.3;
    else w52Score = -0.7;
    score += weights.week52 * w52Score;
    totalWeight += weights.week52;
  }

  // YTD Performance contribution (contrarian)
  {
    let ytdScore = 0;
    if (indicators.ytdPerformance < -25) ytdScore = 1;
    else if (indicators.ytdPerformance < -15) ytdScore = 0.5;
    else if (indicators.ytdPerformance < 15) ytdScore = 0;
    else if (indicators.ytdPerformance < 35) ytdScore = -0.3;
    else ytdScore = -0.7;
    score += weights.ytd * ytdScore;
    totalWeight += weights.ytd;
  }

  // Random Forest contribution
  if (indicators.rfScore !== null) {
    // RF score is 0-100, normalize to -1 to +1
    const rfNormalized = (indicators.rfScore - 50) / 50;
    score += weights.rf * rfNormalized;
    totalWeight += weights.rf;
  }

  // Sentiment contribution
  if (indicators.sentimentScore !== null) {
    // Sentiment score is -1 to +1
    score += weights.sentiment * indicators.sentimentScore;
    totalWeight += weights.sentiment;
  }

  // Normalize by total weight to get -1 to +1 range, then scale to -100 to +100
  if (totalWeight > 0) {
    return (score / totalWeight) * 100;
  }
  return 0;
}

/**
 * Fetch historical price data for a ticker (12 months)
 * Primary: EODHD API (reliable, no rate limiting)
 * Fallback: Yahoo Finance (if EODHD fails)
 */
async function fetchHistoricalPrices(ticker: string): Promise<{
  dates: Date[];
  prices: number[];
  volumes: number[];
} | null> {
  // Try EODHD first
  const eodhResult = await fetchFromEODHD(ticker);
  if (eodhResult) return eodhResult;

  // Fallback to Yahoo Finance
  const yahooResult = await fetchFromYahoo(ticker);
  if (yahooResult) return yahooResult;

  return null;
}

/**
 * Fetch from EODHD API (primary source)
 */
async function fetchFromEODHD(ticker: string): Promise<{
  dates: Date[];
  prices: number[];
  volumes: number[];
} | null> {
  const apiKey = ENV.eodhdApiKey;
  if (!apiKey) return null;

  try {
    const endDate = new Date();
    const startDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000); // ~13 months
    const fromDate = startDate.toISOString().split("T")[0];
    const toDate = endDate.toISOString().split("T")[0];

    // EODHD expects format like NESN.SW, AAPL.US
    let eodhTicker = ticker;
    if (!ticker.includes(".")) {
      eodhTicker = `${ticker}.US`; // Default to US if no suffix
    }

    const url = `https://eodhd.com/api/eod/${eodhTicker}?api_token=${apiKey}&from=${fromDate}&to=${toDate}&fmt=json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });

    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data) || data.length < 60) return null;

    return {
      dates: data.map((d: any) => new Date(d.date)),
      prices: data.map((d: any) => d.close).filter((c: any) => c != null),
      volumes: data.map((d: any) => d.volume || 0),
    };
  } catch (e) {
    return null;
  }
}

/**
 * Fetch from Yahoo Finance (fallback)
 */
async function fetchFromYahoo(ticker: string): Promise<{
  dates: Date[];
  prices: number[];
  volumes: number[];
} | null> {
  try {
    const YahooFinanceClass = (await import("yahoo-finance2")).default;
    const yahooFinance = new (YahooFinanceClass as any)();
    const normalizedTicker = normalizeTicker(ticker);
    const endDate = new Date();
    const startDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);

    const chartResult = await yahooFinance.chart(normalizedTicker, {
      period1: startDate.toISOString().split("T")[0],
      period2: endDate.toISOString().split("T")[0],
      interval: "1d",
    }) as any;

    const quotes = chartResult.quotes ?? [];
    if (quotes.length < 60) return null;

    return {
      dates: quotes.map((q: any) => new Date(q.date)),
      prices: quotes.map((q: any) => q.close).filter((c: any) => c != null),
      volumes: quotes.map((q: any) => q.volume || 0),
    };
  } catch (e) {
    return null;
  }
}

/**
 * Backtest a single stock with given weights
 * Simulates signals every 30 days and checks if price moved in predicted direction
 */
function backtestStock(
  prices: number[],
  volumes: number[],
  weights: WeightConfig,
  fundamentals: { peRatio: number | null; pegRatio: number | null; dividendYield: number }
): { correct: number; total: number } {
  let correct = 0;
  let total = 0;

  // Generate signals every 30 days (starting from day 60 to have enough history)
  const SIGNAL_INTERVAL = 30;
  const LOOKFORWARD = 20; // Check price 20 trading days later
  const MIN_HISTORY = 60;

  for (let day = MIN_HISTORY; day < prices.length - LOOKFORWARD; day += SIGNAL_INTERVAL) {
    const historicalPrices = prices.slice(0, day + 1);
    const historicalVolumes = volumes.slice(0, day + 1);
    const currentPrice = prices[day];
    const futurePrice = prices[day + LOOKFORWARD];

    if (!currentPrice || !futurePrice || currentPrice === 0) continue;

    // Calculate indicators at this point in time
    const rsi14 = calcRSI(historicalPrices, 14);
    const macdSignal = calcMACD(historicalPrices);
    
    // 52-week range position
    const last252 = historicalPrices.slice(-252);
    const high52 = Math.max(...last252);
    const low52 = Math.min(...last252);
    const positionIn52W = high52 > low52 ? (currentPrice - low52) / (high52 - low52) : null;

    // YTD performance (approximate)
    const ytdStart = Math.max(0, historicalPrices.length - 120); // ~6 months lookback
    const ytdPerformance = historicalPrices[ytdStart] > 0
      ? ((currentPrice - historicalPrices[ytdStart]) / historicalPrices[ytdStart]) * 100
      : 0;

    // RF score (if enough data)
    let rfScore: number | null = null;
    try {
      if (historicalPrices.length >= 60) {
        const rf = randomForestSignal(historicalPrices, historicalVolumes, fundamentals);
        rfScore = rf.score;
      }
    } catch (e) {
      // RF failed
    }

    // Generate weighted score
    const score = generateWeightedScore(weights, {
      peRatio: fundamentals.peRatio,
      pegRatio: fundamentals.pegRatio,
      rsi14,
      macdSignal,
      dividendYield: fundamentals.dividendYield,
      positionIn52W,
      ytdPerformance,
      rfScore,
      sentimentScore: null, // Not available for historical backtest
    });

    // Only count signals with conviction (score > 15 or < -15)
    if (Math.abs(score) < 15) continue;

    total++;

    // Check if signal was correct
    const priceChange = (futurePrice - currentPrice) / currentPrice;
    const predictedDirection = score > 0 ? 1 : -1;
    const actualDirection = priceChange > 0.005 ? 1 : priceChange < -0.005 ? -1 : 0;

    if (predictedDirection === actualDirection) {
      correct++;
    } else if (actualDirection === 0) {
      // Price didn't move significantly - count as half correct for hold-equivalent
      correct += 0.5;
    }
  }

  return { correct, total };
}

/**
 * Generate weight combinations for grid search
 * Uses a coarse grid to keep computation manageable
 */
function generateWeightGrid(): WeightConfig[] {
  const combinations: WeightConfig[] = [];
  
  // Coarse grid: 3 levels per indicator
  const peOptions = [0.08, 0.15, 0.22];
  const pegOptions = [0.05, 0.12, 0.18];
  const rsiOptions = [0.10, 0.18, 0.25];
  const macdOptions = [0.05, 0.12, 0.18];
  const dividendOptions = [0.05, 0.10, 0.15];
  const week52Options = [0.05, 0.10, 0.15];
  const ytdOptions = [0.05, 0.10, 0.15];
  const rfOptions = [0.08, 0.15, 0.22];
  const sentimentOptions = [0.03, 0.06, 0.10];

  // Strategic sampling: instead of full grid (3^9 = 19683 combos),
  // use Latin hypercube-style sampling with ~200 combinations
  const SAMPLE_SIZE = 200;
  
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const config: WeightConfig = {
      pe: peOptions[Math.floor(Math.random() * peOptions.length)],
      peg: pegOptions[Math.floor(Math.random() * pegOptions.length)],
      rsi: rsiOptions[Math.floor(Math.random() * rsiOptions.length)],
      macd: macdOptions[Math.floor(Math.random() * macdOptions.length)],
      dividend: dividendOptions[Math.floor(Math.random() * dividendOptions.length)],
      week52: week52Options[Math.floor(Math.random() * week52Options.length)],
      ytd: ytdOptions[Math.floor(Math.random() * ytdOptions.length)],
      rf: rfOptions[Math.floor(Math.random() * rfOptions.length)],
      sentiment: sentimentOptions[Math.floor(Math.random() * sentimentOptions.length)],
    };
    combinations.push(config);
  }

  // Always include the default weights
  combinations.push(DEFAULT_WEIGHTS);

  return combinations;
}

/**
 * Run the full optimization process
 * 1. Fetch all watchlist stocks
 * 2. Download 12 months of price data for each
 * 3. Grid search over weight combinations
 * 4. Return best weights with hit rate
 */
export async function runOptimizer(
  progressCallback?: (msg: string) => void
): Promise<OptimizerResult> {
  const startTime = Date.now();
  const log: string[] = [];
  const logMsg = (msg: string) => {
    log.push(`[${new Date().toISOString()}] ${msg}`);
    progressCallback?.(msg);
  };

  logMsg("Signal Auto-Optimizer gestartet...");

  // 1. Fetch all active watchlist stocks
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const allStocks = await db
    .select()
    .from(watchlistStocks)
    .where(eq(watchlistStocks.isActive, 1));

  logMsg(`${allStocks.length} aktive Watchlist-Titel gefunden`);

  // 2. Fetch historical prices for stocks (with rate limiting)
  // Limit to 40 stocks max to avoid blocking the server for too long
  const MAX_STOCKS = 40;
  const stocksToProcess = allStocks.slice(0, MAX_STOCKS);
  
  const stockData: Array<{
    ticker: string;
    prices: number[];
    volumes: number[];
    fundamentals: { peRatio: number | null; pegRatio: number | null; dividendYield: number };
  }> = [];

  const BATCH_SIZE = 3; // Smaller batches to not overwhelm the event loop
  let fetchedCount = 0;

  for (let i = 0; i < stocksToProcess.length; i += BATCH_SIZE) {
    const batch = stocksToProcess.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (stock) => {
        const data = await fetchHistoricalPrices(stock.ticker);
        if (data && data.prices.length >= 60) {
          return {
            ticker: stock.ticker,
            prices: data.prices,
            volumes: data.volumes,
            fundamentals: {
              peRatio: stock.peRatio ? parseFloat(stock.peRatio) : null,
              pegRatio: stock.pegRatio ? parseFloat(stock.pegRatio) : null,
              dividendYield: stock.dividendYield ? parseFloat(stock.dividendYield) : 0,
            },
          };
        }
        return null;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        stockData.push(result.value);
        fetchedCount++;
      }
    }

    logMsg(`Preisdaten geladen: ${fetchedCount}/${stocksToProcess.length}`);
    
    // Yield to event loop between batches
    await new Promise(r => setTimeout(r, 1000));
  }

  logMsg(`${stockData.length} Titel mit ausreichend Daten für Backtest`);

  if (stockData.length < 5) {
    throw new Error("Zu wenige Titel mit ausreichend Preisdaten für Optimierung");
  }

  // 3. Grid search over weight combinations
  const weightGrid = generateWeightGrid();
  logMsg(`Grid Search: ${weightGrid.length} Gewichtungskombinationen werden getestet...`);

  const results: Array<{ weights: WeightConfig; hitRate: number; correct: number; total: number }> = [];

  for (let wi = 0; wi < weightGrid.length; wi++) {
    const weights = weightGrid[wi];
    let totalCorrect = 0;
    let totalSignals = 0;

    for (const stock of stockData) {
      const bt = backtestStock(stock.prices, stock.volumes, weights, stock.fundamentals);
      totalCorrect += bt.correct;
      totalSignals += bt.total;
    }

    // Yield to event loop every 20 combinations
    if (wi % 20 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }

    const hitRate = totalSignals > 0 ? (totalCorrect / totalSignals) * 100 : 0;
    results.push({ weights, hitRate, correct: totalCorrect, total: totalSignals });

    // Progress update every 50 combinations
    if ((wi + 1) % 50 === 0) {
      logMsg(`Grid Search Fortschritt: ${wi + 1}/${weightGrid.length} (beste Trefferquote bisher: ${Math.max(...results.map(r => r.hitRate)).toFixed(1)}%)`);
    }
  }

  // 4. Sort by hit rate and get top results
  results.sort((a, b) => b.hitRate - a.hitRate);
  const best = results[0];
  const topCombinations = results.slice(0, 10).map(r => ({
    weights: r.weights,
    hitRate: Math.round(r.hitRate * 100) / 100,
  }));

  logMsg(`Optimierung abgeschlossen!`);
  logMsg(`Beste Trefferquote: ${best.hitRate.toFixed(2)}% (${Math.round(best.correct)}/${best.total} Signale korrekt)`);
  logMsg(`Beste Gewichte: PE=${best.weights.pe}, RSI=${best.weights.rsi}, MACD=${best.weights.macd}, RF=${best.weights.rf}`);

  const durationMs = Date.now() - startTime;
  logMsg(`Dauer: ${(durationMs / 1000).toFixed(1)}s`);

  return {
    bestWeights: best.weights,
    hitRate: Math.round(best.hitRate * 100) / 100,
    totalBacktested: best.total,
    correctSignals: Math.round(best.correct),
    topCombinations,
    log,
    durationMs,
  };
}

/**
 * Save optimizer results to database
 */
export async function saveOptimizerResult(result: OptimizerResult): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Deactivate all existing weights
  await db.update(signalWeights).set({ isActive: 0 });

  // Insert new best weights as active
  await db.insert(signalWeights).values({
    name: `optimizer_${new Date().toISOString().split('T')[0]}`,
    weights: result.bestWeights,
    hitRate: result.hitRate.toFixed(2),
    totalBacktested: result.totalBacktested,
    correctSignals: result.correctSignals,
    isActive: 1,
    optimizerLog: JSON.stringify(result.log),
    lastRunAt: new Date(),
  });
}

/**
 * Get the currently active signal weights from DB
 * Falls back to DEFAULT_WEIGHTS if none found
 */
export async function getActiveWeights(): Promise<WeightConfig> {
  try {
    const db = await getDb();
    if (!db) return DEFAULT_WEIGHTS;

    const [active] = await db
      .select()
      .from(signalWeights)
      .where(eq(signalWeights.isActive, 1))
      .orderBy(desc(signalWeights.createdAt))
      .limit(1);

    if (active && active.weights) {
      return active.weights as unknown as WeightConfig;
    }
  } catch (e) {
    console.warn("[SignalOptimizer] Failed to load active weights:", e);
  }
  return DEFAULT_WEIGHTS;
}

/**
 * Get optimizer history
 */
export async function getOptimizerHistory(): Promise<Array<{
  id: number;
  name: string;
  weights: WeightConfig;
  hitRate: number;
  totalBacktested: number;
  isActive: boolean;
  lastRunAt: Date | null;
  createdAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(signalWeights)
    .orderBy(desc(signalWeights.createdAt))
    .limit(20);

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    weights: r.weights as unknown as WeightConfig,
    hitRate: r.hitRate ? parseFloat(r.hitRate) : 0,
    totalBacktested: r.totalBacktested ?? 0,
    isActive: r.isActive === 1,
    lastRunAt: r.lastRunAt,
    createdAt: r.createdAt,
  }));
}
