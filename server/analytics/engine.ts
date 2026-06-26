/**
 * Analytics Engine (Node.js)
 * ==========================
 * Pure TypeScript implementation of portfolio analytics.
 * Replaces the Python microservice so analytics work in Cloud deployment.
 *
 * Implements:
 *  - Risk metrics: VaR, CVaR, Sharpe, Sortino, Calmar, Beta, Max Drawdown
 *  - DCF valuation using Yahoo Finance fundamentals
 *  - Portfolio optimization: Max Sharpe, Min Variance, Equal Weight (Efficient Frontier)
 *  - Technical Analysis: RSI, MACD, Bollinger Bands
 */

import YahooFinanceClass from "yahoo-finance2";
import {
  TRADING_DAYS_YEAR,
  SQRT_TRADING_DAYS,
  DEFAULT_RISK_FREE_RATE,
  mean,
  std,
  percentile,
  normInv,
  calcSharpe,
  calcSortino,
  calcVarHistorical,
  calcVarParametric,
  calcCVar,
  calcMaxDrawdown,
  calcBeta,
  calcVolatility,
  calcCalmar,
  alignReturnsByDate,
  type DatedReturns,
} from "./riskStats";
// yahoo-finance2 v3: default export is a constructor class
const yahooFinance = new (YahooFinanceClass as any)();

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface HoldingInput {
  ticker: string;
  weight: number;
  currency?: string;
}

export interface RiskMetricsInput {
  holdings: HoldingInput[];
  benchmark?: string;
  riskFreeRate?: number;
  confidenceLevel?: number;
  lookbackDays?: number;
}

export interface DCFInput {
  ticker: string;
  riskFreeRate?: number;
  marketRiskPremium?: number;
  terminalGrowthRate?: number;
  projectionYears?: number;
}

export interface OptimizeInput {
  tickers: string[];
  lookbackDays?: number;
  riskFreeRate?: number;
  method?: "max_sharpe" | "min_variance" | "equal_weight" | "max_dividend";
}

export interface TechnicalAnalysisInput {
  ticker: string;
  lookbackDays?: number;
}

export interface TechnicalIndicators {
  ticker: string;
  companyName: string;
  currentPrice: number;
  rsi: {
    value: number;
    signal: "oversold" | "neutral" | "overbought";
    description: string;
  };
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
    signal: "bullish" | "neutral" | "bearish";
    description: string;
    history: Array<{ date: string; macd: number; signal: number; histogram: number }>;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
    percentB: number;
    signal: "oversold" | "neutral" | "overbought";
    description: string;
    history: Array<{ date: string; upper: number; middle: number; lower: number; close: number }>;
  };
  priceHistory: Array<{ date: string; close: number }>;
  rsiHistory: Array<{ date: string; value: number }>;
  overallSignal: "buy" | "hold" | "sell";
  overallDescription: string;
}

// ─────────────────────────────────────────────
// Ticker Normalization
// ─────────────────────────────────────────────
function normalizeTicker(ticker: string): string {
  if (ticker.endsWith(".US")) return ticker.slice(0, -3);
  return ticker;
}

// ─────────────────────────────────────────────
// Data Fetching
// ─────────────────────────────────────────────
async function fetchReturns(
  tickers: string[],
  lookbackDays: number
): Promise<{ [ticker: string]: number[] }> {
  const normalizedMap: { [orig: string]: string } = {};
  for (const t of tickers) {
    normalizedMap[t] = normalizeTicker(t);
  }
  const uniqueNormalized = Array.from(new Set(Object.values(normalizedMap)));

  const end = new Date();
  const start = new Date(end.getTime() - lookbackDays * 1.5 * 24 * 60 * 60 * 1000);

  const pricesByNorm: { [norm: string]: number[] } = {};

  // Fetch each ticker individually to handle errors gracefully
  await Promise.allSettled(
    uniqueNormalized.map(async (norm) => {
      try {
        const result = await yahooFinance.chart(norm, {
          period1: start.toISOString().split("T")[0],
          period2: end.toISOString().split("T")[0],
          interval: "1d",
        }) as any;
        const quotes = (result.quotes ?? result.indicators?.quote?.[0] ?? []) as any[];
        const prices = quotes
          .filter((q) => q.close != null)
          .map((q) => q.close as number);
        if (prices.length > 5) {
          pricesByNorm[norm] = prices;
        }
      } catch {
        // Skip tickers with no data
      }
    })
  );

  // Map back to original tickers
  const returnsMap: { [ticker: string]: number[] } = {};
  for (const orig of tickers) {
    const norm = normalizedMap[orig];
    const prices = pricesByNorm[norm];
    if (prices && prices.length > 1) {
      const returns: number[] = [];
      for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }
      returnsMap[orig] = returns;
    }
  }

  return returnsMap;
}

/**
 * Like fetchReturns, but keeps the trading date for each return so series from
 * different exchanges can be aligned by date (see alignReturnsByDate). Each
 * return at index i is the move from day i to day i+1 and is dated with day i+1.
 */
async function fetchReturnsWithDates(
  tickers: string[],
  lookbackDays: number,
): Promise<{ [ticker: string]: DatedReturns }> {
  const normalizedMap: { [orig: string]: string } = {};
  for (const t of tickers) {
    normalizedMap[t] = normalizeTicker(t);
  }
  const uniqueNormalized = Array.from(new Set(Object.values(normalizedMap)));

  const end = new Date();
  const start = new Date(end.getTime() - lookbackDays * 1.5 * 24 * 60 * 60 * 1000);

  const seriesByNorm: { [norm: string]: { dates: string[]; prices: number[] } } = {};

  await Promise.allSettled(
    uniqueNormalized.map(async (norm) => {
      try {
        const result = await yahooFinance.chart(norm, {
          period1: start.toISOString().split("T")[0],
          period2: end.toISOString().split("T")[0],
          interval: "1d",
        }) as any;
        const quotes = (result.quotes ?? result.indicators?.quote?.[0] ?? []) as any[];
        const dates: string[] = [];
        const prices: number[] = [];
        for (const q of quotes) {
          if (q.close == null || q.date == null) continue;
          const d = q.date instanceof Date ? q.date : new Date(q.date);
          dates.push(d.toISOString().split("T")[0]);
          prices.push(q.close as number);
        }
        if (prices.length > 5) {
          seriesByNorm[norm] = { dates, prices };
        }
      } catch {
        // Skip tickers with no data
      }
    })
  );

  const out: { [ticker: string]: DatedReturns } = {};
  for (const orig of tickers) {
    const s = seriesByNorm[normalizedMap[orig]];
    if (s && s.prices.length > 1) {
      const dates: string[] = [];
      const returns: number[] = [];
      for (let i = 1; i < s.prices.length; i++) {
        returns.push((s.prices[i] - s.prices[i - 1]) / s.prices[i - 1]);
        dates.push(s.dates[i]);
      }
      out[orig] = { dates, returns };
    }
  }
  return out;
}

// ─────────────────────────────────────────────
// Linear-algebra helpers (optimizer)
// mean/std/percentile and all risk metrics live in ./riskStats (unit-tested).
// ─────────────────────────────────────────────
function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function matVecMul(mat: number[][], vec: number[]): number[] {
  return mat.map((row) => dotProduct(row, vec));
}

// ─────────────────────────────────────────────
// Portfolio weighted returns
// ─────────────────────────────────────────────
function weightedReturns(
  returnsMap: { [ticker: string]: number[] },
  tickers: string[],
  weights: number[]
): number[] {
  const n = Math.min(...tickers.map((t) => returnsMap[t]?.length ?? 0));
  if (n === 0) return [];
  const result = new Array(n).fill(0);
  for (let i = 0; i < tickers.length; i++) {
    const r = returnsMap[tickers[i]];
    for (let j = 0; j < n; j++) {
      result[j] += r[j] * weights[i];
    }
  }
  return result;
}

