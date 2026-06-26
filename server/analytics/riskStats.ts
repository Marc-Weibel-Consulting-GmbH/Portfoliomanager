/**
 * Pure statistical & risk-metric helpers used by the analytics engine.
 *
 * Extracted from analytics/engine.ts so they can be unit-tested without pulling in
 * the Yahoo Finance client. All functions are pure (no I/O).
 *
 * Conventions:
 *   - Inputs are arrays of *daily* simple returns (e.g. 0.012 = +1.2%).
 *   - Annualization uses 252 trading days; volatility/Sharpe scale by sqrt(252),
 *     mean-based annual figures by *252. Sharpe and Sortino therefore share the
 *     same effective annualization (mean·√252 / risk).
 *   - Cross-series metrics (beta, tracking error, information ratio) require the
 *     two series to be aligned on the SAME trading dates — use alignReturnsByDate
 *     before calling them, otherwise positionally-zipped arrays from different
 *     trading calendars produce wrong results.
 */

export const TRADING_DAYS_YEAR = 252;
export const SQRT_TRADING_DAYS = Math.sqrt(TRADING_DAYS_YEAR);
export const DEFAULT_RISK_FREE_RATE = 0.02;

export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

export function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function calcSharpe(returns: number[], rf = DEFAULT_RISK_FREE_RATE): number {
  const excess = returns.map((r) => r - rf / TRADING_DAYS_YEAR);
  const s = std(excess);
  if (s === 0) return 0;
  return (mean(excess) / s) * SQRT_TRADING_DAYS;
}

export function calcSortino(returns: number[], rf = DEFAULT_RISK_FREE_RATE): number {
  if (returns.length === 0) return 0;
  const excess = returns.map((r) => r - rf / TRADING_DAYS_YEAR);
  const downside = returns.filter((r) => r < 0);
  if (downside.length === 0) return 0;
  // Downside deviation divides the sum of squared negative returns by the TOTAL
  // number of observations (N), not by the count of negative days. Dividing by
  // downside.length overstates the downside deviation and understates Sortino.
  const downsideDev =
    Math.sqrt(downside.reduce((s, v) => s + v ** 2, 0) / returns.length) *
    SQRT_TRADING_DAYS;
  if (downsideDev === 0) return 0;
  return (mean(excess) * TRADING_DAYS_YEAR) / downsideDev;
}

export function calcVarHistorical(returns: number[], confidence = 0.95): number {
  return -percentile(returns, (1 - confidence) * 100);
}

export function calcVarParametric(returns: number[], confidence = 0.95): number {
  const m = mean(returns);
  const s = std(returns);
  const z = normInv(1 - confidence);
  return -(m + z * s);
}

export function calcCVar(returns: number[], confidence = 0.95): number {
  const varVal = calcVarHistorical(returns, confidence);
  // varVal is the (positive) loss threshold. If the window has no losses at this
  // confidence (varVal <= 0), CVaR is not meaningful — fall back to the VaR value
  // instead of averaging an almost-empty / inverted tail.
  if (varVal <= 0) return varVal;
  const tail = returns.filter((r) => r <= -varVal);
  if (tail.length === 0) return varVal;
  return -mean(tail);
}

export function calcMaxDrawdown(returns: number[]): number {
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

/**
 * Beta of `portfolioReturns` vs `benchmarkReturns`.
 * IMPORTANT: both arrays must be aligned on the same trading dates (same length,
 * same day at each index). Use alignReturnsByDate first.
 */
export function calcBeta(portfolioReturns: number[], benchmarkReturns: number[]): number {
  const n = Math.min(portfolioReturns.length, benchmarkReturns.length);
  if (n < 2) return 0;
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

export function calcVolatility(returns: number[]): number {
  return std(returns) * SQRT_TRADING_DAYS;
}

export function calcCalmar(returns: number[]): number {
  const annualReturn = mean(returns) * TRADING_DAYS_YEAR;
  const maxDD = Math.abs(calcMaxDrawdown(returns));
  if (maxDD === 0) return 0;
  return annualReturn / maxDD;
}

// Normal inverse CDF approximation (Beasley-Springer-Moro)
export function normInv(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number, r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
}

export interface DatedReturns {
  dates: string[];
  returns: number[];
}

/**
 * Align several daily-return series onto their common trading dates.
 *
 * Returns the sorted intersection of dates present in ALL given tickers, plus,
 * per ticker, the returns on exactly those dates (same length, same order). This
 * is what makes downstream cross-series metrics (covariance, beta, tracking
 * error) correct when holdings trade on different calendars.
 */
export function alignReturnsByDate(
  seriesByTicker: { [ticker: string]: DatedReturns },
  tickers: string[],
): { dates: string[]; returnsByTicker: { [ticker: string]: number[] } } {
  const present = tickers.filter((t) => seriesByTicker[t]?.dates?.length);
  if (present.length === 0) return { dates: [], returnsByTicker: {} };

  // date -> return map per ticker
  const maps: { [ticker: string]: Map<string, number> } = {};
  for (const t of present) {
    const { dates, returns } = seriesByTicker[t];
    const m = new Map<string, number>();
    for (let i = 0; i < dates.length && i < returns.length; i++) m.set(dates[i], returns[i]);
    maps[t] = m;
  }

  // intersection of dates across all present tickers
  let common = Array.from(maps[present[0]].keys());
  for (let i = 1; i < present.length; i++) {
    const m = maps[present[i]];
    common = common.filter((d) => m.has(d));
  }
  common.sort();

  const returnsByTicker: { [ticker: string]: number[] } = {};
  for (const t of present) {
    returnsByTicker[t] = common.map((d) => maps[t].get(d) as number);
  }
  return { dates: common, returnsByTicker };
}
