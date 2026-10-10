export type PricePoint = { date: string; close: number };

export type MomentumFeatures = {
  asOfDate: string;
  coverageDays: number;
  return6mPct: number;
  return12mPct: number;
  compositeMomentumPct: number;
};

export type MomentumTrendState = "intakt" | "konsolidierung" | "erholung_beobachten" | "ueberhitzt" | "trendbruch";

export type MomentumTrend = {
  state: MomentumTrendState;
  distanceToSma200Pct: number | null;
  sma200SlopePct: number | null;
  reason: string;
};

export type MomentumCrashRisk = {
  active: boolean;
  benchmarkDrawdownPct: number | null;
  benchmarkVolatility20dPct: number | null;
  benchmarkRebound20dPct: number | null;
  reason: string | null;
};

const SIX_MONTH_TRADING_DAYS = 126;
const TWELVE_MONTH_TRADING_DAYS = 252;
const SMA_DAYS = 200;
const OVERHEAT_DISTANCE_PCT = 30;
const HIGH_VOLATILITY_20D_PCT = 25;
const MATERIAL_DRAWDOWN_PCT = -12;
const STRONG_REBOUND_20D_PCT = 8;

function validRows(rows: PricePoint[]): PricePoint[] {
  const byDate = new Map<string, PricePoint>();
  for (const row of rows) {
    const date = String(row.date ?? "").slice(0, 10);
    const close = Number(row.close);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(close) && close > 0) {
      byDate.set(date, { date, close });
    }
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function pctChange(start: number, end: number): number | null {
  if (!(Number.isFinite(start) && Number.isFinite(end)) || start <= 0) return null;
  return ((end / start) - 1) * 100;
}

function average(values: number[]): number | null {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = average(values);
  if (mean === null) return null;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

/**
 * Six- and twelve-month pure price returns. This function only accepts a single
 * already selected, split-adjusted direct market line; it never joins feeds and
 * never treats cash dividends as price momentum.
 */
export function calculateMomentumFeatures(rows: PricePoint[]): MomentumFeatures | null {
  const series = validRows(rows);
  if (series.length < TWELVE_MONTH_TRADING_DAYS + 1) return null;
  const end = series.at(-1)!;
  const sixMonthStart = series.at(-(SIX_MONTH_TRADING_DAYS + 1));
  const twelveMonthStart = series.at(-(TWELVE_MONTH_TRADING_DAYS + 1));
  if (!sixMonthStart || !twelveMonthStart) return null;

  const return6mPct = pctChange(sixMonthStart.close, end.close);
  const return12mPct = pctChange(twelveMonthStart.close, end.close);
  if (return6mPct === null || return12mPct === null) return null;

  return {
    asOfDate: end.date,
    coverageDays: series.length,
    return6mPct,
    return12mPct,
    compositeMomentumPct: (return6mPct + return12mPct) / 2,
  };
}

/** Percentile convention: ties share the middle rank. Rounded only for presentation/storage. */
export function momentumPercentile(value: number, values: number[]): number {
  const universe = values.filter(Number.isFinite);
  if (!universe.length || !Number.isFinite(value)) return 0;
  const below = universe.filter((candidate) => candidate < value).length;
  const equal = universe.filter((candidate) => candidate === value).length;
  return Math.round(((below + equal / 2) / universe.length) * 100);
}

export function median(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/**
 * Descriptive trend classification. It deliberately has no BUY/SELL mapping.
 * The monthly proxy is the 200-day close average; all price inputs remain on
 * the explicitly selected split-adjusted price-return basis.
 */
export function classifyMomentumTrend(input: {
  prices: PricePoint[];
  relative6mPct: number | null;
  relative12mPct: number | null;
}): MomentumTrend {
  const series = validRows(input.prices);
  if (series.length < SMA_DAYS) {
    return { state: "erholung_beobachten", distanceToSma200Pct: null, sma200SlopePct: null, reason: "Weniger als 200 qualifizierte Handelstage." };
  }
  const closes = series.map((row) => row.close);
  const current = closes.at(-1)!;
  const sma200 = average(closes.slice(-SMA_DAYS));
  const previousSma200 = series.length >= SMA_DAYS + 21
    ? average(closes.slice(-(SMA_DAYS + 21), -21))
    : null;
  const distanceToSma200Pct = sma200 ? pctChange(sma200, current) : null;
  const sma200SlopePct = sma200 && previousSma200 ? pctChange(previousSma200, sma200) : null;
  const relativeStrengthFalling = (input.relative6mPct ?? 0) < 0 && (input.relative12mPct ?? 0) < 0;
  const relativeStrengthStable = (input.relative6mPct ?? 0) >= -2;

  if (distanceToSma200Pct !== null && distanceToSma200Pct >= OVERHEAT_DISTANCE_PCT && (input.relative12mPct ?? 0) > 0) {
    return { state: "ueberhitzt", distanceToSma200Pct, sma200SlopePct, reason: `Kurs ${distanceToSma200Pct.toFixed(1)} % über dem 200-Tage-Trendfilter.` };
  }
  if ((distanceToSma200Pct ?? 0) < 0 && ((sma200SlopePct ?? 0) <= 0 || relativeStrengthFalling)) {
    return { state: "trendbruch", distanceToSma200Pct, sma200SlopePct, reason: "Kurs unter dem langfristigen Trendfilter bei schwacher relativer Stärke." };
  }
  if ((distanceToSma200Pct ?? 0) >= 0 && (sma200SlopePct ?? 0) > 0 && relativeStrengthStable) {
    return { state: "intakt", distanceToSma200Pct, sma200SlopePct, reason: "Kurs über steigendem langfristigem Trendfilter; relative Stärke nicht fallend." };
  }
  if ((distanceToSma200Pct ?? 0) >= -8 && (sma200SlopePct ?? 0) > 0 && relativeStrengthStable) {
    return { state: "konsolidierung", distanceToSma200Pct, sma200SlopePct, reason: "Rücksetzer beziehungsweise Seitwärtsphase bei weiter steigendem Trendfilter." };
  }
  return { state: "erholung_beobachten", distanceToSma200Pct, sma200SlopePct, reason: "Trendwechsel ist noch nicht über Trendfilter und relative Stärke bestätigt." };
}

/**
 * Daniel/Moskowitz-style contextual warning, not an execution signal: a prior
 * market drawdown, high realised volatility, a sharp rebound and fading leader
 * relative strength must coincide before the gate turns on.
 */
export function assessMomentumCrashRisk(input: {
  benchmarkPrices: PricePoint[];
  assetReturn12mPct: number;
  relative6mPct: number | null;
}): MomentumCrashRisk {
  const series = validRows(input.benchmarkPrices);
  if (series.length < SMA_DAYS + 21 || !Number.isFinite(input.assetReturn12mPct)) {
    return { active: false, benchmarkDrawdownPct: null, benchmarkVolatility20dPct: null, benchmarkRebound20dPct: null, reason: null };
  }
  const closes = series.map((row) => row.close);
  const current = closes.at(-1)!;
  const peak = Math.max(...closes.slice(-SMA_DAYS));
  const benchmarkDrawdownPct = pctChange(peak, current);
  const benchmarkRebound20dPct = pctChange(closes.at(-21)!, current);
  const returns = closes.slice(-21).map((close, index, window) => index === 0 ? null : pctChange(window[index - 1]!, close) / 100)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const dailyVolatility = standardDeviation(returns);
  const benchmarkVolatility20dPct = dailyVolatility === null ? null : dailyVolatility * Math.sqrt(252) * 100;
  const priorWinner = input.assetReturn12mPct > 0;
  const relativeStrengthFading = (input.relative6mPct ?? 0) < 0;
  const active = (benchmarkDrawdownPct ?? 0) <= MATERIAL_DRAWDOWN_PCT
    && (benchmarkVolatility20dPct ?? 0) >= HIGH_VOLATILITY_20D_PCT
    && (benchmarkRebound20dPct ?? 0) >= STRONG_REBOUND_20D_PCT
    && priorWinner
    && relativeStrengthFading;

  return {
    active,
    benchmarkDrawdownPct,
    benchmarkVolatility20dPct,
    benchmarkRebound20dPct,
    reason: active
      ? `Risiko-Gate: Markt-Drawdown ${benchmarkDrawdownPct!.toFixed(1)} %, 20T-Volatilität ${benchmarkVolatility20dPct!.toFixed(1)} %, 20T-Rebound ${benchmarkRebound20dPct!.toFixed(1)} % und nachlassende relative Stärke eines bisherigen Gewinners.`
      : null,
  };
}

export const MOMENTUM_MONITOR_METHOD = {
  version: "v1.0.0",
  priceBasis: "split_adjusted_price_return_without_cash_dividends",
  returnWindows: { sixMonthsTradingDays: SIX_MONTH_TRADING_DAYS, twelveMonthsTradingDays: TWELVE_MONTH_TRADING_DAYS },
  trendFilter: { days: SMA_DAYS, overheatDistancePct: OVERHEAT_DISTANCE_PCT },
  riskGate: { materialDrawdownPct: MATERIAL_DRAWDOWN_PCT, volatility20dPct: HIGH_VOLATILITY_20D_PCT, rebound20dPct: STRONG_REBOUND_20D_PCT },
} as const;