// ─────────────────────────────────────────────
// Covariance matrix
// ─────────────────────────────────────────────
function covarianceMatrix(returnsMap: { [ticker: string]: number[] }, tickers: string[]): number[][] {
  const n = tickers.length;
  const minLen = Math.min(...tickers.map((t) => returnsMap[t]?.length ?? 0));
  const mat: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const ri = returnsMap[tickers[i]].slice(0, minLen);
      const rj = returnsMap[tickers[j]].slice(0, minLen);
      const mi = mean(ri);
      const mj = mean(rj);
      let cov = 0;
      for (let k = 0; k < minLen; k++) {
        cov += (ri[k] - mi) * (rj[k] - mj);
      }
      cov /= minLen - 1;
      mat[i][j] = cov * TRADING_DAYS_YEAR;
      mat[j][i] = mat[i][j];
    }
  }
  return mat;
}

// ─────────────────────────────────────────────
// Portfolio Optimization (Sequential Least Squares)
// ─────────────────────────────────────────────
function portfolioStats(
  weights: number[],
  mu: number[],
  cov: number[][]
): { ret: number; vol: number; sharpe: number } {
  const ret = dotProduct(weights, mu);
  const covW = matVecMul(cov, weights);
  const vol = Math.sqrt(dotProduct(weights, covW));
  const sharpe = vol > 0 ? (ret - DEFAULT_RISK_FREE_RATE) / vol : 0;
  return { ret, vol, sharpe };
}

function optimizeWeights(
  mu: number[],
  cov: number[][],
  method: string,
  riskFreeRate: number,
  dividendYields?: number[]
): number[] {
  const n = mu.length;
  const x0 = new Array(n).fill(1 / n);

  if (method === "equal_weight") return x0;

  // For max_dividend: maximize weighted dividend yield with volatility penalty
  // This produces different results from max_sharpe because it uses dividend yield
  // instead of total return as the objective
  const isDividend = method === "max_dividend";
  const isMinVar = method === "min_variance";
  const isMaxSharpe = method === "max_sharpe";

  function score(w: number[]): number {
    const { ret, vol } = portfolioStats(w, mu, cov);
    if (isDividend && dividendYields) {
      // Objective: maximize portfolio dividend yield / volatility
      const portDivYield = w.reduce((sum, wi, i) => sum + wi * (dividendYields[i] || 0), 0);
      // Penalize high volatility but prioritize dividend income
      return vol > 0 ? portDivYield / (vol * 0.5 + 0.01) : portDivYield;
    } else if (isMaxSharpe) {
      return vol > 0 ? (ret - riskFreeRate) / vol : -Infinity;
    } else if (isMinVar) {
      return -vol; // negate so higher = better
    }
    return 0;
  }

  // Gradient-free optimization using random search + local refinement
  const numTrials = 5000;
  let bestWeights = [...x0];
  let bestScore = score(x0);

  const rng = () => Math.random();

  for (let trial = 0; trial < numTrials; trial++) {
    const raw = Array.from({ length: n }, () => rng());
    const sum = raw.reduce((s, v) => s + v, 0);
    const w = raw.map((v) => v / sum);

    const s = score(w);
    if (s > bestScore) {
      bestScore = s;
      bestWeights = w;
    }
  }

  // Refine with local search
  const stepSizes = [0.05, 0.02, 0.01, 0.005];
  for (const step of stepSizes) {
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const w = [...bestWeights];
          const delta = Math.min(step, w[j]);
          w[i] += delta;
          w[j] -= delta;
          if (w[i] > 1 || w[j] < 0) continue;

          const s = score(w);
          if (s > bestScore) {
            bestScore = s;
            bestWeights = w;
            improved = true;
          }
        }
      }
    }
  }

  return bestWeights;
}

function buildEfficientFrontier(
  mu: number[],
  cov: number[][],
  riskFreeRate: number,
  numPoints = 30
): Array<{ expectedReturn: number; volatility: number; sharpe: number }> {
  const minRet = Math.min(...mu);
  const maxRet = Math.max(...mu);
  const n = mu.length;
  const frontier: Array<{ expectedReturn: number; volatility: number; sharpe: number }> = [];

  for (let i = 0; i < numPoints; i++) {
    const targetRet = minRet + (i / (numPoints - 1)) * (maxRet - minRet);

    // Find min-variance portfolio for this target return
    let bestVol = Infinity;
    let bestW: number[] = [];

    // Random search for feasible portfolios near target return
    for (let trial = 0; trial < 500; trial++) {
      const raw = Array.from({ length: n }, () => Math.random());
      const sum = raw.reduce((s, v) => s + v, 0);
      const w = raw.map((v) => v / sum);
      const { ret, vol } = portfolioStats(w, mu, cov);
      if (Math.abs(ret - targetRet) < 0.05 * (maxRet - minRet) && vol < bestVol) {
        bestVol = vol;
        bestW = w;
      }
    }

    if (bestW.length > 0) {
      const { ret, vol } = portfolioStats(bestW, mu, cov);
      frontier.push({
        expectedReturn: Math.round(ret * 10000) / 10000,
        volatility: Math.round(vol * 10000) / 10000,
        sharpe: vol > 0 ? Math.round(((ret - riskFreeRate) / vol) * 1000) / 1000 : 0,
      });
    }
  }

  return frontier.sort((a, b) => a.volatility - b.volatility);
}

