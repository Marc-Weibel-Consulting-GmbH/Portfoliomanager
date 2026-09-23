const TRADING_DAYS_PER_YEAR = 252;
const FIVE_YEARS_MIN_OBSERVATIONS = 1_000;
const HISTORY_GRACE_DAYS = 10;

export type HistoricalClosePoint = {
  date: string;
  close: number | string | null;
  adjustedClose?: number | string | null;
};

export type FiveYearVolatilityResult =
  | {
    status: "available";
    annualizedVolatilityPct: number;
    observations: number;
  }
  | {
    status: "insufficient_history" | "insufficient_observations";
    annualizedVolatilityPct: null;
    observations: number;
  };

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function subtractCalendarYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setUTCFullYear(result.getUTCFullYear() - years);
  return result;
}

/**
 * Calculates annualized volatility from daily *adjusted* prices over a complete
 * five-calendar-year window. It deliberately refuses to extrapolate a partial
 * series: a missing full history is returned as a data gap rather than a
 * misleading shorter-period volatility.
 */
export function calculateFiveYearAnnualizedVolatility(
  points: HistoricalClosePoint[],
  asOf: Date = new Date(),
): FiveYearVolatilityResult {
  const asOfKey = isoDate(asOf);
  const cutoff = subtractCalendarYears(asOf, 5);
  const cutoffKey = isoDate(cutoff);
  const coverageDeadline = new Date(cutoff.getTime() + HISTORY_GRACE_DAYS * 86_400_000);
  const coverageDeadlineKey = isoDate(coverageDeadline);

  const priceByDate = new Map<string, number>();
  for (const point of points) {
    const date = point.date.slice(0, 10);
    if (date > asOfKey) continue;
    const adjusted = Number(point.adjustedClose);
    const close = Number(point.close);
    const price = Number.isFinite(adjusted) && adjusted > 0
      ? adjusted
      : Number.isFinite(close) && close > 0
        ? close
        : null;
    if (price !== null) priceByDate.set(date, price);
  }

  const sorted = Array.from(priceByDate.entries())
    .map(([date, price]) => ({ date, price }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const fiveYearWindow = sorted.filter((point) => point.date >= cutoffKey);
  const observations = Math.max(0, fiveYearWindow.length - 1);
  const firstCoveragePoint = sorted.find((point) => point.date >= cutoffKey)
    ?? sorted.find((point) => point.date >= isoDate(new Date(cutoff.getTime() - HISTORY_GRACE_DAYS * 86_400_000)));
  const latestCoveragePoint = sorted.at(-1);
  const recentDeadline = isoDate(new Date(asOf.getTime() - HISTORY_GRACE_DAYS * 86_400_000));

  if (
    !firstCoveragePoint
    || firstCoveragePoint.date > coverageDeadlineKey
    || !latestCoveragePoint
    || latestCoveragePoint.date < recentDeadline
  ) {
    return { status: "insufficient_history", annualizedVolatilityPct: null, observations };
  }

  if (observations < FIVE_YEARS_MIN_OBSERVATIONS) {
    return { status: "insufficient_observations", annualizedVolatilityPct: null, observations };
  }

  const returns: number[] = [];
  for (let index = 1; index < fiveYearWindow.length; index += 1) {
    const previous = fiveYearWindow[index - 1].price;
    const current = fiveYearWindow[index].price;
    if (previous > 0 && current > 0) {
      returns.push((current - previous) / previous);
    }
  }

  if (returns.length < FIVE_YEARS_MIN_OBSERVATIONS) {
    return { status: "insufficient_observations", annualizedVolatilityPct: null, observations: returns.length };
  }

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  const annualizedVolatilityPct = Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;

  return {
    status: "available",
    annualizedVolatilityPct,
    observations: returns.length,
  };
}
