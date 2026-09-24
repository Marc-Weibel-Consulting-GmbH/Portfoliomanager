export type AlternativeDetailPriceSeries = {
  dates: string[];
  prices: number[];
};

export type AlternativeDetailChartPoint = {
  date: string;
  value: number;
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

/** Returns a percentage only when both observed endpoints are valid. */
export function calculateAlternativePeriodReturn(points: AlternativeDetailChartPoint[]): number | null {
  if (points.length < 2) return null;
  const first = points[0].value;
  const last = points[points.length - 1].value;
  if (!(first > 0) || !Number.isFinite(last)) return null;
  return ((last - first) / first) * 100;
}