// ─────────────────────────────────────────────
// Public API: Risk Metrics
// ─────────────────────────────────────────────
export async function calcRiskMetrics(input: RiskMetricsInput) {
  const {
    holdings,
    benchmark = "SPY",
    riskFreeRate = DEFAULT_RISK_FREE_RATE,
    confidenceLevel = 0.95,
    lookbackDays = 252,
  } = input;

  const tickers = holdings.map((h) => h.ticker);
  const rawWeights = holdings.map((h) => h.weight);
  const totalW = rawWeights.reduce((s, v) => s + v, 0);
  const weights = totalW > 0 ? rawWeights.map((w) => w / totalW) : rawWeights;

  const allTickers = Array.from(new Set([...tickers, benchmark]));
  const datedMap = await fetchReturnsWithDates(allTickers, lookbackDays);

  const available = tickers.filter((t) => datedMap[t]);
  if (available.length === 0) {
    throw new Error("None of the provided tickers returned data.");
  }

  // Recompute weights for available tickers
  const availIdx = available.map((t) => tickers.indexOf(t));
  let weightsAvail = availIdx.map((i) => weights[i]);
  const wSum = weightsAvail.reduce((s, v) => s + v, 0);
  if (wSum > 0) weightsAvail = weightsAvail.map((w) => w / wSum);

  // Align all holdings (and the benchmark) onto common trading dates BEFORE
  // combining them. Without this, series from different exchanges are zipped by
  // array index and the resulting portfolio/covariance/beta/tracking-error are
  // computed across mismatched calendar days.
  const hasBenchmark = !!datedMap[benchmark];
  const alignTickers = hasBenchmark ? [...available, benchmark] : [...available];
  const { returnsByTicker: aligned } = alignReturnsByDate(datedMap, alignTickers);

  const portfolioRets = weightedReturns(aligned, available, weightsAvail);
  const benchmarkRets = hasBenchmark ? (aligned[benchmark] ?? null) : null;
  // Benchmark's own (full-history) returns for its standalone metrics.
  const benchmarkFull = hasBenchmark ? datedMap[benchmark].returns : null;

  const sharpe = calcSharpe(portfolioRets, riskFreeRate);
  const sortino = calcSortino(portfolioRets, riskFreeRate);
  const varHist = calcVarHistorical(portfolioRets, confidenceLevel);
  const varParam = calcVarParametric(portfolioRets, confidenceLevel);
  const cvar = calcCVar(portfolioRets, confidenceLevel);
  const maxDD = calcMaxDrawdown(portfolioRets);
  const volatility = calcVolatility(portfolioRets);
  const calmar = calcCalmar(portfolioRets);
  const annualReturn = mean(portfolioRets) * TRADING_DAYS_YEAR;

  let beta: number | null = null;
  let treynor: number | null = null;
  let informationRatio: number | null = null;

  if (benchmarkRets) {
    // portfolioRets and benchmarkRets are aligned on identical dates here.
    beta = calcBeta(portfolioRets, benchmarkRets);
    if (beta !== 0) {
      treynor = (annualReturn - riskFreeRate) / beta;
    }
    const excess = portfolioRets.map((r, i) => r - benchmarkRets[i]);
    const trackingError = std(excess) * SQRT_TRADING_DAYS;
    if (trackingError > 0) {
      informationRatio = (mean(excess) * TRADING_DAYS_YEAR) / trackingError;
    }
  }

  // Per-asset metrics: standalone risk on the asset's own full history; beta is
  // computed on the asset aligned by date with the benchmark.
  const assetMetrics = available.map((ticker, i) => {
    const ar = datedMap[ticker].returns;
    let assetBeta: number | null = null;
    if (hasBenchmark) {
      const pair = alignReturnsByDate(datedMap, [ticker, benchmark]).returnsByTicker;
      assetBeta = Math.round(calcBeta(pair[ticker] ?? [], pair[benchmark] ?? []) * 1000) / 1000;
    }
    return {
      ticker,
      weight: weightsAvail[i],
      annualReturn: Math.round(mean(ar) * TRADING_DAYS_YEAR * 10000) / 100,
      volatility: Math.round(calcVolatility(ar) * 10000) / 100,
      sharpe: Math.round(calcSharpe(ar, riskFreeRate) * 1000) / 1000,
      beta: assetBeta,
      var95: Math.round(calcVarHistorical(ar, confidenceLevel) * 10000) / 100,
      maxDrawdown: Math.round(calcMaxDrawdown(ar) * 10000) / 100,
    };
  });

  // ── Benchmark metrics for comparison ──
  let benchmarkMetrics: {
    annualReturn: number;
    volatility: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    varHistorical95: number;
    beta: number;
  } | null = null;

  if (benchmarkFull) {
    const bmVol = calcVolatility(benchmarkFull);
    const bmSharpe = calcSharpe(benchmarkFull, riskFreeRate);
    const bmSortino = calcSortino(benchmarkFull, riskFreeRate);
    const bmMaxDD = calcMaxDrawdown(benchmarkFull);
    const bmVarHist = calcVarHistorical(benchmarkFull, confidenceLevel);
    const bmAnnualReturn = mean(benchmarkFull) * TRADING_DAYS_YEAR;
    benchmarkMetrics = {
      annualReturn: Math.round(bmAnnualReturn * 10000) / 100,
      volatility: Math.round(bmVol * 10000) / 100,
      sharpeRatio: Math.round(bmSharpe * 1000) / 1000,
      sortinoRatio: Math.round(bmSortino * 1000) / 1000,
      maxDrawdown: Math.round(bmMaxDD * 10000) / 100,
      varHistorical95: Math.round(bmVarHist * 10000) / 100,
      beta: 1.0,
    };
  }

  // ── Tracking Error ──
  let trackingError: number | null = null;
  if (benchmarkRets) {
    const n = Math.min(portfolioRets.length, benchmarkRets.length);
    const excess = portfolioRets.slice(0, n).map((r, i) => r - benchmarkRets[i]);
    trackingError = Math.round(std(excess) * SQRT_TRADING_DAYS * 10000) / 100;
  }

  // ── Gesamt-Risikoscore (0-100, higher = better) ──
  // Normalization: each metric mapped to 0-100 score, then weighted average
  function normalizeMetric(value: number, min: number, max: number, invert: boolean): number {
    const clamped = Math.max(min, Math.min(max, value));
    const normalized = (clamped - min) / (max - min);
    const score = invert ? (1 - normalized) * 100 : normalized * 100;
    return Math.round(score);
  }

  const volScore = normalizeMetric(volatility * 100, 0, 40, true); // lower vol = better
  const maxDDScore = normalizeMetric(Math.abs(maxDD) * 100, 0, 50, true); // lower DD = better
  const varScore = normalizeMetric(Math.abs(varHist) * 100, 0, 10, true); // lower VaR = better
  const sharpeScore = normalizeMetric(sharpe, -1, 3, false); // higher sharpe = better
  const sortinoScore = normalizeMetric(sortino, -1, 4, false); // higher sortino = better
  const betaScore = beta !== null ? normalizeMetric(Math.abs(beta - 1), 0, 1.5, true) : 50; // closer to 1 = better

  const riskScore = Math.round(
    volScore * 0.2 + maxDDScore * 0.2 + varScore * 0.15 +
    sharpeScore * 0.2 + sortinoScore * 0.15 + betaScore * 0.1
  );

  // Normalized scores for radar chart (0-100, higher = better)
  const normalizedScores = {
    volatility: volScore,
    maxDrawdown: maxDDScore,
    var95: varScore,
    sharpeRatio: sharpeScore,
    sortinoRatio: sortinoScore,
    beta: betaScore,
    informationRatio: informationRatio !== null ? normalizeMetric(informationRatio, -1, 2, false) : 50,
    trackingError: trackingError !== null ? normalizeMetric(trackingError, 0, 20, true) : 50,
  };

  // Benchmark normalized scores
  let benchmarkNormalizedScores: typeof normalizedScores | null = null;
  if (benchmarkMetrics) {
    benchmarkNormalizedScores = {
      volatility: normalizeMetric(benchmarkMetrics.volatility, 0, 40, true),
      maxDrawdown: normalizeMetric(Math.abs(benchmarkMetrics.maxDrawdown), 0, 50, true),
      var95: normalizeMetric(Math.abs(benchmarkMetrics.varHistorical95), 0, 10, true),
      sharpeRatio: normalizeMetric(benchmarkMetrics.sharpeRatio, -1, 3, false),
      sortinoRatio: normalizeMetric(benchmarkMetrics.sortinoRatio, -1, 4, false),
      beta: normalizeMetric(0, 0, 1.5, true), // benchmark beta vs itself = 0 deviation
      informationRatio: 50, // benchmark vs itself = 0
      trackingError: 100, // benchmark vs itself = 0 tracking error = perfect
    };
  }

  return {
    portfolio: {
      annualReturn: Math.round(annualReturn * 10000) / 100,
      volatility: Math.round(volatility * 10000) / 100,
      sharpeRatio: Math.round(sharpe * 1000) / 1000,
      sortinoRatio: Math.round(sortino * 1000) / 1000,
      calmarRatio: Math.round(calmar * 1000) / 1000,
      beta: beta !== null ? Math.round(beta * 1000) / 1000 : null,
      treynorRatio: treynor !== null ? Math.round(treynor * 1000) / 1000 : null,
      informationRatio: informationRatio !== null ? Math.round(informationRatio * 1000) / 1000 : null,
      varHistorical95: Math.round(varHist * 10000) / 100,
      varParametric95: Math.round(varParam * 10000) / 100,
      cvar95: Math.round(cvar * 10000) / 100,
      maxDrawdown: Math.round(maxDD * 10000) / 100,
      trackingError,
      riskScore,
      normalizedScores,
      dataPoints: portfolioRets.length,
      benchmark,
    },
    benchmarkMetrics,
    benchmarkNormalizedScores,
    assets: assetMetrics,
  };
}

