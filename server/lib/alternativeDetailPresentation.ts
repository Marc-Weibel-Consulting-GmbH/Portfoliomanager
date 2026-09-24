export type AlternativeDetailPriceSeries = {
  dates: string[];
  prices: number[];
};

export type AlternativeDetailChartPoint = {
  date: string;
  value: number;
};

export type StoredAlternativeDetailPrice = {
  date: string;
  adjustedClose: string | number | null;
  close: string | number | null;
};

/**
 * Converts source-backed adjusted-close series into safe chart data. Missing or
 * invalid values remain omitted; no chart values are generated or interpolated.
 */
export function toAlternativeDetailChartPoints(series: AlternativeDetailPriceSeries): AlternativeDetailChartPoint[] {
  const points: AlternativeDetailChartPoint[] = [];
  for (let index = 0; index < series.dates.length; index += 1) {
    const date = series.dates[index];
    const value = series.prices[index];
    if (!date || !Number.isFinite(value) || value <= 0) continue;
    points.push({ date, value });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Builds a one-year chart strictly from the additive `historical_prices` cache.
 * The source's split-adjusted close has precedence; a valid raw close is an
 * explicit fallback only when adjusted close is unavailable. No prices are
 * fabricated, interpolated, refreshed, or written during detail inspection.
 */
export function toAlternativeDetailChartFromStoredRows(
  rows: StoredAlternativeDetailPrice[],
): AlternativeDetailChartPoint[] {
  return rows
    .map((row) => ({
      date: row.date,
      value: Number(row.adjustedClose ?? row.close),
    }))
    .filter((row) => Boolean(row.date) && Number.isFinite(row.value) && row.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Returns a percentage only when both observed endpoints are valid. */
export function calculateAlternativePeriodReturn(points: AlternativeDetailChartPoint[]): number | null {
  if (points.length < 2) return null;
  const first = points[0].value;
  const last = points[points.length - 1].value;
  if (!(first > 0) || !Number.isFinite(last)) return null;
  return ((last - first) / first) * 100;
}
