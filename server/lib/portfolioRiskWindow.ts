import { buildPortfolioDrawdownAnalysis } from "./portfolioDrawdown";

export const RISK_HISTORY_TARGET_YEARS = 5;
export const MIN_QUALIFIED_RISK_DAYS = 1_000;
export const MAX_RISK_WINDOW_START_LAG_DAYS = 7;
export const MAX_RISK_WINDOW_END_LAG_DAYS = 7;
export const STRESS_BENCHMARK_DRAWDOWN_THRESHOLD_PCT = -15;

export type RiskWindowStatus =
  | "five_year_with_stress"
  | "five_year_without_stress"
  | "insufficient_history"
  | "incompatible_history";

export type RiskCoverageItem = {
  key: string;
  kind: "price" | "fx";
  supportsWindowStart: boolean;
  supportsWindowEnd: boolean;
};

export type RiskBenchmarkPoint = {
  date: string;
  close: number;
};

export type StressEvidence = {
  qualified: boolean;
  benchmark: string;
  requiredDrawdownPct: number;
  observedDrawdownPct: number | null;
  peakDate: string | null;
  troughDate: string | null;
};

export type PortfolioRiskWindowAssessment = {
  status: RiskWindowStatus;
  canPublishMaxDrawdown: boolean;
  targetYears: number;
  targetStart: string;
  asOfDate: string;
  historyStart: string | null;
  historyEnd: string | null;
  historyObservationCount: number;
  coverageIssues: RiskCoverageItem[];
  /** Benchmarkpunkte nach der ausschliesslich analytischen Ausreisser-Sperre. */
  benchmarkPoints: RiskBenchmarkPoint[];
  /** Anzahl verworfener einzelner Massstabsbrüche, nie stillschweigend überschrieben. */
  benchmarkOutlierCount: number;
  stressEvidence: StressEvidence;
};

export type PortfolioRiskWindowInput = {
  asOfDate: string;
  qualifiedDates: string[];
  coverage: RiskCoverageItem[];
  benchmark: {
    key: string;
    points: RiskBenchmarkPoint[];
  };
};

function asUtcDate(date: string): Date {
  return new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
}

function toDateText(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const value = asUtcDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return toDateText(value);
}

function subtractYears(date: string, years: number): string {
  const value = asUtcDate(date);
  value.setUTCFullYear(value.getUTCFullYear() - years);
  return toDateText(value);
}

function normalizedDates(dates: string[]): string[] {
  return [...new Set(dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
}

/**
 * Drops only isolated scale breaks such as a legacy index level (11'500) on a
 * Swiss market holiday between two SPI-ETF closes (~124). It does not repair,
 * fill or mutate source rows. A genuine multi-day market move cannot meet the
 * recovery condition because its neighbours are not back on the same scale.
 */
function excludeIsolatedBenchmarkScaleBreaks(points: RiskBenchmarkPoint[]): RiskBenchmarkPoint[] {
  return points.filter((point, index, ordered) => {
    if (index === 0 || index === ordered.length - 1) return true;
    const previous = ordered[index - 1];
    const next = ordered[index + 1];
    if (!previous || !next || previous.close <= 0 || point.close <= 0 || next.close <= 0) return true;
    const previousToCurrent = Math.abs(Math.log(point.close / previous.close));
    const currentToNext = Math.abs(Math.log(next.close / point.close));
    const surroundingMove = Math.abs(Math.log(next.close / previous.close));
    return !(previousToCurrent > Math.log(3) && currentToNext > Math.log(3) && surroundingMove < Math.log(1.5));
  });
}

/**
 * Assesses whether a risk series may be described as a five-year historical
 * allocation proxy. It never treats a portfolio created later as a real prior
 * portfolio history. A max drawdown is publishable only with full start/end
 * coverage, a minimum number of qualified observations and verified benchmark
 * stress of at least 15% inside the same five-year window.
 */
export function assessPortfolioRiskWindow(input: PortfolioRiskWindowInput): PortfolioRiskWindowAssessment {
  const asOfDate = input.asOfDate.slice(0, 10);
  const targetStart = subtractYears(asOfDate, RISK_HISTORY_TARGET_YEARS);
  const dates = normalizedDates(input.qualifiedDates);
  const historyStart = dates[0] ?? null;
  const historyEnd = dates.at(-1) ?? null;
  const coverageIssues = input.coverage.filter((item) => !item.supportsWindowStart || !item.supportsWindowEnd);
  const hasFxCoverageIssue = coverageIssues.some((item) => item.kind === "fx");
  const hasPriceCoverageIssue = coverageIssues.some((item) => item.kind === "price");
  const hasFiveCalendarYears = Boolean(
    historyStart
    && historyEnd
    && historyStart <= addDays(targetStart, MAX_RISK_WINDOW_START_LAG_DAYS)
    && historyEnd >= addDays(asOfDate, -MAX_RISK_WINDOW_END_LAG_DAYS),
  );
  const hasMinimumObservations = dates.length >= MIN_QUALIFIED_RISK_DAYS;

  const rawBenchmarkPoints = input.benchmark.points
    .filter((point) => point.date >= targetStart && point.date <= asOfDate && Number.isFinite(point.close) && point.close > 0)
    .sort((left, right) => left.date.localeCompare(right.date));
  const benchmarkPoints = excludeIsolatedBenchmarkScaleBreaks(rawBenchmarkPoints);
  const benchmarkDrawdown = buildPortfolioDrawdownAnalysis(benchmarkPoints.map((point) => ({
    date: point.date,
    portfolioValueCHF: point.close,
  })));
  const observedDrawdownPct = benchmarkDrawdown.maxDrawdownPct;
  const stressEvidence: StressEvidence = {
    qualified: observedDrawdownPct !== null && observedDrawdownPct <= STRESS_BENCHMARK_DRAWDOWN_THRESHOLD_PCT,
    benchmark: input.benchmark.key,
    requiredDrawdownPct: STRESS_BENCHMARK_DRAWDOWN_THRESHOLD_PCT,
    observedDrawdownPct,
    peakDate: benchmarkDrawdown.peakDate,
    troughDate: benchmarkDrawdown.troughDate,
  };

  let status: RiskWindowStatus;
  if (hasFxCoverageIssue) {
    status = "incompatible_history";
  } else if (hasPriceCoverageIssue || !hasFiveCalendarYears || !hasMinimumObservations) {
    status = "insufficient_history";
  } else if (benchmarkPoints.length < 2) {
    status = "incompatible_history";
  } else if (!stressEvidence.qualified) {
    status = "five_year_without_stress";
  } else {
    status = "five_year_with_stress";
  }

  return {
    status,
    canPublishMaxDrawdown: status === "five_year_with_stress",
    targetYears: RISK_HISTORY_TARGET_YEARS,
    targetStart,
    asOfDate,
    historyStart,
    historyEnd,
    historyObservationCount: dates.length,
    coverageIssues,
    benchmarkPoints,
    benchmarkOutlierCount: rawBenchmarkPoints.length - benchmarkPoints.length,
    stressEvidence,
  };
}