// ─────────────────────────────────────────────
// Public API: DCF Valuation
// ─────────────────────────────────────────────

/**
 * Fetch DCF fundamentals from EODHD API (primary source)
 * Returns: currentPrice, freeCashFlow, sharesOutstanding, revenueGrowth, beta, companyName, currency
 */
async function fetchDCFFromEODHD(ticker: string): Promise<{
  currentPrice: number;
  fcf: number;
  shares: number;
  revenueGrowth: number;
  beta: number;
  companyName: string;
  currency: string;
} | null> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    console.warn('[DCF] EODHD API key not configured, falling back to Yahoo Finance');
    return null;
  }

  try {
    // EODHD uses exchange-suffixed tickers (e.g., NVDA.US, NESN.SW)
    let eodhTicker = ticker;
    // If no exchange suffix, add .US for US stocks
    if (!ticker.includes('.')) {
      eodhTicker = `${ticker}.US`;
    }

    const url = `https://eodhd.com/api/fundamentals/${eodhTicker}?api_token=${apiKey}&fmt=json`;
    console.log(`[DCF] Fetching EODHD fundamentals for ${eodhTicker}`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!response.ok) {
      console.warn(`[DCF] EODHD API returned ${response.status} for ${eodhTicker}`);
      return null;
    }

    const data = await response.json();

    // Extract current price from Technicals or Highlights
    let currentPrice = 0;
    if (data.Technicals?.['50DayMA']) {
      // Use real-time quote as fallback
      const quoteUrl = `https://eodhd.com/api/real-time/${eodhTicker}?api_token=${apiKey}&fmt=json`;
      try {
        const quoteRes = await fetch(quoteUrl);
        if (quoteRes.ok) {
          const quoteData = await quoteRes.json();
          currentPrice = quoteData.close || quoteData.previousClose || 0;
        }
      } catch (e) {
        // Use highlights market cap / shares as price estimate
      }
    }
    if (!currentPrice && data.Highlights?.MarketCapitalization && data.SharesStats?.SharesOutstanding) {
      currentPrice = data.Highlights.MarketCapitalization / data.SharesStats.SharesOutstanding;
    }

    // Free Cash Flow from Cash Flow statement
    let fcf: number | null = null;
    if (data.Financials?.Cash_Flow?.yearly) {
      const cfYears = Object.entries(data.Financials.Cash_Flow.yearly)
        .sort(([a], [b]) => b.localeCompare(a)); // Most recent first
      
      if (cfYears.length > 0) {
        const latestCF = cfYears[0][1] as any;
        fcf = parseFloat(latestCF.freeCashFlow || '0');
        
        // Fallback: operating cash flow - capital expenditures
        if (!fcf || fcf <= 0) {
          const opCF = parseFloat(latestCF.totalCashFromOperatingActivities || '0');
          const capex = Math.abs(parseFloat(latestCF.capitalExpenditures || '0'));
          if (opCF > 0) {
            fcf = opCF - capex;
          }
        }
      }
    }

    // Shares outstanding
    let shares = 0;
    if (data.SharesStats?.SharesOutstanding) {
      shares = parseFloat(data.SharesStats.SharesOutstanding);
    } else if (data.outstandingShares?.annual) {
      const annualShares = Object.values(data.outstandingShares.annual) as any[];
      if (annualShares.length > 0) {
        shares = annualShares[annualShares.length - 1]?.shares || 0;
      }
    }

    // Revenue growth from Income Statement
    let revenueGrowth = 0.05; // default 5%
    if (data.Financials?.Income_Statement?.yearly) {
      const isYears = Object.entries(data.Financials.Income_Statement.yearly)
        .sort(([a], [b]) => b.localeCompare(a)); // Most recent first
      
      if (isYears.length >= 2) {
        const latestRevenue = parseFloat((isYears[0][1] as any).totalRevenue || '0');
        const prevRevenue = parseFloat((isYears[1][1] as any).totalRevenue || '0');
        if (prevRevenue > 0 && latestRevenue > 0) {
          revenueGrowth = (latestRevenue - prevRevenue) / prevRevenue;
        }
      }
    }

    // Beta
    const beta = parseFloat(data.Technicals?.Beta || data.Highlights?.Beta || '1.0');

    // Company name
    const companyName = data.General?.Name || ticker;

    // Currency
    const currency = data.General?.CurrencyCode || 'USD';

    // Validate minimum required data
    if (!currentPrice || currentPrice <= 0) {
      console.warn(`[DCF] EODHD: No current price for ${eodhTicker}`);
      return null;
    }
    if (!fcf || fcf <= 0) {
      console.warn(`[DCF] EODHD: No positive FCF for ${eodhTicker}`);
      return null;
    }
    if (!shares || shares <= 0) {
      console.warn(`[DCF] EODHD: No shares outstanding for ${eodhTicker}`);
      return null;
    }

    console.log(`[DCF] EODHD data for ${eodhTicker}: price=${currentPrice}, fcf=${fcf}, shares=${shares}, growth=${(revenueGrowth*100).toFixed(1)}%`);

    return {
      currentPrice,
      fcf,
      shares,
      revenueGrowth,
      beta,
      companyName,
      currency,
    };
  } catch (error: any) {
    console.warn(`[DCF] EODHD fetch failed for ${ticker}:`, error.message);
    return null;
  }
}

/**
 * Fetch DCF fundamentals from Yahoo Finance (fallback source)
 */
async function fetchDCFFromYahoo(ticker: string): Promise<{
  currentPrice: number;
  fcf: number;
  shares: number;
  revenueGrowth: number;
  beta: number;
  companyName: string;
  currency: string;
} | null> {
  try {
    const normalizedTicker = normalizeTicker(ticker);
    const quoteSummary = await yahooFinance.quoteSummary(normalizedTicker, {
      modules: ["financialData", "defaultKeyStatistics", "summaryDetail"],
    }) as any;

    const fd = quoteSummary.financialData as any;
    const ks = quoteSummary.defaultKeyStatistics as any;
    const sd = quoteSummary.summaryDetail as any;

    const currentPrice = fd?.currentPrice ?? sd?.regularMarketPrice;
    if (!currentPrice) return null;

    let fcf: number | null = fd?.freeCashflow ?? null;
    if (!fcf || fcf <= 0) {
      const opCF = fd?.operatingCashflow;
      if (opCF && opCF > 0) {
        fcf = opCF * 0.7;
      }
    }
    if (!fcf || fcf <= 0) return null;

    const shares = ks?.sharesOutstanding ?? ks?.impliedSharesOutstanding;
    if (!shares || shares <= 0) return null;

    const revenueGrowth = fd?.revenueGrowth ?? 0.05;
    const beta = ks?.beta ?? 1.0;
    const companyName = (quoteSummary as any)?.quoteType?.longName ?? ticker;
    const currency = fd?.currency ?? "USD";

    return { currentPrice, fcf, shares, revenueGrowth, beta, companyName, currency };
  } catch (error: any) {
    console.warn(`[DCF] Yahoo Finance fetch failed for ${ticker}:`, error.message);
    return null;
  }
}

