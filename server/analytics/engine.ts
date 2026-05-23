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
 */

import YahooFinanceClass from "yahoo-finance2";
// yahoo-finance2 v3: default export is a constructor class
const yahooFinance = new (YahooFinanceClass as any)();

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const TRADING_DAYS_YEAR = 252;
const SQRT_TRADING_DAYS = Math.sqrt(TRADING_DAYS_YEAR);
const DEFAULT_RISK_FREE_RATE = 0.02;

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
  method?: "max_sharpe" | "min_variance" | "equal_weight";
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

  // Build returns map with original ticker names
  const reverseMap: { [norm: string]: string } = {};
  for (const [orig, norm] of Object.entries(normalizedMap)) {
    reverseMap[norm] = orig;
  }

  const returns: { [ticker: string]: number[] } = {};
  for (const [norm, prices] of Object.entries(pricesByNorm)) {
    const orig = reverseMap[norm] ?? norm;
    const tail = prices.slice(-lookbackDays - 1);
    const rets: number[] = [];
    for (let i = 1; i < tail.length; i++) {
      rets.push((tail[i] - tail[i - 1]) / tail[i - 1]);
    }
    if (rets.length > 10) {
      returns[orig] = rets;
    }
  }

  return returns;
}

// ─────────────────────────────────────────────
// Statistical Helpers
// ─────────────────────────────────────────────
function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr: number[], ddof = 1): number {
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - ddof);
  return Math.sqrt(variance);
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

