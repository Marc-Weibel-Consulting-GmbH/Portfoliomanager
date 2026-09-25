import {
  selectFiveYearPriceVolatilitySeries,
  type PriceVolatilityBasis,
} from "./priceVolatilityBasis";

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
    status: "available_adjusted_total_return" | "available_raw_price";
    annualizedVolatilityPct: number;
    observations: number;
    basis: PriceVolatilityBasis;
    possibleSplitDate: null;
  }
  | {
    status: "insufficient_history" | "insufficient_observations" | "possible_unadjusted_split";
    annualizedVolatilityPct: null;
    observations: number;
    basis: null;
    possibleSplitDate: string | null;
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
 * Calculates annualized volatility over a complete five-calendar-year window.
 * The return stream has exactly one price basis: a complete EODHD adjusted-close
 * series (total return) or a complete raw-close series (price return) with no
 * split-like discontinuity. It never joins the two row by row.
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

  const priceByDate = new Map<string, HistoricalClosePoint>();
  for (const point of points) {
    const date = point.date.slice(0, 10);
    if (date > asOfKey) continue;
    const close = Number(point.close);
    if (!Number.isFinite(close) || close <= 0) continue;
    priceByDate.set(date, {
      date,
      close,
      adjustedClose: point.adjustedClose ?? null,
    });
  }

  const sorted = Array.from(priceByDate.entries())
    .map(([, point]) => point)
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
    return {
      status: "insufficient_history",
      annualizedVolatilityPct: null,
      observations,
      basis: null,
      possibleSplitDate: null,
    };
  }

  if (observations < FIVE_YEARS_MIN_OBSERVATIONS) {
    return {
      status: "insufficient_observations",
      annualizedVolatilityPct: null,
      observations,
      basis: null,
      possibleSplitDate: null,
    };
  }

  const selected = selectFiveYearPriceVolatilitySeries(fiveYearWindow, asOf, {
    minimumObservations: FIVE_YEARS_MIN_OBSERVATIONS,
  });
  if (selected.basis === null) {
    const unavailableStatus = selected.status === "possible_unadjusted_split"
      ? "possible_unadjusted_split" as const
      : "insufficient_observations" as const;
    return {
      status: unavailableStatus,
      annualizedVolatilityPct: null,
      observations: selected.observations,
      basis: null,
      possibleSplitDate: selected.possibleSplitDate,
    };
  }

  const returns: number[] = [];
  for (let index = 1; index < selected.prices.length; index += 1) {
    const previous = selected.prices[index - 1];
    const current = selected.prices[index];
    if (previous > 0 && current > 0) {
      returns.push((current - previous) / previous);
    }
  }

  if (returns.length < FIVE_YEARS_MIN_OBSERVATIONS) {
    return {
      status: "insufficient_observations",
      annualizedVolatilityPct: null,
      observations: returns.length,
      basis: null,
      possibleSplitDate: null,
    };
  }

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  const annualizedVolatilityPct = Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;
  const availableStatus = selected.basis === "adjusted_close_total_return"
    ? "available_adjusted_total_return" as const
    : "available_raw_price" as const;

  return {
    status: availableStatus,
    annualizedVolatilityPct,
    observations: returns.length,
    basis: selected.basis,
    possibleSplitDate: null,
  };
}