export async function calcDCF(input: DCFInput) {
  const {
    ticker,
    riskFreeRate = DEFAULT_RISK_FREE_RATE,
    marketRiskPremium = 0.055,
    terminalGrowthRate = 0.025,
    projectionYears = 5,
  } = input;

  // Try EODHD first (primary), then Yahoo Finance (fallback)
  let fundamentals = await fetchDCFFromEODHD(ticker);
  let dataSource = 'EODHD';
  
  if (!fundamentals) {
    console.log(`[DCF] EODHD failed for ${ticker}, trying Yahoo Finance fallback...`);
    fundamentals = await fetchDCFFromYahoo(ticker);
    dataSource = 'Yahoo Finance';
  }

  if (!fundamentals) {
    throw new Error(`DCF valuation failed: Could not fetch fundamental data for ${ticker} from either EODHD or Yahoo Finance.`);
  }

  const { currentPrice, fcf: rawFcf, shares, beta: betaVal, companyName, currency } = fundamentals;
  let revenueGrowth = fundamentals.revenueGrowth;
  // Cap growth at realistic levels: max 15% for established companies
  // (30% was causing wildly inflated valuations for mature companies like Swiss Life)
  revenueGrowth = Math.max(Math.min(revenueGrowth, 0.15), -0.05);

  // FCF plausibility check: if FCF yield > 8% of market cap, it's likely inflated
  // (insurance/financial companies often report investment gains as operating cash flow)
  const marketCap = currentPrice * shares;
  let fcf = rawFcf;
  const fcfYield = rawFcf / marketCap;
  if (fcfYield > 0.08) {
    // Cap FCF at 5% of market cap (sustainable level for most companies)
    fcf = marketCap * 0.05;
    console.warn(`[DCF] FCF yield ${(fcfYield*100).toFixed(1)}% too high for ${ticker}, capping at 5% of market cap`);
  }

  // WACC estimate
  const costOfEquity = riskFreeRate + betaVal * marketRiskPremium;
  const debtRatio = 0.3;
  const costOfDebt = 0.04;
  const taxRate = 0.21;
  const wacc = costOfEquity * (1 - debtRatio) + costOfDebt * (1 - taxRate) * debtRatio;

  // Ensure WACC is at least 8% to prevent terminal value explosion
  // (standard DCF practice: even low-beta companies should use 8%+ discount rate
  //  to account for model uncertainty and illiquidity premium)
  const effectiveWacc = Math.max(wacc, 0.08);

  // Project FCF for N years with declining growth (mean-reversion to terminal growth)
  const projectedFCF: number[] = [];
  let cumulativeGrowth = 1;
  for (let year = 1; year <= projectionYears; year++) {
    // Growth decays linearly from revenueGrowth toward terminalGrowthRate
    const decayFactor = (projectionYears - year) / projectionYears;
    const yearGrowth = terminalGrowthRate + (revenueGrowth - terminalGrowthRate) * decayFactor;
    cumulativeGrowth *= (1 + yearGrowth);
    projectedFCF.push(fcf * cumulativeGrowth);
  }

  // Terminal value — use effectiveWacc to prevent division by near-zero
  const terminalFCF = projectedFCF[projectedFCF.length - 1] * (1 + terminalGrowthRate);
  const spreadWaccTerminal = effectiveWacc - terminalGrowthRate;
  // Minimum spread of 3.5% to prevent terminal value explosion
  // (academic standard: WACC-g spread should be at least 3-4% for mature companies)
  const effectiveSpread = Math.max(spreadWaccTerminal, 0.035);
  const terminalValue = terminalFCF / effectiveSpread;

  // Discount to present value using effectiveWacc (floor of 6%)
  const pvFCF = projectedFCF.reduce(
    (sum, cf, i) => sum + cf / (1 + effectiveWacc) ** (i + 1),
    0
  );
  const pvTerminal = terminalValue / (1 + effectiveWacc) ** projectionYears;

  const intrinsicValueTotal = pvFCF + pvTerminal;
  let intrinsicValuePerShare = intrinsicValueTotal / shares;

  // Sanity check: cap intrinsic value at 2x current price to prevent absurd results
  // (DCF models are inherently uncertain; >100% upside signals model error, not opportunity)
  const maxReasonableValue = currentPrice * 2;
  if (intrinsicValuePerShare > maxReasonableValue) {
    console.warn(`[DCF] Sanity check: Intrinsic value ${intrinsicValuePerShare.toFixed(2)} capped at 2x price (${maxReasonableValue.toFixed(2)}) for ${ticker}`);
    intrinsicValuePerShare = maxReasonableValue;
  }
  // Floor at 0 (negative intrinsic value doesn't make sense for equity)
  if (intrinsicValuePerShare < 0) {
    intrinsicValuePerShare = 0;
  }

  const upsidePct = ((intrinsicValuePerShare - currentPrice) / currentPrice) * 100;

  return {
    ticker,
    currentPrice: Math.round(currentPrice * 100) / 100,
    intrinsicValue: Math.round(intrinsicValuePerShare * 100) / 100,
    upsideDownside: Math.round(upsidePct * 10) / 10,
    wacc: Math.round(effectiveWacc * 10000) / 100,
    terminalGrowthRate: Math.round(terminalGrowthRate * 10000) / 100,
    projectionYears,
    freeCashFlow: Math.round(fcf),
    sharesOutstanding: shares,
    beta: Math.round(betaVal * 100) / 100,
    revenueGrowthEstimate: Math.round(revenueGrowth * 1000) / 10,
    projectedFCF: projectedFCF.map((v) => Math.round(v)),
    pvFCF: Math.round(pvFCF),
    pvTerminalValue: Math.round(pvTerminal),
    currency,
    companyName,
    dataSource,
  };
}

// ─────────────────────────────────────────────
// Public API: Portfolio Optimization
// ─────────────────────────────────────────────
export async function optimizePortfolio(input: OptimizeInput) {
  const {
    tickers,
    lookbackDays = 252,
    riskFreeRate = DEFAULT_RISK_FREE_RATE,
    method = "max_sharpe",
  } = input;

  if (tickers.length < 2) {
    throw new Error("At least 2 tickers required for optimization.");
  }

  const returnsMap = await fetchReturns(tickers, lookbackDays);
  const available = tickers.filter((t) => returnsMap[t]);

  if (available.length < 2) {
    throw new Error("Insufficient data for optimization (need at least 2 tickers with data).");
  }

  // Annualized expected returns and covariance matrix
  const mu = available.map((t) => mean(returnsMap[t]) * TRADING_DAYS_YEAR);
  const cov = covarianceMatrix(returnsMap, available);
  const n = available.length;

  // Fetch dividend yields for max_dividend method
  let dividendYields: number[] | undefined;
  if (method === "max_dividend") {
    dividendYields = await Promise.all(
      available.map(async (ticker) => {
        try {
          const norm = normalizeTicker(ticker);
          const summary = await yahooFinance.quoteSummary(norm, { modules: ["summaryDetail"] }) as any;
          return summary?.summaryDetail?.dividendYield ?? 0;
        } catch {
          return 0;
        }
      })
    );
  }

  // Optimal weights
  const optimalWeights = optimizeWeights(mu, cov, method, riskFreeRate, dividendYields);
  const { ret: optRet, vol: optVol, sharpe: optSharpe } = portfolioStats(optimalWeights, mu, cov);

  // Current portfolio (equal weight)
  const equalWeights = new Array(n).fill(1 / n);
  const { ret: currRet, vol: currVol, sharpe: currSharpe } = portfolioStats(equalWeights, mu, cov);

  // Efficient frontier
  const efficientFrontier = buildEfficientFrontier(mu, cov, riskFreeRate, 30);

  // Per-asset stats
  const assetStats = available.map((ticker, i) => {
    const ar = returnsMap[ticker];
    return {
      ticker,
      currentWeight: Math.round((1 / n) * 1000) / 10,
      optimalWeight: Math.round(optimalWeights[i] * 1000) / 10,
      annualReturn: Math.round(mu[i] * 10000) / 100,
      volatility: Math.round(Math.sqrt(cov[i][i]) * 10000) / 100,
      sharpe: Math.round(calcSharpe(ar, riskFreeRate) * 1000) / 1000,
    };
  });

  const weightsMap: { [ticker: string]: number } = {};
  for (let i = 0; i < available.length; i++) {
    weightsMap[available[i]] = Math.round(optimalWeights[i] * 10000) / 10000;
  }

  return {
    method,
    optimalPortfolio: {
      expectedReturn: Math.round(optRet * 10000) / 10000,
      volatility: Math.round(optVol * 10000) / 10000,
      sharpe: Math.round(optSharpe * 1000) / 1000,
      annualReturn: Math.round(optRet * 10000) / 100,
      sharpeRatio: Math.round(optSharpe * 1000) / 1000,
    },
    currentPortfolio: {
      expectedReturn: Math.round(currRet * 10000) / 10000,
      volatility: Math.round(currVol * 10000) / 10000,
      sharpe: Math.round(currSharpe * 1000) / 1000,
    },
    weights: weightsMap,
    assets: assetStats,
    efficientFrontier,
    tickers: available,
  };
}