function dotProduct(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

function matVecMul(mat: number[][], vec: number[]): number[] {
  return mat.map((row) => dotProduct(row, vec));
}

function calcSharpe(returns: number[], rf = DEFAULT_RISK_FREE_RATE): number {
  const excess = returns.map((r) => r - rf / TRADING_DAYS_YEAR);
  const s = std(excess);
  if (s === 0) return 0;
  return (mean(excess) / s) * SQRT_TRADING_DAYS;
}

function calcSortino(returns: number[], rf = DEFAULT_RISK_FREE_RATE): number {
  const excess = returns.map((r) => r - rf / TRADING_DAYS_YEAR);
  const downside = returns.filter((r) => r < 0);
  if (downside.length === 0) return 0;
  const downsideDev =
    Math.sqrt(downside.reduce((s, v) => s + v ** 2, 0) / downside.length) *
    SQRT_TRADING_DAYS;
  if (downsideDev === 0) return 0;
  return (mean(excess) * TRADING_DAYS_YEAR) / downsideDev;
}

function calcVarHistorical(returns: number[], confidence = 0.95): number {
  return -percentile(returns, (1 - confidence) * 100);
}

function calcVarParametric(returns: number[], confidence = 0.95): number {
  const m = mean(returns);
  const s = std(returns);
  // Inverse normal CDF approximation (Beasley-Springer-Moro)
  const z = normInv(1 - confidence);
  return -(m + z * s);
}

function calcCVar(returns: number[], confidence = 0.95): number {
  const varVal = calcVarHistorical(returns, confidence);
  const tail = returns.filter((r) => r <= -varVal);
  if (tail.length === 0) return varVal;
  return -mean(tail);
}

function calcMaxDrawdown(returns: number[]): number {
  let cumulative = 1;
  let peak = 1;
  let maxDD = 0;
  for (const r of returns) {
    cumulative *= 1 + r;
    if (cumulative > peak) peak = cumulative;
    const dd = (cumulative - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  return maxDD;
}

function calcBeta(portfolioReturns: number[], benchmarkReturns: number[]): number {
  const n = Math.min(portfolioReturns.length, benchmarkReturns.length);
  const p = portfolioReturns.slice(0, n);
  const b = benchmarkReturns.slice(0, n);
  const mp = mean(p);
  const mb = mean(b);
  let cov = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    cov += (p[i] - mp) * (b[i] - mb);
    varB += (b[i] - mb) ** 2;
  }
  cov /= n - 1;
  varB /= n - 1;
  return varB !== 0 ? cov / varB : 0;
}

function calcVolatility(returns: number[]): number {
  return std(returns) * SQRT_TRADING_DAYS;
}

function calcCalmar(returns: number[]): number {
  const annualReturn = mean(returns) * TRADING_DAYS_YEAR;
  const maxDD = Math.abs(calcMaxDrawdown(returns));
  if (maxDD === 0) return 0;
  return annualReturn / maxDD;
}

// Normal inverse CDF approximation (rational approximation)
function normInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
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
  riskFreeRate: number
): number[] {
  const n = mu.length;
  const x0 = new Array(n).fill(1 / n);

  if (method === "equal_weight") return x0;

  // Gradient-free optimization using simulated annealing + local search
  // This is a simplified but effective approach for portfolio optimization
  const numTrials = 5000;
  let bestWeights = [...x0];
  let bestScore = method === "max_sharpe" ? -Infinity : Infinity;

  const rng = () => Math.random();

  for (let trial = 0; trial < numTrials; trial++) {
    // Generate random weights that sum to 1
    const raw = Array.from({ length: n }, () => rng());
    const sum = raw.reduce((s, v) => s + v, 0);
    const w = raw.map((v) => v / sum);

    const { ret, vol, sharpe } = portfolioStats(w, mu, cov);

    if (method === "max_sharpe") {
      const score = vol > 0 ? (ret - riskFreeRate) / vol : -Infinity;
      if (score > bestScore) {
        bestScore = score;
        bestWeights = w;
      }
    } else if (method === "min_variance") {
      const score = vol;
      if (score < bestScore) {
        bestScore = score;
        bestWeights = w;
      }
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
          const delta = Math.min(step, w[j]); // can't go below 0
          w[i] += delta;
          w[j] -= delta;
          if (w[i] > 1 || w[j] < 0) continue;

          const { ret, vol, sharpe } = portfolioStats(w, mu, cov);
          if (method === "max_sharpe") {
            const score = vol > 0 ? (ret - riskFreeRate) / vol : -Infinity;
            if (score > bestScore) {
              bestScore = score;
              bestWeights = w;
              improved = true;
            }
          } else if (method === "min_variance") {
            const score = vol;
            if (score < bestScore) {
              bestScore = score;
              bestWeights = w;
              improved = true;
            }
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
  const returnsMap = await fetchReturns(allTickers, lookbackDays);

  const available = tickers.filter((t) => returnsMap[t]);
  if (available.length === 0) {
    throw new Error("None of the provided tickers returned data.");
  }

  // Recompute weights for available tickers
  const availIdx = available.map((t) => tickers.indexOf(t));
  let weightsAvail = availIdx.map((i) => weights[i]);
  const wSum = weightsAvail.reduce((s, v) => s + v, 0);
  if (wSum > 0) weightsAvail = weightsAvail.map((w) => w / wSum);

  const portfolioRets = weightedReturns(returnsMap, available, weightsAvail);
  const benchmarkRets = returnsMap[benchmark] ?? null;

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
    beta = calcBeta(portfolioRets, benchmarkRets);
    const excessRf = annualReturn - riskFreeRate;
    treynor = beta !== 0 ? excessRf / beta : null;
    const n = Math.min(portfolioRets.length, benchmarkRets.length);
    const excessBench = portfolioRets.slice(0, n).map((r, i) => r - benchmarkRets[i]);
    const te = std(excessBench) * SQRT_TRADING_DAYS;
    informationRatio = te !== 0 ? (mean(excessBench) * TRADING_DAYS_YEAR) / te : 0;
  }

  const assetMetrics = available.map((ticker, i) => {
    const ar = returnsMap[ticker];
    return {
      ticker,
      weight: weightsAvail[i],
      annualReturn: Math.round(mean(ar) * TRADING_DAYS_YEAR * 10000) / 100,
      volatility: Math.round(calcVolatility(ar) * 10000) / 100,
      sharpe: Math.round(calcSharpe(ar, riskFreeRate) * 1000) / 1000,
      beta: benchmarkRets ? Math.round(calcBeta(ar, benchmarkRets) * 1000) / 1000 : null,
      maxDrawdown: Math.round(calcMaxDrawdown(ar) * 10000) / 100,
    };
  });

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
      dataPoints: portfolioRets.length,
      benchmark,
    },
    assets: assetMetrics,
  };
}

// ─────────────────────────────────────────────
// Public API: DCF Valuation
// ─────────────────────────────────────────────
export async function calcDCF(input: DCFInput) {
  const {
    ticker,
    riskFreeRate = DEFAULT_RISK_FREE_RATE,
    marketRiskPremium = 0.055,
    terminalGrowthRate = 0.025,
    projectionYears = 5,
  } = input;

  const normalizedTicker = normalizeTicker(ticker);

  // Fetch quote summary from Yahoo Finance
  const quoteSummary = await yahooFinance.quoteSummary(normalizedTicker, {
    modules: ["financialData", "defaultKeyStatistics", "summaryDetail"],
  }) as any;

  const fd = quoteSummary.financialData as any;
  const ks = quoteSummary.defaultKeyStatistics as any;
  const sd = quoteSummary.summaryDetail as any;

  const currentPrice = fd?.currentPrice ?? sd?.regularMarketPrice;
  if (!currentPrice) {
    throw new Error("Current price not available.");
  }

  // Free Cash Flow
  let fcf: number | null = fd?.freeCashflow ?? null;

  // Fallback: operating cash flow - capex
  if (!fcf || fcf <= 0) {
    const opCF = fd?.operatingCashflow;
    if (opCF && opCF > 0) {
      fcf = opCF * 0.7; // rough FCF estimate as 70% of operating CF
    }
  }

  if (!fcf || fcf <= 0) {
    throw new Error("Insufficient free cash flow data for DCF valuation.");
  }

  const shares = ks?.sharesOutstanding ?? ks?.impliedSharesOutstanding;
  if (!shares || shares <= 0) {
    throw new Error("Shares outstanding not available.");
  }

  // Revenue growth estimate
  let revenueGrowth = fd?.revenueGrowth ?? 0.05;
  revenueGrowth = Math.max(Math.min(revenueGrowth, 0.30), -0.10);

  // WACC estimate
  const betaVal = ks?.beta ?? 1.0;
  const costOfEquity = riskFreeRate + betaVal * marketRiskPremium;
  const debtRatio = 0.3;
  const costOfDebt = 0.04;
  const taxRate = 0.21;
  const wacc = costOfEquity * (1 - debtRatio) + costOfDebt * (1 - taxRate) * debtRatio;

  // Project FCF for N years
  const projectedFCF: number[] = [];
  for (let year = 1; year <= projectionYears; year++) {
    const growth = revenueGrowth * Math.max(0.5, 1 - year * 0.1);
    projectedFCF.push(fcf * (1 + growth) ** year);
  }

  // Terminal value
  const terminalFCF = projectedFCF[projectedFCF.length - 1] * (1 + terminalGrowthRate);
  const terminalValue =
    wacc > terminalGrowthRate ? terminalFCF / (wacc - terminalGrowthRate) : 0;

  // Discount to present value
  const pvFCF = projectedFCF.reduce(
    (sum, cf, i) => sum + cf / (1 + wacc) ** (i + 1),
    0
  );
  const pvTerminal = terminalValue / (1 + wacc) ** projectionYears;

  const intrinsicValueTotal = pvFCF + pvTerminal;
  const intrinsicValuePerShare = intrinsicValueTotal / shares;
  const upsidePct = ((intrinsicValuePerShare - currentPrice) / currentPrice) * 100;

  const currency = fd?.currency ?? "USD";
  const companyName = (quoteSummary as any)?.quoteType?.longName ?? ticker;

  return {
    ticker,
    currentPrice: Math.round(currentPrice * 100) / 100,
    intrinsicValue: Math.round(intrinsicValuePerShare * 100) / 100,
    upsideDownside: Math.round(upsidePct * 10) / 10,
    wacc: Math.round(wacc * 10000) / 100,
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

  // Optimal weights
  const optimalWeights = optimizeWeights(mu, cov, method, riskFreeRate);
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
