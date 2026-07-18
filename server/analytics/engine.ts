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

// Yahoo Finance removed — all price data fetched from historicalPrices DB (EODHD-sourced)
import { ledoitWolfConstantCorr } from "../lib/ledoitWolf";
import { runHRP } from "./hrpOptimizer";
import { blPosteriorFromHistoricalMeans } from "../lib/blackLitterman";
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
  effectiveBounds,
  normalizeWithBounds,
  type DatedReturns,
} from "./riskStats";
import { getFxRate, getStockCurrency } from "../fxHelper";
import { ENV } from "../_core/env";
import { toEodhdSymbol } from "../lib/eodhdSymbol";
// ─────────────────────────────────────────────
// DB-based price fetcher (replaces Yahoo Finance)
// Uses historicalPrices table populated by EODHD daily cron
// ─────────────────────────────────────────────
async function fetchPricesFromDB(
  tickers: string[],
  lookbackDays: number
): Promise<{ [ticker: string]: Array<{ date: string; price: number }> }> {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return {};
  const { historicalPrices: hpTable } = await import("../../drizzle/schema");
  const { inArray, gte, asc } = await import("drizzle-orm");
  const startDate = new Date(Date.now() - lookbackDays * 1.5 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  // Normalize tickers for DB lookup
  const normalizedMap: Record<string, string> = {};
  for (const t of tickers) normalizedMap[t] = normalizeTicker(t);
  const uniqueNorm = Array.from(new Set(Object.values(normalizedMap)));
  const rows = await db
    .select({ ticker: hpTable.ticker, date: hpTable.date, close: hpTable.close, adj: hpTable.adjustedClose })
    .from(hpTable)
    .where((inArray(hpTable.ticker, uniqueNorm) as any))
    .orderBy(asc(hpTable.date));
  // Filter by date (date column is a string 'YYYY-MM-DD')
  const filtered = rows.filter((r: any) => String(r.date).slice(0, 10) >= startDate);
  const byNorm: Record<string, Array<{ date: string; price: number }>> = {};
  for (const r of filtered) {
    const v = parseFloat((r.adj ?? r.close) as any);
    if (!Number.isFinite(v) || v <= 0) continue;
    if (!byNorm[r.ticker]) byNorm[r.ticker] = [];
    byNorm[r.ticker].push({ date: String(r.date).slice(0, 10), price: v });
  }
  const result: Record<string, Array<{ date: string; price: number }>> = {};
  for (const orig of tickers) {
    const norm = normalizedMap[orig];
    if (byNorm[norm] && byNorm[norm].length > 5) result[orig] = byNorm[norm];
  }
  return result;
}

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
  method?: "max_sharpe" | "min_variance" | "equal_weight" | "max_dividend" | "hrp" | "min_cvar";
  /**
   * R-34c: aktueller Portfoliowert in CHF. Wenn gesetzt, werden Zielpositionen
   * unter der Mindest-Positionsgrösse auf 0 gesetzt und umverteilt.
   */
  portfolioValue?: number;
  /**
   * F2: Diversifikationsregeln (Admin-konfigurierbar). Alle optional — fehlen
   * sie, greifen die bisherigen Defaults (Standardverhalten unverändert).
   */
  minPositionChf?: number; // Mindest-Positionsgrösse CHF (Default 3'000)
  minPositionWeight?: number; // Einzelposition-Untergrenze als Anteil 0..1 (Default 0.01)
  maxPositionWeight?: number; // Einzelposition-Obergrenze als Anteil 0..1 (Default 0.10)
  /** Current portfolio weights as {ticker: weight 0..1}. Used to plot the actual portfolio on the frontier. */
  currentWeights?: Record<string, number>;
  /**
   * Manuelle Optimierungsziele (Nebenbedingungen). Werden als Penalty-Term in die
   * Zielfunktion eingebaut, sodass der Optimizer diese Ziele anstrebt ohne sie
   * als harte Constraints zu erzwingen (Soft-Constraints).
   */
  userConstraints?: {
    /** Mindest-Dividendenrendite als Anteil 0..1 (z.B. 0.03 = 3%) */
    minDividendYield?: number;
    /** Maximale Portfolio-Volatilität p.a. als Anteil 0..1 (z.B. 0.12 = 12%) */
    maxVolatility?: number;
    /** Mindest-Sharpe-Ratio (z.B. 1.0) */
    minSharpe?: number;
  };
  /**
   * Sektor je Ticker — nur vom exakten Optimierer (PyPortfolioOpt) als harter
   * Sektor-Cap erzwungen; der Zufallssuche-Fallback ignoriert beides.
   */
  sectorByTicker?: Record<string, string>;
  /** Max. Sektorgewicht in Prozent (z. B. 30). */
  maxSectorWeightPct?: number;
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
/**
 * Like fetchReturns, but keeps the trading date for each return so series from
 * different exchanges can be aligned by date (see alignReturnsByDate). Each
 * return at index i is the move from day i to day i+1 and is dated with day i+1.
 */
async function fetchReturnsWithDates(
  tickers: string[],
  lookbackDays: number,
  currencyByTicker: { [ticker: string]: string } = {},
): Promise<{ [ticker: string]: DatedReturns }> {
  const pricesMap = await fetchPricesFromDB(tickers, lookbackDays);
  const out: { [ticker: string]: DatedReturns } = {};
  for (const [orig, series] of Object.entries(pricesMap)) {
    if (series.length < 2) continue;
    // Convert prices to CHF (reporting currency) before computing returns
    let prices = series.map((s) => s.price);
    const dates = series.map((s) => s.date);
    const currency = currencyByTicker[orig];
    if (currency && currency !== "CHF") {
      const pair = `${currency}CHF`;
      prices = await Promise.all(
        prices.map(async (p, i) => p * (await getFxRate(dates[i], pair))),
      );
    }
    const retDates: string[] = [];
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      retDates.push(dates[i]);
    }
    out[orig] = { dates: retDates, returns };
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

/**
 * Ledoit-Wolf-geschrumpfte, annualisierte Kovarianz für die Optimierung — robuster gegen
 * Schätzrauschen als die naive Stichproben-Kovarianz (vermeidet Extremgewichte auf
 * Schätzfehler). Fällt bei zu kurzer/leerer Historie auf die Stichproben-Kovarianz zurück.
 */
function shrunkCovarianceMatrix(returnsMap: { [ticker: string]: number[] }, tickers: string[]): number[][] {
  const minLen = Math.min(...tickers.map((t) => returnsMap[t]?.length ?? 0));
  if (tickers.length === 0 || !Number.isFinite(minLen) || minLen < 2) {
    return covarianceMatrix(returnsMap, tickers);
  }
  const matrix = tickers.map((t) => returnsMap[t].slice(0, minLen));
  const { cov } = ledoitWolfConstantCorr(matrix);
  return cov.map((row) => row.map((v) => v * TRADING_DAYS_YEAR));
}

// ─────────────────────────────────────────────
// Portfolio Optimization (Sequential Least Squares)
// ─────────────────────────────────────────────
function portfolioStats(
  weights: number[],
  mu: number[],
  cov: number[][],
  riskFreeRate: number = DEFAULT_RISK_FREE_RATE
): { ret: number; vol: number; sharpe: number } {
  const ret = dotProduct(weights, mu);
  const covW = matVecMul(cov, weights);
  const vol = Math.sqrt(dotProduct(weights, covW));
  // OPT-3: rf parametrisiert — der ausgewiesene Sharpe muss zum selben Zins
  // gerechnet sein wie Zielfunktion und Frontier (vorher fix 0.02).
  const sharpe = vol > 0 ? (ret - riskFreeRate) / vol : 0;
  return { ret, vol, sharpe };
}

/**
 * OPT-5 (Audit 2026-07): geseedeter mulberry32-PRNG statt Math.random für die
 * Zufallssuche — zweimal «Optimieren» mit identischen Inputs liefert jetzt
 * identische Gewichte (vorher jedes Mal ein anderes Portfolio). Optimizer und
 * Frontier seeden sich beim Einstieg jeweils neu, damit jede Funktion für sich
 * deterministisch ist, unabhängig davon, wer vorher wie viele Zahlen gezogen hat.
 */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const OPTIMIZER_SEED = 0x51ab1e;
let rng: () => number = mulberry32(OPTIMIZER_SEED);

/** Random weight vector within [minW, maxW] summing to 1 (used by optimizer and frontier, R-34b). */
function randomBoundedWeights(n: number, minW: number, maxW: number): number[] {
  const raw = Array.from({ length: n }, () => minW + rng() * (maxW - minW));
  return normalizeWithBounds(raw, minW, maxW);
}

interface UserConstraints {
  minDividendYield?: number;
  maxVolatility?: number;
  minSharpe?: number;
}

// Tägliche Portfolio-Renditereihe aus Gewichten und den (datums-alignierten)
// Asset-Renditereihen. `assetReturns[i]` = Tagesrenditen von Titel i.
function weightedDailySeries(weights: number[], assetReturns: number[][]): number[] {
  if (assetReturns.length === 0) return [];
  const T = Math.min(...assetReturns.map((a) => a.length));
  const out = new Array<number>(T);
  for (let t = 0; t < T; t++) {
    let r = 0;
    for (let i = 0; i < assetReturns.length; i++) r += weights[i] * assetReturns[i][t];
    out[t] = r;
  }
  return out;
}

// Historischer CVaR (Expected Shortfall) einer Tagesrenditereihe zum Niveau
// `alpha` (Default 5 %). Rückgabe = POSITIVE Zahl = mittlerer Verlust im
// schlechtesten alpha-Tail (Tageswert). Höher = mehr Tail-Risiko.
function historicalCVaR(dailyReturns: number[], alpha = 0.05): number {
  if (dailyReturns.length === 0) return 0;
  const sorted = [...dailyReturns].sort((a, b) => a - b); // aufsteigend: schlechteste zuerst
  const k = Math.max(1, Math.floor(sorted.length * alpha));
  let s = 0;
  for (let i = 0; i < k; i++) s += sorted[i];
  return -(s / k);
}

function optimizeWeights(
  mu: number[],
  cov: number[][],
  method: string,
  riskFreeRate: number,
  dividendYields?: number[],
  constraints?: { minWeight: number; maxWeight: number },
  userConstraints?: UserConstraints,
  cvarReturns?: number[][]
): number[] {
  const n = mu.length;
  const x0 = new Array(n).fill(1 / n);

  if (method === "equal_weight") return x0;

  rng = mulberry32(OPTIMIZER_SEED); // OPT-5: deterministische Zufallssuche

  // Apply diversification constraints (default: min 1%, max 10%),
  // widened to a feasible range for small n (R-34a).
  const { minW, maxW } = effectiveBounds(
    n,
    constraints?.minWeight ?? 0.01,
    constraints?.maxWeight ?? 0.10
  );

  // For max_dividend: maximize weighted dividend yield with volatility penalty
  // This produces different results from max_sharpe because it uses dividend yield
  // instead of total return as the objective
  const isDividend = method === "max_dividend";
  const isMinVar = method === "min_variance";
  const isMaxSharpe = method === "max_sharpe";
  const isMinCvar = method === "min_cvar" && !!cvarReturns;

  function score(w: number[]): number {
    const { ret, vol } = portfolioStats(w, mu, cov);
    let base: number;
    if (isDividend && dividendYields) {
      // Objective: maximize portfolio dividend yield / volatility
      const portDivYield = w.reduce((sum, wi, i) => sum + wi * (dividendYields[i] || 0), 0);
      base = vol > 0 ? portDivYield / (vol * 0.5 + 0.01) : portDivYield;
    } else if (isMaxSharpe) {
      base = vol > 0 ? (ret - riskFreeRate) / vol : -Infinity;
    } else if (isMinVar) {
      base = -vol;
    } else if (isMinCvar && cvarReturns) {
      // Tail-Risk-Minimierung: minimiere den historischen CVaR (95 %) der
      // gewichteten Tages-Portfoliorenditen → maximiere (−CVaR).
      base = -historicalCVaR(weightedDailySeries(w, cvarReturns), 0.05);
    } else {
      base = 0;
    }

    // ─── Soft-Constraint Penalties ────────────────────────────────────────────
    // Jedes verletzte Ziel reduziert den Score proportional zur Verletzung.
    // Penalty-Gewicht 5.0: stark genug um das Ziel anzustreben, aber kein
    // harter Constraint (Optimizer bleibt immer feasible).
    const PENALTY = 5.0;
    if (userConstraints) {
      // Mindest-Dividendenrendite
      if (userConstraints.minDividendYield !== undefined && dividendYields) {
        const portDiv = w.reduce((s, wi, i) => s + wi * (dividendYields[i] || 0), 0);
        const shortfall = Math.max(0, userConstraints.minDividendYield - portDiv);
        base -= PENALTY * shortfall;
      }
      // Maximale Volatilität
      if (userConstraints.maxVolatility !== undefined) {
        const excess = Math.max(0, vol - userConstraints.maxVolatility);
        base -= PENALTY * excess;
      }
      // Mindest-Sharpe
      if (userConstraints.minSharpe !== undefined) {
        const sharpe = vol > 0 ? (ret - riskFreeRate) / vol : 0;
        const shortfall = Math.max(0, userConstraints.minSharpe - sharpe);
        base -= PENALTY * shortfall;
      }
    }
    return base;
  }

  // Gradient-free optimization using random search + local refinement
  const numTrials = 5000;
  let bestWeights = normalizeWithBounds([...x0], minW, maxW);
  let bestScore = score(bestWeights);

  for (let trial = 0; trial < numTrials; trial++) {
    const w = randomBoundedWeights(n, minW, maxW);
    const s = score(w);
    if (s > bestScore) {
      bestScore = s;
      bestWeights = w;
    }
  }

  // Refine with local search (respecting constraints)
  const stepSizes = [0.05, 0.02, 0.01, 0.005];
  for (const step of stepSizes) {
    let improved = true;
    let maxIter = 200;
    while (improved && maxIter-- > 0) {
      improved = false;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const w = [...bestWeights];
          const delta = Math.min(step, w[j] - minW);
          if (delta <= 0) continue;
          w[i] += delta;
          w[j] -= delta;
          if (w[i] > maxW || w[j] < minW) continue;

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

  return normalizeWithBounds(bestWeights, minW, maxW);
}

function buildEfficientFrontier(
  mu: number[],
  cov: number[][],
  riskFreeRate: number,
  tickers: string[],
  numPoints = 30,
  minWeight = 0.01,
  maxWeight = 0.10
): Array<{ expectedReturn: number; volatility: number; sharpe: number; topWeights: Array<{ ticker: string; weight: number }> }> {
  rng = mulberry32(OPTIMIZER_SEED); // OPT-5: deterministische Frontier
  const minRet = Math.min(...mu);
  const maxRet = Math.max(...mu);
  const retRange = maxRet - minRet;
  const n = mu.length;
  // R-34b: the frontier must respect the SAME weight bounds as the optimizer
  const { minW, maxW } = effectiveBounds(n, minWeight, maxWeight);
  const frontier: Array<{ expectedReturn: number; volatility: number; sharpe: number; topWeights: Array<{ ticker: string; weight: number }> }> = [];

  // Use wider tolerance when return range is narrow (concentrated portfolios)
  const tolerance = retRange < 0.03 ? 0.15 : 0.08;

  for (let i = 0; i < numPoints; i++) {
    const targetRet = minRet + (i / (numPoints - 1)) * retRange;

    // Find min-variance portfolio for this target return
    let bestVol = Infinity;
    let bestW: number[] = [];

    // More trials for better curve shape, wider tolerance for narrow-range portfolios
    for (let trial = 0; trial < 2000; trial++) {
      const w = randomBoundedWeights(n, minW, maxW);
      const { ret, vol } = portfolioStats(w, mu, cov);
      if (Math.abs(ret - targetRet) < tolerance * retRange && vol < bestVol) {
        bestVol = vol;
        bestW = w;
      }
    }

    if (bestW.length > 0) {
      const { ret, vol } = portfolioStats(bestW, mu, cov);
      // Build top-5 weights for tooltip
      const weightedTickers = tickers.map((t, i) => ({ ticker: t, weight: bestW[i] ?? 0 }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 5)
        .map(({ ticker, weight }) => ({ ticker, weight: Math.round(weight * 1000) / 10 }));
      frontier.push({
        expectedReturn: Math.round(ret * 10000) / 10000,
        volatility: Math.round(vol * 10000) / 10000,
        sharpe: vol > 0 ? Math.round(((ret - riskFreeRate) / vol) * 1000) / 1000 : 0,
        topWeights: weightedTickers,
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

  // Resolve each ticker's quote currency so returns can be computed in CHF.
  const currencyByTicker: { [ticker: string]: string } = {};
  for (const h of holdings) {
    currencyByTicker[h.ticker] = h.currency || (await getStockCurrency(h.ticker));
  }
  if (!currencyByTicker[benchmark]) {
    currencyByTicker[benchmark] = await getStockCurrency(benchmark);
  }

  const datedMap = await fetchReturnsWithDates(allTickers, lookbackDays, currencyByTicker);

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
  const apiKey = ENV.eodhdApiKey;
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
    eodhTicker = toEodhdSymbol(eodhTicker);

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
 * Fetch DCF fundamentals from DB stocks table (EODHD-sourced, fallback source)
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
  // Yahoo Finance removed — use DB stocks table as fallback
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return null;
    const { stocks: stocksTable } = await import("../../drizzle/schema");
    const { eq: eqOp } = await import("drizzle-orm");
    const [row] = await db.select().from(stocksTable).where(eqOp(stocksTable.ticker, ticker)).limit(1);
    if (!row) return null;
    const currentPrice = parseFloat((row.currentPrice ?? '0') as any);
    if (!currentPrice || currentPrice <= 0) return null;
    // Estimate FCF from market cap as rough proxy
    const marketCap = parseFloat((row.marketCap ?? '0') as any);
    if (!marketCap || marketCap <= 0) return null;
    const earningsGrowth = 0.05; // conservative default growth estimate
    const fcf = marketCap * 0.05; // 5% FCF yield as conservative estimate
    const shares = marketCap / currentPrice;
    const beta = parseFloat((row.beta ?? '1.0') as any) || 1.0;
    const companyName = row.companyName ?? ticker;
    const currency = row.currency ?? 'USD';
    return { currentPrice, fcf, shares, revenueGrowth: earningsGrowth, beta, companyName, currency };
  } catch (error: any) {
    console.warn(`[DCF] DB fallback fetch failed for ${ticker}:`, error.message);
    return null;
  }
}

// R-32: currency-aware risk-free base rates instead of the old flat 8 % WACC
// floor. Approximate 10Y-government-bond / policy-rate neighborhoods (2025/26):
// SNB policy rate ≈ 0–0.5 %, CHF Eidgenossen 10Y ≈ 0.5–1 % → 1.0 %;
// ECB deposit rate ≈ 2 %, Bund 10Y ≈ 2.5 % → 2.5 %;
// Fed funds ≈ 4 %, UST 10Y ≈ 4 % → 4.0 %.
const DCF_RISK_FREE_BY_CURRENCY: Record<string, number> = {
  CHF: 0.01,
  EUR: 0.025,
  USD: 0.04,
};
// Fallback for other currencies (GBP, SEK, …): between EUR and USD.
const DCF_RISK_FREE_DEFAULT = 0.03;
// WACC floor: one full equity risk premium (standard ERP ≈ 5.5 %, Damodaran).
// Replaces the old flat 8 % floor that dominated CAPM for low-beta CHF titles.
const DCF_MIN_WACC = 0.055;
// Minimum WACC − g spread for the terminal value (was 3.5 %, which crushed
// terminal values in low-rate currencies; 2 % still prevents TV explosion).
const DCF_MIN_TERMINAL_SPREAD = 0.02;

export async function calcDCF(input: DCFInput) {
  const {
    ticker,
    marketRiskPremium = 0.055,
    terminalGrowthRate = 0.025,
    projectionYears = 10,
  } = input;

  // Try EODHD first (primary), then Yahoo Finance (fallback)
  let fundamentals = await fetchDCFFromEODHD(ticker);
  let dataSource = 'EODHD';
  
  if (!fundamentals) {
    console.log(`[DCF] EODHD failed for ${ticker}, trying DB fallback...`);
    fundamentals = await fetchDCFFromYahoo(ticker);
    // Ehrliches Quellen-Label: der Fallback liest die stocks-Tabelle und SCHÄTZT
    // FCF (5 % der MarketCap) und Wachstum (5 %) — das ist kein Yahoo-Datenbezug.
    dataSource = 'Stammdaten (Schätzung)';
  }

  if (!fundamentals) {
    throw new Error(`DCF valuation failed: Could not fetch fundamental data for ${ticker} from either EODHD or Yahoo Finance.`);
  }

  const { currentPrice, fcf: rawFcf, shares, beta: betaVal, companyName, currency } = fundamentals;
  const notes: string[] = [];
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
    // Cap FCF at 5% of market cap (sustainable level for most companies) —
    // flagged in `notes` instead of silently capping (R-32e).
    fcf = marketCap * 0.05;
    notes.push(
      `FCF-Yield ${(fcfYield * 100).toFixed(1)} % > 8 % — FCF von ${Math.round(rawFcf).toLocaleString("de-CH")} auf 5 % der Marktkapitalisierung (${Math.round(fcf).toLocaleString("de-CH")}) gekappt`
    );
    console.warn(`[DCF] FCF yield ${(fcfYield*100).toFixed(1)}% too high for ${ticker}, capping at 5% of market cap`);
  }

  // WACC estimate — risk-free base is currency-aware (R-32a); an explicitly
  // provided input.riskFreeRate (DCF page slider) still takes precedence.
  const riskFreeRate =
    input.riskFreeRate ?? DCF_RISK_FREE_BY_CURRENCY[currency] ?? DCF_RISK_FREE_DEFAULT;
  const costOfEquity = riskFreeRate + betaVal * marketRiskPremium;
  const debtRatio = 0.3;
  const costOfDebt = 0.04;
  const taxRate = 0.21;
  const wacc = costOfEquity * (1 - debtRatio) + costOfDebt * (1 - taxRate) * debtRatio;

  // WACC floor of 5.5 % (one full ERP) against model uncertainty — replaces
  // the old flat 8 % floor that systematically depressed fair values (R-32a).
  const effectiveWacc = Math.max(wacc, DCF_MIN_WACC);

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
  // Minimum WACC−g spread of 2 % to prevent terminal value explosion (R-32c;
  // was 3.5 %, which understated terminal values in low-rate currencies)
  const effectiveSpread = Math.max(spreadWaccTerminal, DCF_MIN_TERMINAL_SPREAD);
  const terminalValue = terminalFCF / effectiveSpread;

  // Discount to present value using effectiveWacc
  const pvFCF = projectedFCF.reduce(
    (sum, cf, i) => sum + cf / (1 + effectiveWacc) ** (i + 1),
    0
  );
  const pvTerminal = terminalValue / (1 + effectiveWacc) ** projectionYears;

  const intrinsicValueTotal = pvFCF + pvTerminal;
  const intrinsicValuePerShare = intrinsicValueTotal / shares;

  // R-32d: no display caps — the old code capped upside at +100 % (2× price)
  // while leaving downside unbounded, an asymmetric bias. Report the number.

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
    notes,
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
    portfolioValue,
    minPositionChf,
    minPositionWeight = 0.01,
    maxPositionWeight = 0.10,
  } = input;

  if (tickers.length < 2) {
    throw new Error("At least 2 tickers required for optimization.");
  }

  // OPT-1 (Audit 2026-07): Renditen wie im Risk-Pfad (calcRiskMetrics) aufbereiten —
  // (a) Preise VOR der Renditeberechnung in CHF (Reporting-Währung) umrechnen und
  // (b) Reihen verschiedener Börsen per HANDELSDATUM alignieren statt per Array-Index.
  // Vorher wurden Renditen unterschiedlicher Kalendertage gepaart (SIX- vs. US-Feiertage)
  // und FX-Risiko ignoriert → Kovarianz/BL/HRP/Frontier systematisch verzerrt.
  const currencyByTicker: { [ticker: string]: string } = {};
  for (const t of tickers) currencyByTicker[t] = await getStockCurrency(t);
  const datedMap = await fetchReturnsWithDates(tickers, lookbackDays, currencyByTicker);

  // OPT-7 (Audit 2026-07): Mindesthistorie erzwingen. Titel mit zu kurzer
  // Kursreihe werden geflaggt AUSGESCHLOSSEN statt einbezogen — vorher drückte
  // ein einzelner junger Titel die gemeinsame Datums-Schnittmenge aller Titel
  // stillschweigend auf wenige Tage (Kovarianz aus ~6 Punkten = Rauschen).
  const MIN_HISTORY_RETURNS = 60;
  const excludedShortHistory: Array<{ ticker: string; dataPoints: number }> = [];
  const available: string[] = [];
  for (const t of tickers) {
    const points = datedMap[t]?.returns.length ?? 0;
    if (points >= MIN_HISTORY_RETURNS) available.push(t);
    else excludedShortHistory.push({ ticker: t, dataPoints: points });
  }

  if (available.length < 2) {
    throw new Error(
      `Zu wenig Kurshistorie für eine Optimierung: nur ${available.length} von ${tickers.length} Titeln ` +
      `haben mindestens ${MIN_HISTORY_RETURNS} Handelstage.`
    );
  }

  const { returnsByTicker: returnsMap, dates: alignedDates } = alignReturnsByDate(datedMap, available);
  // Nach dem Datums-Alignment bleibt die Schnittmenge gemeinsamer Handelstage.
  // Unter 30 Tagen ist jede Kovarianzschätzung Rauschen — ehrlich abbrechen.
  if (alignedDates.length < 30) {
    throw new Error(
      `Zu wenig gemeinsame Handelstage für eine Optimierung (${alignedDates.length} < 30). ` +
      `Bitte Kurshistorie der Titel prüfen.`
    );
  }

  // Annualisierte Kovarianz (Ledoit-Wolf-geschrumpft) und Erwartungsrenditen.
  const cov = shrunkCovarianceMatrix(returnsMap, available);
  const n = available.length;

  // Rohe historische Jahresmittel als Renditeschätzer sind extrem rauschanfällig
  // — der Mean-Variance-Optimizer reagiert darauf mit Extremgewichten. Black-Litterman
  // kombiniert einen markt-konsistenten Gleichgewichts-Prior (Equal-Weight als
  // neutrale Marktgewichtung) mit den historischen Mitteln als unsichere Views zu
  // einer stabileren Posterior-μ. Bei singulärer Kovarianz Fallback aufs rohe μ.
  const histMeans = available.map((t) => mean(returnsMap[t]) * TRADING_DAYS_YEAR);
  const wPrior = new Array(n).fill(1 / n);
  let mu: number[];
  try {
    mu = blPosteriorFromHistoricalMeans(cov, wPrior, histMeans);
  } catch {
    mu = histMeans;
  }

  // ─── HRP: Hierarchical Risk Parity (no expected returns needed) ───
  if (method === "hrp") {
    const hrpResult = runHRP({
      tickers: available,
      returnsMap,
      riskFreeRate,
      minPositionWeight,
      maxPositionWeight,
    });

    // Build final weights array in same order as `available`
    const hrpWeights = available.map(t => hrpResult.weights[t] ?? 0);

    // Apply min-position-CHF filter (same logic as MVO path)
    const MIN_POSITION_CHF_HRP = minPositionChf ?? 3000;
    let finalHrpWeights = hrpWeights;
    const droppedHrp: Array<{ ticker: string; targetWeight: number; targetValueCHF: number }> = [];
    if (portfolioValue && portfolioValue > 0) {
      const keepIdx: number[] = [];
      const dropIdx: number[] = [];
      hrpWeights.forEach((w, i) => {
        if (w * portfolioValue < MIN_POSITION_CHF_HRP) dropIdx.push(i);
        else keepIdx.push(i);
      });
      if (dropIdx.length > 0 && keepIdx.length >= 2) {
        const { minW, maxW } = effectiveBounds(keepIdx.length, minPositionWeight, maxPositionWeight);
        const kept = normalizeWithBounds(keepIdx.map(i => hrpWeights[i]), minW, maxW);
        finalHrpWeights = new Array(available.length).fill(0);
        keepIdx.forEach((idx, j) => { finalHrpWeights[idx] = kept[j]; });
        dropIdx.forEach(i => {
          droppedHrp.push({
            ticker: available[i],
            targetWeight: Math.round(hrpWeights[i] * 10000) / 10000,
            targetValueCHF: Math.round(hrpWeights[i] * portfolioValue),
          });
        });
      }
    }

    const weightsMapHrp: Record<string, number> = {};
    for (let i = 0; i < available.length; i++) {
      weightsMapHrp[available[i]] = Math.round(finalHrpWeights[i] * 10000) / 10000;
    }

    // Portfolio stats using HRP weights
    const { ret: hrpRet, vol: hrpVol, sharpe: hrpSharpe } = portfolioStats(finalHrpWeights, mu, cov, riskFreeRate);
    const { ret: currRet2, vol: currVol2, sharpe: currSharpe2 } = portfolioStats(new Array(available.length).fill(1 / available.length), mu, cov, riskFreeRate);

    const assetStatsHrp = available.map((ticker, i) => ({
      ticker,
      currentWeight: Math.round((1 / available.length) * 1000) / 10,
      optimalWeight: Math.round(finalHrpWeights[i] * 1000) / 10,
      annualReturn: Math.round(mu[i] * 10000) / 100,
      volatility: Math.round(Math.sqrt(cov[i][i]) * 10000) / 100,
      sharpe: Math.round(calcSharpe(returnsMap[ticker], riskFreeRate) * 1000) / 1000,
      riskContribution: Math.round((hrpResult.riskContributions[ticker] ?? 0) * 10000) / 100,
    }));

    return {
      method: 'hrp',
      optimalPortfolio: {
        expectedReturn: Math.round(hrpRet * 10000) / 10000,
        volatility: Math.round(hrpVol * 10000) / 10000,
        sharpe: Math.round(hrpSharpe * 1000) / 1000,
        annualReturn: Math.round(hrpRet * 10000) / 100,
        sharpeRatio: Math.round(hrpSharpe * 1000) / 1000,
        diversificationRatio: hrpResult.portfolioStats.diversificationRatio,
        sortedTickers: hrpResult.sortedTickers,
      },
      currentPortfolio: {
        expectedReturn: Math.round(currRet2 * 10000) / 10000,
        volatility: Math.round(currVol2 * 10000) / 10000,
        sharpe: Math.round(currSharpe2 * 1000) / 1000,
      },
      weights: weightsMapHrp,
      assets: assetStatsHrp,
      efficientFrontier: buildEfficientFrontier(mu, cov, riskFreeRate, available, 30, minPositionWeight, maxPositionWeight),
      tickers: available,
      droppedPositions: droppedHrp,
      // OPT-7: Titel, die mangels Kurshistorie NICHT optimiert wurden.
      excludedShortHistory,
      // HRP ist ein deterministisches Cluster-Verfahren ohne Zufallssuche.
      optimizerEngine: "analytic" as const,
      minPositionChf: MIN_POSITION_CHF_HRP,
      hrpMeta: {
        clusterOrder: hrpResult.sortedTickers,
        riskContributions: hrpResult.riskContributions,
        diversificationRatio: hrpResult.portfolioStats.diversificationRatio,
      },
    };
  }

  // Fetch dividend yields from stocks DB table (EODHD-sourced)
  let dividendYields: number[] | undefined;
  if (method === "max_dividend" || input.userConstraints?.minDividendYield !== undefined) {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (db) {
      const { stocks: stocksTable } = await import("../../drizzle/schema");
      const { inArray: inArr } = await import("drizzle-orm");
      const rows = await db.select({ ticker: stocksTable.ticker, div: stocksTable.dividendYield }).from(stocksTable).where((inArr(stocksTable.ticker, available) as any));
      const divMap: Record<string, number> = {};
      for (const r of rows) {
        if (r.div != null) divMap[r.ticker] = parseFloat(r.div as any) / 100; // stored as percent
      }
      dividendYields = available.map((t) => divMap[t] ?? 0);
    } else {
      dividendYields = available.map(() => 0);
    }
  }

  // Optimal weights: zuerst der EXAKTE Optimierer (PyPortfolioOpt im
  // analytics_service — konvexer Solver, optional harte Sektor-Caps), sofern
  // konfiguriert und die Methode exakt lösbar ist. μ und Kovarianz gehen
  // UNVERÄNDERT von hier mit (BL-Posterior + Ledoit-Wolf aus CHF-Renditen) —
  // Python löst nur das Optimierungsproblem. Fällt der Dienst aus oder ist
  // ANALYTICS_SERVICE_URL nicht gesetzt, greift die bisherige deterministische
  // Zufallssuche; das Ergebnis kennzeichnet die Herkunft (optimizerEngine).
  // Soft-Constraints (userConstraints, Penalty-Terme) und max_dividend sind
  // nicht als konvexes Problem abgebildet → immer Zufallssuche.
  let optimizerEngine: "exact" | "random_search" | "analytic" =
    method === "equal_weight" ? "analytic" : "random_search";
  let optimalWeights: number[] | null = null;

  // Datums-alignierte Asset-Renditematrix (EODHD, CHF) — Basis für die
  // CVaR-Zielfunktion und für die CVaR-Kennzahl (aktuell vs. optimiert).
  const assetReturnsMatrix: number[][] = available.map((t) => returnsMap[t]);
  const cvarReturns = method === "min_cvar" ? assetReturnsMatrix : undefined;
  if ((method === "max_sharpe" || method === "min_variance") && !input.userConstraints) {
    const { solveExactWeights } = await import("./exactOptimizer");
    const { minW, maxW } = effectiveBounds(n, minPositionWeight, maxPositionWeight);
    const exact = await solveExactWeights({
      tickers: available,
      mu,
      cov,
      riskFreeRate,
      minWeight: minW,
      maxWeight: maxW,
      method,
      sectorByTicker: input.sectorByTicker,
      maxSectorWeightPct: input.maxSectorWeightPct,
    });
    if (exact) {
      optimalWeights = available.map((t) => exact.weights[t] ?? 0);
      optimizerEngine = "exact";
    }
  }
  if (!optimalWeights) {
    // F2: Positions-Bounds aus den Diversifikationsregeln
    optimalWeights = optimizeWeights(mu, cov, method, riskFreeRate, dividendYields, {
      minWeight: minPositionWeight,
      maxWeight: maxPositionWeight,
    }, input.userConstraints, cvarReturns);
  }

  // R-34c: Mindest-Positionsgrösse CHF 3'000 — Zielpositionen, deren Wert
  // (Zielgewicht × Portfoliowert) unter der Mindestgrösse liegt, werden auf 0
  // gesetzt; ihr Gewicht wird innerhalb der Bounds auf die verbleibenden Titel
  // umverteilt. Nur aktiv, wenn der Portfoliowert übergeben wurde; bei < 2
  // verbleibenden Titeln wird die Regel ausgesetzt (Regel wäre unerfüllbar,
  // z. B. bei sehr kleinen Portfolios).
  const MIN_POSITION_CHF = minPositionChf ?? 3000;
  let finalWeights = optimalWeights;
  const droppedPositions: Array<{ ticker: string; targetWeight: number; targetValueCHF: number }> = [];
  if (portfolioValue && portfolioValue > 0) {
    const keepIdx: number[] = [];
    const dropIdx: number[] = [];
    optimalWeights.forEach((w, i) => {
      if (w * portfolioValue < MIN_POSITION_CHF) dropIdx.push(i);
      else keepIdx.push(i);
    });
    if (dropIdx.length > 0 && keepIdx.length >= 2) {
      const { minW, maxW } = effectiveBounds(keepIdx.length, minPositionWeight, maxPositionWeight);
      const kept = normalizeWithBounds(keepIdx.map((i) => optimalWeights[i]), minW, maxW);
      finalWeights = new Array(n).fill(0);
      keepIdx.forEach((idx, j) => {
        finalWeights[idx] = kept[j];
      });
      dropIdx.forEach((i) => {
        droppedPositions.push({
          ticker: available[i],
          targetWeight: Math.round(optimalWeights[i] * 10000) / 10000,
          targetValueCHF: Math.round(optimalWeights[i] * portfolioValue),
        });
      });
    }
  }

  const { ret: optRet, vol: optVol, sharpe: optSharpe } = portfolioStats(finalWeights, mu, cov, riskFreeRate);

  // Current portfolio: use actual weights if provided, else fall back to equal weight
  const actualWeights: number[] = available.map((ticker) => {
    const w = input.currentWeights?.[ticker];
    return w !== undefined && w > 0 ? w : 0;
  });
  const actualWeightSum = actualWeights.reduce((s, w) => s + w, 0);
  const currentWeightsArr = actualWeightSum > 0.5
    ? actualWeights.map(w => w / actualWeightSum) // normalise to sum=1
    : new Array(n).fill(1 / n); // fallback: equal weight
  const { ret: currRet, vol: currVol, sharpe: currSharpe } = portfolioStats(currentWeightsArr, mu, cov, riskFreeRate);

  // CVaR (95 %, historisch) der gewichteten Tagesrenditen als Tail-Risiko-Kennzahl
  // (positiver Wert = mittlerer Verlust an den schlechtesten 5 % der Handelstage).
  const optCvar95 = historicalCVaR(weightedDailySeries(finalWeights, assetReturnsMatrix), 0.05);
  const currCvar95 = historicalCVaR(weightedDailySeries(currentWeightsArr, assetReturnsMatrix), 0.05);

  // Efficient frontier
  // OPT-3: Frontier mit DENSELBEN Bounds wie das Optimum (vorher Default 1-10 %).
  const efficientFrontier = buildEfficientFrontier(mu, cov, riskFreeRate, available, 30, minPositionWeight, maxPositionWeight);

  // Per-asset stats
  const assetStats = available.map((ticker, i) => {
    const ar = returnsMap[ticker];
    // Use actual portfolio weight if provided, otherwise fall back to equal-weight
    const actualCurW = input.currentWeights?.[ticker];
    const curW = (actualCurW !== undefined && actualCurW > 0)
      ? actualCurW / (actualWeightSum > 0.5 ? actualWeightSum : 1) // normalise to 0..1
      : 1 / n;
    return {
      ticker,
      currentWeight: Math.round(curW * 1000) / 10,
      optimalWeight: Math.round(finalWeights[i] * 1000) / 10,
      annualReturn: Math.round(mu[i] * 10000) / 100,
      volatility: Math.round(Math.sqrt(cov[i][i]) * 10000) / 100,
      sharpe: Math.round(calcSharpe(ar, riskFreeRate) * 1000) / 1000,
    };
  });

  const weightsMap: { [ticker: string]: number } = {};
  for (let i = 0; i < available.length; i++) {
    weightsMap[available[i]] = Math.round(finalWeights[i] * 10000) / 10000;
  }

  // Constraint-Zielerreichung berechnen (für Frontend-Anzeige)
  const optPortDiv = dividendYields
    ? finalWeights.reduce((s, w, i) => s + w * (dividendYields[i] || 0), 0)
    : null;
  const currPortDiv = dividendYields
    ? currentWeightsArr.reduce((s, w, i) => s + w * (dividendYields[i] || 0), 0)
    : null;

  const constraintAchievement = input.userConstraints ? {
    minDividendYield: input.userConstraints.minDividendYield !== undefined ? {
      target: input.userConstraints.minDividendYield,
      achieved: optPortDiv !== null ? Math.round(optPortDiv * 10000) / 10000 : null,
      current: currPortDiv !== null ? Math.round(currPortDiv * 10000) / 10000 : null,
      met: optPortDiv !== null ? optPortDiv >= input.userConstraints.minDividendYield - 0.001 : false,
    } : undefined,
    maxVolatility: input.userConstraints.maxVolatility !== undefined ? {
      target: input.userConstraints.maxVolatility,
      achieved: Math.round(optVol * 10000) / 10000,
      current: Math.round(currVol * 10000) / 10000,
      met: optVol <= input.userConstraints.maxVolatility + 0.001,
    } : undefined,
    minSharpe: input.userConstraints.minSharpe !== undefined ? {
      target: input.userConstraints.minSharpe,
      achieved: Math.round(optSharpe * 1000) / 1000,
      current: Math.round(currSharpe * 1000) / 1000,
      met: optSharpe >= input.userConstraints.minSharpe - 0.01,
    } : undefined,
  } : undefined;

  return {
    method,
    optimalPortfolio: {
      expectedReturn: Math.round(optRet * 10000) / 10000,
      volatility: Math.round(optVol * 10000) / 10000,
      sharpe: Math.round(optSharpe * 1000) / 1000,
      annualReturn: Math.round(optRet * 10000) / 100,
      sharpeRatio: Math.round(optSharpe * 1000) / 1000,
      // CVaR 95 % (Tages-Tail-Verlust) in Prozent — additiv.
      cvar95: Math.round(optCvar95 * 10000) / 100,
    },
    currentPortfolio: {
      expectedReturn: Math.round(currRet * 10000) / 10000,
      volatility: Math.round(currVol * 10000) / 10000,
      sharpe: Math.round(currSharpe * 1000) / 1000,
      cvar95: Math.round(currCvar95 * 10000) / 100,
    },
    weights: weightsMap,
    assets: assetStats,
    efficientFrontier,
    tickers: available,
    // R-34c (additiv): Positionen, die wegen der Mindestgrösse CHF 3'000
    // auf 0 gesetzt wurden (leer, wenn kein portfolioValue übergeben wurde).
    droppedPositions,
    // OPT-7 (additiv): Titel, die mangels Kurshistorie (< 60 Handelstage)
    // NICHT in die Optimierung eingeflossen sind.
    excludedShortHistory,
    // Herkunft der Gewichte: "exact" = PyPortfolioOpt (analytics_service),
    // "random_search" = TS-Fallback, "analytic" = equal_weight.
    optimizerEngine,
    minPositionChf: MIN_POSITION_CHF,
    // Constraint-Zielerreichung (nur wenn userConstraints gesetzt)
    constraintAchievement,
  };
}

// ─────────────────────────────────────────────
// Public API: Portfolio-Backtest
// ─────────────────────────────────────────────

export interface BacktestInput {
  tickers: string[];
  weights: number[]; // Reihenfolge = tickers; wird normalisiert
  lookbackDays?: number;
  rebalance?: "monthly" | "none";
}

/**
 * Historischer Portfolio-Backtest auf Basis der EODHD-Historie (CHF, datums-
 * aligniert — identische Datenbasis wie Optimizer/Risk). Simuliert die
 * Ziel-Allokation über den Zeitraum mit monatlichem Rebalancing oder als
 * Buy-and-Hold und liefert Kennzahlen (Gesamtrendite, CAGR, Volatilität,
 * Sharpe, Max Drawdown) plus eine monatlich verdichtete Equity-Kurve.
 *
 * Kein eigener Kursabruf über Drittquellen — konsistent mit dem Rest der App.
 */
export async function runPortfolioBacktest(input: BacktestInput) {
  const { tickers, weights, lookbackDays = 756, rebalance = "monthly" } = input;
  if (tickers.length < 1) throw new Error("Mindestens 1 Titel erforderlich.");
  if (weights.length !== tickers.length) {
    throw new Error("weights und tickers müssen gleich lang sein.");
  }

  const currencyByTicker: { [ticker: string]: string } = {};
  for (const t of tickers) currencyByTicker[t] = await getStockCurrency(t);
  const datedMap = await fetchReturnsWithDates(tickers, lookbackDays, currencyByTicker);

  // Nur Titel mit ausreichender Historie; Gewichte darauf renormieren.
  const MIN_RETURNS = 30;
  const available: string[] = [];
  const excluded: string[] = [];
  for (const t of tickers) {
    if ((datedMap[t]?.returns.length ?? 0) >= MIN_RETURNS) available.push(t);
    else excluded.push(t);
  }
  if (available.length < 1) {
    throw new Error("Zu wenig Kurshistorie für einen Backtest (keine Titel mit ≥ 30 Handelstagen).");
  }

  const { returnsByTicker: returnsMap, dates: alignedDates } = alignReturnsByDate(datedMap, available);
  const T = alignedDates.length;
  if (T < MIN_RETURNS) {
    throw new Error(`Zu wenig gemeinsame Handelstage für einen Backtest (${T} < ${MIN_RETURNS}).`);
  }

  const rawW = available.map((t) => Math.max(0, weights[tickers.indexOf(t)] ?? 0));
  const wSum = rawW.reduce((s, w) => s + w, 0);
  if (wSum <= 0) throw new Error("Summe der Gewichte muss grösser als 0 sein.");
  const w = rawW.map((x) => x / wSum);

  // Equity-Kurve simulieren (Start = 1.0). Jeder Sleeve driftet mit der
  // Einzeltitel-Rendite; bei "monthly" zu Monatsbeginn auf Zielgewichte zurück.
  let sleeves = w.slice();
  const equity: number[] = [];
  const equityDates: string[] = [];
  for (let k = 0; k < T; k++) {
    for (let i = 0; i < available.length; i++) {
      sleeves[i] *= 1 + (returnsMap[available[i]][k] ?? 0);
    }
    const total = sleeves.reduce((s, v) => s + v, 0);
    equity.push(total);
    equityDates.push(alignedDates[k]);
    if (
      rebalance === "monthly" &&
      k > 0 &&
      alignedDates[k].slice(0, 7) !== alignedDates[k - 1].slice(0, 7)
    ) {
      sleeves = w.map((wi) => total * wi);
    }
  }

  // Tägliche Portfoliorenditen aus der Equity-Kurve → Vol/Sharpe/Drawdown.
  const portReturns: number[] = [];
  for (let k = 1; k < equity.length; k++) {
    portReturns.push(equity[k] / equity[k - 1] - 1);
  }
  const finalValue = equity[equity.length - 1];
  const totalReturn = finalValue - 1;
  const years = T / TRADING_DAYS_YEAR;
  const cagr = years > 0 && finalValue > 0 ? Math.pow(finalValue, 1 / years) - 1 : 0;
  const annVol = std(portReturns) * SQRT_TRADING_DAYS;
  const annRet = mean(portReturns) * TRADING_DAYS_YEAR;
  const { getRiskFreeRate } = await import("../lib/riskFreeRate");
  const rf = await getRiskFreeRate();
  const sharpe = annVol > 0 ? (annRet - rf) / annVol : 0;

  // Maximaler Drawdown auf der Equity-Kurve.
  let peak = equity[0];
  let maxDrawdown = 0;
  for (const v of equity) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? (v - peak) / peak : 0;
    if (dd < maxDrawdown) maxDrawdown = dd;
  }

  // Equity-Kurve auf Monatswerte verdichten (Antwortgrösse begrenzen).
  const curve: Array<{ date: string; value: number }> = [];
  for (let k = 0; k < equity.length; k++) {
    const isMonthEnd = k === equity.length - 1 || equityDates[k].slice(0, 7) !== equityDates[k + 1].slice(0, 7);
    if (k === 0 || isMonthEnd) {
      curve.push({ date: equityDates[k], value: Math.round(equity[k] * 10000) / 10000 });
    }
  }

  return {
    rebalance,
    tickers: available,
    excludedTickers: excluded,
    weights: Object.fromEntries(available.map((t, i) => [t, Math.round(w[i] * 10000) / 10000])),
    stats: {
      totalReturnPct: Math.round(totalReturn * 10000) / 100,
      cagrPct: Math.round(cagr * 10000) / 100,
      annualVolPct: Math.round(annVol * 10000) / 100,
      sharpe: Math.round(sharpe * 1000) / 1000,
      maxDrawdownPct: Math.round(maxDrawdown * 10000) / 100,
    },
    equityCurve: curve,
    tradingDays: T,
    fromDate: alignedDates[0],
    toDate: alignedDates[T - 1],
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

  // Fetch price data from DB (EODHD-sourced historicalPrices table)
  const lookbackForTA = Math.max(lookbackDays, 250) * 2; // 2x for RSI warm-up
  const pricesMap = await fetchPricesFromDB([ticker], lookbackForTA);
  const series = pricesMap[ticker];
  if (!series || series.length < 30) {
    throw new Error(`Insufficient price data for ${ticker} in DB (need at least 30 days, got ${series?.length ?? 0})`);
  }
  const prices = series.map((s) => s.price);
  const dates = series.map((s) => s.date);
  const currentPrice = prices[prices.length - 1];

  // Get company name from stocks table
  let companyName = ticker;
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (db) {
      const { stocks: stocksTable } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [stockRow] = await db.select({ name: stocksTable.companyName }).from(stocksTable).where(eq(stocksTable.ticker, ticker)).limit(1);
      if (stockRow?.name) companyName = stockRow.name;
    }
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

  // OPT-1 (Audit 2026-07): gleiche Aufbereitung wie calcRiskMetrics — Preise werden
  // VOR der Renditeberechnung nach CHF konvertiert und Reihen verschiedener Börsen
  // per Handelsdatum aligniert. Vorher: rohe Lokalwährung + Index-Zipping über die
  // kürzeste Reihe → der Score-Verlauf widersprach dem Headline-Risikoscore.
  const allTickers = Array.from(new Set([...tickers, benchmark]));
  const currencyByTicker: { [ticker: string]: string } = {};
  for (const h of holdings) {
    currencyByTicker[h.ticker] = h.currency || (await getStockCurrency(h.ticker));
  }
  if (!currencyByTicker[benchmark]) {
    currencyByTicker[benchmark] = await getStockCurrency(benchmark);
  }
  const datedMap = await fetchReturnsWithDates(allTickers, totalDaysNeeded, currencyByTicker);

  // Find available tickers
  const available = tickers.filter((t) => datedMap[t] && datedMap[t].returns.length > windowDays + 5);
  if (available.length === 0) {
    return [];
  }

  // Recompute weights for available tickers
  const availIdx = available.map((t) => tickers.indexOf(t));
  let weightsAvail = availIdx.map((i) => weights[i]);
  const wSum = weightsAvail.reduce((s, v) => s + v, 0);
  if (wSum > 0) weightsAvail = weightsAvail.map((w) => w / wSum);

  // Auf gemeinsame Handelstage alignieren (inkl. Benchmark, falls vorhanden).
  const hasBenchmark = !!datedMap[benchmark];
  const alignList = hasBenchmark ? [...available, benchmark] : [...available];
  const { dates: commonDates, returnsByTicker: aligned } = alignReturnsByDate(datedMap, alignList);
  const benchmarkReturns: number[] | null = hasBenchmark ? (aligned[benchmark] ?? null) : null;

  const totalReturns = commonDates.length;
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
      const tickerReturns = aligned[available[t]];
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
      date: commonDates[endIdx],
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