// ─────────────────────────────────────────────
// Public API: Technical Analysis
// ─────────────────────────────────────────────

/**
 * Calculate RSI (Relative Strength Index)
 */
function calcRSI(prices: number[], period: number = 14): number[] {
  const rsiValues: number[] = [];
  if (prices.length < period + 1) return rsiValues;

  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  // Initial average gain/loss
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  // First RSI value
  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsiValues.push(100 - 100 / (1 + firstRS));

  // Smoothed RSI using Wilder's method
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues.push(100 - 100 / (1 + rs));
  }

  return rsiValues;
}

/**
 * Calculate EMA (Exponential Moving Average)
 * Standard implementation: seed with SMA of first 'period' values,
 * then apply exponential smoothing from index 'period' onwards.
 * Returns array of same length as input (first period-1 values are SMA approximations).
 */
function calcEMA(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  if (data.length < period) {
    // Not enough data for proper EMA, return SMA approximation
    const ema: number[] = [];
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
      ema.push(sum / (i + 1));
    }
    return ema;
  }

  const multiplier = 2 / (period + 1);
  const ema: number[] = new Array(data.length);

  // Seed: SMA of first 'period' values
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
    // Fill early values with running SMA (for alignment)
    ema[i] = sum / (i + 1);
  }
  // Overwrite the seed point with proper SMA
  ema[period - 1] = sum / period;

  // Apply EMA formula from period onwards
  for (let i = period; i < data.length; i++) {
    ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }

  return ema;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
function calcMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
  const emaFast = calcEMA(prices, fastPeriod);
  const emaSlow = calcEMA(prices, slowPeriod);

  // MACD line = EMA(fast) - EMA(slow)
  const macdLine: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    macdLine.push(emaFast[i] - emaSlow[i]);
  }

  // Signal line = EMA of MACD line
  const signalLine = calcEMA(macdLine, signalPeriod);

  // Histogram = MACD - Signal
  const histogram: number[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    histogram.push(macdLine[i] - signalLine[i]);
  }

  return { macdLine, signalLine, histogram };
}

/**
 * Calculate Bollinger Bands
 */
function calcBollingerBands(
  prices: number[],
  period: number = 20,
  stdMultiplier: number = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const upper: number[] = [];
  const middle: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      // Not enough data yet
      upper.push(prices[i]);
      middle.push(prices[i]);
      lower.push(prices[i]);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      const sma = slice.reduce((s, v) => s + v, 0) / period;
      const stdDev = Math.sqrt(
        slice.reduce((s, v) => s + (v - sma) ** 2, 0) / period
      );
      middle.push(sma);
      upper.push(sma + stdMultiplier * stdDev);
      lower.push(sma - stdMultiplier * stdDev);
    }
  }

  return { upper, middle, lower };
}

/**
 * Full Technical Analysis for a single ticker
 */
export async function calcTechnicalAnalysis(input: TechnicalAnalysisInput): Promise<TechnicalIndicators> {
  const { ticker, lookbackDays = 180 } = input;
  const normalizedTicker = normalizeTicker(ticker);

  const end = new Date();
  // Use 2x lookback to ensure enough data for RSI(14) warm-up period
  // RSI needs at least 14+1 periods to start, plus ~100 periods for Wilder's smoothing to stabilize
  const start = new Date(end.getTime() - Math.max(lookbackDays, 250) * 1.8 * 24 * 60 * 60 * 1000);

  // Fetch price data with adjusted close for split-adjusted calculations
  const chartResult = await yahooFinance.chart(normalizedTicker, {
    period1: start.toISOString().split("T")[0],
    period2: end.toISOString().split("T")[0],
    interval: "1d",
  }) as any;

  const quotes = (chartResult.quotes ?? []) as any[];
  if (quotes.length < 30) {
    throw new Error(`Insufficient price data for ${ticker} (need at least 30 days, got ${quotes.length})`);
  }

  // Use adjclose (split-adjusted) if available, otherwise fall back to close
  // This ensures RSI/MACD are calculated on split-adjusted prices matching external sources
  const prices = quotes
    .filter((q: any) => (q.adjclose ?? q.close) != null)
    .map((q: any) => (q.adjclose ?? q.close) as number);
  const dates = quotes
    .filter((q: any) => (q.adjclose ?? q.close) != null)
    .map((q: any) => {
      const d = new Date(q.date);
      return d.toISOString().split("T")[0];
    });

  const currentPrice = prices[prices.length - 1];

  // Get company name
  let companyName = ticker;
  try {
    const summary = await yahooFinance.quoteSummary(normalizedTicker, {
      modules: ["price"],
    }) as any;
    companyName = summary.price?.longName ?? summary.price?.shortName ?? ticker;
  } catch {
    // Use ticker as fallback
  }

  // ── RSI ──
  const rsiValues = calcRSI(prices, 14);
  const currentRSI = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : 50;
  let rsiSignal: "oversold" | "neutral" | "overbought" = "neutral";
  let rsiDescription = "";
  if (currentRSI < 30) {
    rsiSignal = "oversold";
    rsiDescription = `RSI bei ${currentRSI.toFixed(1)} – stark überverkauft. Mögliche Kaufgelegenheit.`;
  } else if (currentRSI < 40) {
    rsiSignal = "oversold";
    rsiDescription = `RSI bei ${currentRSI.toFixed(1)} – leicht überverkauft. Beobachten für Einstieg.`;
  } else if (currentRSI > 70) {
    rsiSignal = "overbought";
    rsiDescription = `RSI bei ${currentRSI.toFixed(1)} – stark überkauft. Vorsicht vor Korrektur.`;
  } else if (currentRSI > 60) {
    rsiSignal = "overbought";
    rsiDescription = `RSI bei ${currentRSI.toFixed(1)} – leicht überkauft. Aufwärtstrend intakt.`;
  } else {
    rsiDescription = `RSI bei ${currentRSI.toFixed(1)} – neutraler Bereich.`;
  }

  // RSI history (last 60 data points)
  const rsiStartIdx = prices.length - rsiValues.length;
  const rsiHistory = rsiValues.slice(-60).map((v, i) => ({
    date: dates[rsiStartIdx + rsiValues.length - 60 + i] || "",
    value: Math.round(v * 100) / 100,
  }));

  // ── MACD ──
  const { macdLine, signalLine, histogram } = calcMACD(prices, 12, 26, 9);
  const currentMACD = macdLine[macdLine.length - 1];
  const currentSignalLine = signalLine[signalLine.length - 1];
  const currentHistogram = histogram[histogram.length - 1];
  const prevHistogram = histogram.length > 1 ? histogram[histogram.length - 2] : 0;

  let macdSignal: "bullish" | "neutral" | "bearish" = "neutral";
  let macdDescription = "";
  if (currentMACD > currentSignalLine && currentHistogram > 0) {
    if (prevHistogram <= 0) {
      macdSignal = "bullish";
      macdDescription = "MACD-Crossover nach oben – bullisches Signal. Aufwärtstrend beginnt.";
    } else {
      macdSignal = "bullish";
      macdDescription = "MACD über Signallinie – Aufwärtstrend bestätigt.";
    }
  } else if (currentMACD < currentSignalLine && currentHistogram < 0) {
    if (prevHistogram >= 0) {
      macdSignal = "bearish";
      macdDescription = "MACD-Crossover nach unten – bärisches Signal. Abwärtstrend beginnt.";
    } else {
      macdSignal = "bearish";
      macdDescription = "MACD unter Signallinie – Abwärtstrend bestätigt.";
    }
  } else {
    macdDescription = "MACD neutral – kein klares Trendsignal.";
  }

  // MACD history (last 60 data points)
  const macdHistory = macdLine.slice(-60).map((m, i) => ({
    date: dates[dates.length - 60 + i] || "",
    macd: Math.round(m * 1000) / 1000,
    signal: Math.round(signalLine[signalLine.length - 60 + i] * 1000) / 1000,
    histogram: Math.round(histogram[histogram.length - 60 + i] * 1000) / 1000,
  }));

  // ── Bollinger Bands ──
  const { upper, middle, lower } = calcBollingerBands(prices, 20, 2);
  const currentUpper = upper[upper.length - 1];
  const currentMiddle = middle[middle.length - 1];
  const currentLower = lower[lower.length - 1];
  const bandwidth = currentMiddle > 0 ? (currentUpper - currentLower) / currentMiddle : 0;
  const percentB = (currentUpper - currentLower) > 0
    ? (currentPrice - currentLower) / (currentUpper - currentLower)
    : 0.5;

  let bbSignal: "oversold" | "neutral" | "overbought" = "neutral";
  let bbDescription = "";
  if (currentPrice <= currentLower) {
    bbSignal = "oversold";
    bbDescription = `Kurs am unteren Bollinger Band – überverkauft. Mögliche Umkehr nach oben.`;
  } else if (currentPrice >= currentUpper) {
    bbSignal = "overbought";
    bbDescription = `Kurs am oberen Bollinger Band – überkauft. Mögliche Korrektur.`;
  } else if (percentB < 0.2) {
    bbSignal = "oversold";
    bbDescription = `Kurs nahe unterem Band (%B: ${(percentB * 100).toFixed(0)}%) – leicht überverkauft.`;
  } else if (percentB > 0.8) {
    bbSignal = "overbought";
    bbDescription = `Kurs nahe oberem Band (%B: ${(percentB * 100).toFixed(0)}%) – leicht überkauft.`;
  } else {
    bbDescription = `Kurs im mittleren Bereich (%B: ${(percentB * 100).toFixed(0)}%) – neutral.`;
  }

  // Bollinger history (last 60 data points)
  const bbHistory = upper.slice(-60).map((u, i) => ({
    date: dates[dates.length - 60 + i] || "",
    upper: Math.round(u * 100) / 100,
    middle: Math.round(middle[middle.length - 60 + i] * 100) / 100,
    lower: Math.round(lower[lower.length - 60 + i] * 100) / 100,
    close: Math.round(prices[prices.length - 60 + i] * 100) / 100,
  }));

  // Price history (last 60 data points)
  const priceHistory = prices.slice(-60).map((p, i) => ({
    date: dates[dates.length - 60 + i] || "",
    close: Math.round(p * 100) / 100,
  }));

  // ── Overall Signal ──
  let buySignals = 0;
  let sellSignals = 0;
  if (rsiSignal === "oversold") buySignals++;
  if (rsiSignal === "overbought") sellSignals++;
  if (macdSignal === "bullish") buySignals++;
  if (macdSignal === "bearish") sellSignals++;
  if (bbSignal === "oversold") buySignals++;
  if (bbSignal === "overbought") sellSignals++;

  let overallSignal: "buy" | "hold" | "sell" = "hold";
  let overallDescription = "";
  if (buySignals >= 2) {
    overallSignal = "buy";
    overallDescription = `${buySignals} von 3 Indikatoren zeigen Kaufsignale. Technisch attraktiver Einstiegspunkt.`;
  } else if (sellSignals >= 2) {
    overallSignal = "sell";
    overallDescription = `${sellSignals} von 3 Indikatoren zeigen Verkaufssignale. Vorsicht geboten.`;
  } else {
    overallDescription = "Gemischte technische Signale. Abwarten empfohlen.";
  }

  return {
    ticker,
    companyName,
    currentPrice: Math.round(currentPrice * 100) / 100,
    rsi: {
      value: Math.round(currentRSI * 100) / 100,
      signal: rsiSignal,
      description: rsiDescription,
    },
    macd: {
      macdLine: Math.round(currentMACD * 1000) / 1000,
      signalLine: Math.round(currentSignalLine * 1000) / 1000,
      histogram: Math.round(currentHistogram * 1000) / 1000,
      signal: macdSignal,
      description: macdDescription,
      history: macdHistory,
    },
    bollingerBands: {
      upper: Math.round(currentUpper * 100) / 100,
      middle: Math.round(currentMiddle * 100) / 100,
      lower: Math.round(currentLower * 100) / 100,
      bandwidth: Math.round(bandwidth * 10000) / 100,
      percentB: Math.round(percentB * 10000) / 100,
      signal: bbSignal,
      description: bbDescription,
      history: bbHistory,
    },
    priceHistory,
    rsiHistory,
    overallSignal,
    overallDescription,
  };
}


// ─────────────────────────────────────────────
// Public API: Historical Risk Score Timeline
// ─────────────────────────────────────────────

export interface RiskScoreHistoryInput {
  holdings: HoldingInput[];
  benchmark?: string;
  riskFreeRate?: number;
  confidenceLevel?: number;
  /** Number of weekly data points to generate (default: 52 = 1 year) */
  weeks?: number;
  /** Rolling window size in trading days for each score calculation (default: 63 = ~3 months) */
  windowDays?: number;
}

export interface RiskScoreDataPoint {
  date: string; // ISO date string
  score: number; // 0-100
  volatility: number; // annualized %
  sharpe: number;
  maxDrawdown: number; // %
}

/**
 * Calculate historical risk score timeline using rolling windows.
 * Fetches enough historical data to compute weekly risk scores over the requested period.
 * Each data point represents the risk score calculated from a rolling window ending on that date.
 */
export async function calcRiskScoreHistory(input: RiskScoreHistoryInput): Promise<RiskScoreDataPoint[]> {
  const {
    holdings,
    benchmark = "SPY",
    riskFreeRate = DEFAULT_RISK_FREE_RATE,
    confidenceLevel = 0.95,
    weeks = 52,
    windowDays = 63, // ~3 months rolling window
  } = input;

  const tickers = holdings.map((h) => h.ticker);
  const rawWeights = holdings.map((h) => h.weight);
  const totalW = rawWeights.reduce((s, v) => s + v, 0);
  const weights = totalW > 0 ? rawWeights.map((w) => w / totalW) : rawWeights;

  // We need enough data: windowDays + (weeks * 5 trading days per week) + buffer
  const totalDaysNeeded = windowDays + weeks * 5 + 30;

  // Fetch all prices with dates
  const allTickers = Array.from(new Set([...tickers, benchmark]));
  const pricesWithDates = await fetchPricesWithDates(allTickers, totalDaysNeeded);

  // Find available tickers
  const available = tickers.filter((t) => pricesWithDates[t] && pricesWithDates[t].length > windowDays + 5);
  if (available.length === 0) {
    return [];
  }

  // Recompute weights for available tickers
  const availIdx = available.map((t) => tickers.indexOf(t));
  let weightsAvail = availIdx.map((i) => weights[i]);
  const wSum = weightsAvail.reduce((s, v) => s + v, 0);
  if (wSum > 0) weightsAvail = weightsAvail.map((w) => w / wSum);

  // Find the minimum common length across all available tickers
  const minLen = Math.min(...available.map((t) => pricesWithDates[t].length));
  
  // Compute daily returns for each ticker (aligned to same length)
  const returnsWithDates: { dates: string[]; returns: { [ticker: string]: number[] } } = {
    dates: [],
    returns: {},
  };

  // Use the ticker with the shortest data as the date reference
  const refTicker = available.reduce((a, b) => 
    pricesWithDates[a].length <= pricesWithDates[b].length ? a : b
  );
  
  for (let i = 1; i < Math.min(minLen, pricesWithDates[refTicker].length); i++) {
    returnsWithDates.dates.push(pricesWithDates[refTicker][i].date);
  }

  for (const ticker of available) {
    const prices = pricesWithDates[ticker];
    const returns: number[] = [];
    for (let i = 1; i < Math.min(minLen, prices.length); i++) {
      returns.push((prices[i].price - prices[i - 1].price) / prices[i - 1].price);
    }
    returnsWithDates.returns[ticker] = returns;
  }

  // Also compute benchmark returns
  const benchmarkPrices = pricesWithDates[benchmark];
  let benchmarkReturns: number[] | null = null;
  if (benchmarkPrices && benchmarkPrices.length > windowDays) {
    benchmarkReturns = [];
    for (let i = 1; i < Math.min(minLen, benchmarkPrices.length); i++) {
      benchmarkReturns.push((benchmarkPrices[i].price - benchmarkPrices[i - 1].price) / benchmarkPrices[i - 1].price);
    }
  }

  const totalReturns = returnsWithDates.dates.length;
  if (totalReturns < windowDays + 5) {
    return [];
  }

  // Generate weekly data points by stepping back from the most recent date
  const dataPoints: RiskScoreDataPoint[] = [];
  const stepSize = 5; // ~1 week (5 trading days)

  for (let w = 0; w < weeks; w++) {
    const endIdx = totalReturns - 1 - w * stepSize;
    const startIdx = endIdx - windowDays + 1;
    
    if (startIdx < 0) break;

    // Extract window returns for portfolio
    const windowPortfolioRets: number[] = new Array(windowDays).fill(0);
    for (let t = 0; t < available.length; t++) {
      const tickerReturns = returnsWithDates.returns[available[t]];
      for (let d = startIdx; d <= endIdx; d++) {
        windowPortfolioRets[d - startIdx] += (tickerReturns[d] ?? 0) * weightsAvail[t];
      }
    }

    // Calculate metrics for this window
    const volatility = calcVolatility(windowPortfolioRets);
    const sharpe = calcSharpe(windowPortfolioRets, riskFreeRate);
    const sortino = calcSortino(windowPortfolioRets, riskFreeRate);
    const varHist = calcVarHistorical(windowPortfolioRets, confidenceLevel);
    const maxDD = calcMaxDrawdown(windowPortfolioRets);

    let beta: number | null = null;
    if (benchmarkReturns) {
      const windowBenchRets = benchmarkReturns.slice(startIdx, endIdx + 1);
      if (windowBenchRets.length === windowPortfolioRets.length) {
        beta = calcBeta(windowPortfolioRets, windowBenchRets);
      }
    }

    // Calculate risk score (same formula as main calcRiskMetrics)
    function normalizeMetric(value: number, min: number, max: number, invert: boolean): number {
      const clamped = Math.max(min, Math.min(max, value));
      const normalized = (clamped - min) / (max - min);
      const score = invert ? (1 - normalized) * 100 : normalized * 100;
      return Math.round(score);
    }

    const volScore = normalizeMetric(volatility * 100, 0, 40, true);
    const maxDDScore = normalizeMetric(Math.abs(maxDD) * 100, 0, 50, true);
    const varScore = normalizeMetric(Math.abs(varHist) * 100, 0, 10, true);
    const sharpeScore = normalizeMetric(sharpe, -1, 3, false);
    const sortinoScore = normalizeMetric(sortino, -1, 4, false);
    const betaScore = beta !== null ? normalizeMetric(Math.abs(beta - 1), 0, 1.5, true) : 50;

    const riskScore = Math.round(
      volScore * 0.2 + maxDDScore * 0.2 + varScore * 0.15 +
      sharpeScore * 0.2 + sortinoScore * 0.15 + betaScore * 0.1
    );

    dataPoints.push({
      date: returnsWithDates.dates[endIdx],
      score: riskScore,
      volatility: Math.round(volatility * 10000) / 100,
      sharpe: Math.round(sharpe * 100) / 100,
      maxDrawdown: Math.round(maxDD * 10000) / 100,
    });
  }

  // Reverse so oldest is first
  dataPoints.reverse();
  return dataPoints;
}

/**
 * Fetch daily prices with dates for multiple tickers.
 * Returns an object mapping ticker -> array of {date, price} sorted chronologically.
 */
async function fetchPricesWithDates(
  tickers: string[],
  lookbackDays: number
): Promise<{ [ticker: string]: Array<{ date: string; price: number }> }> {
  const normalizedMap: { [orig: string]: string } = {};
  for (const t of tickers) {
    normalizedMap[t] = normalizeTicker(t);
  }
  const uniqueNormalized = Array.from(new Set(Object.values(normalizedMap)));

  const end = new Date();
  const start = new Date(end.getTime() - lookbackDays * 1.5 * 24 * 60 * 60 * 1000);

  const pricesByNorm: { [norm: string]: Array<{ date: string; price: number }> } = {};

  await Promise.allSettled(
    uniqueNormalized.map(async (norm) => {
      try {
        const result = await yahooFinance.chart(norm, {
          period1: start.toISOString().split("T")[0],
          period2: end.toISOString().split("T")[0],
          interval: "1d",
        }) as any;
        const quotes = (result.quotes ?? result.indicators?.quote?.[0] ?? []) as any[];
        const prices: Array<{ date: string; price: number }> = [];
        for (const q of quotes) {
          const adjClose = q.adjclose ?? q.close;
          if (adjClose != null && q.date) {
            prices.push({
              date: new Date(q.date).toISOString().split("T")[0],
              price: adjClose,
            });
          }
        }
        if (prices.length > 5) {
          pricesByNorm[norm] = prices;
        }
      } catch {
        // Skip tickers with no data
      }
    })
  );

  // Map back to original tickers
  const result: { [ticker: string]: Array<{ date: string; price: number }> } = {};
  for (const orig of tickers) {
    const norm = normalizedMap[orig];
    if (pricesByNorm[norm]) {
      result[orig] = pricesByNorm[norm];
    }
  }

  return result;
}
