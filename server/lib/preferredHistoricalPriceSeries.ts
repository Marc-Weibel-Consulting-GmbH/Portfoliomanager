export type HistoricalPriceSourceRow = {
  ticker: string;
  date: string;
  close: number | string | null;
  adjustedClose: number | string | null;
};

export type HistoricalPricePoint = {
  date: string;
  close: number | string | null;
  adjustedClose: number | string | null;
};

function positive(value: number | string | null | undefined): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function sourceKeysForTicker(ticker: string): string[] {
  const normalized = ticker.toUpperCase();
  return normalized.endsWith(".US")
    ? [normalized, normalized.slice(0, -3)]
    : [normalized, `${normalized}.US`];
}

/**
 * Picks exactly one historical source series for a requested ticker. Legacy
 * bare/.US aliases are therefore never interleaved day by day. The candidate
 * with the latest valid observation wins; then adjusted-close coverage, row
 * count and the exact ticker break ties deterministically.
 */
export function selectPreferredHistoricalPriceSeries(
  ticker: string,
  rows: HistoricalPriceSourceRow[],
): HistoricalPricePoint[] {
  const sourceKeys = sourceKeysForTicker(ticker);
  const candidateRows = new Map<string, HistoricalPricePoint[]>();

  for (const row of rows) {
    const source = String(row.ticker).toUpperCase();
    if (!sourceKeys.includes(source)) continue;
    const close = positive(row.close);
    if (close === null) continue;
    const series = candidateRows.get(source) ?? [];
    series.push({ date: String(row.date).slice(0, 10), close, adjustedClose: row.adjustedClose });
    candidateRows.set(source, series);
  }

  const selectedSource = Array.from(candidateRows.entries())
    .map(([source, series]) => {
      const deduplicatedByDate = new Map<string, HistoricalPricePoint>();
      for (const point of series) deduplicatedByDate.set(point.date, point);
      const deduplicated = Array.from(deduplicatedByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
      return {
        source,
        series: deduplicated,
        latestDate: deduplicated.at(-1)?.date ?? "",
        adjustedCount: deduplicated.filter((point) => positive(point.adjustedClose) !== null).length,
        exactTicker: source === ticker.toUpperCase(),
      };
    })
    .sort((left, right) =>
      right.latestDate.localeCompare(left.latestDate)
      || right.adjustedCount - left.adjustedCount
      || right.series.length - left.series.length
      || Number(right.exactTicker) - Number(left.exactTicker)
      || left.source.localeCompare(right.source),
    )
    .at(0);

  return selectedSource?.series ?? [];
}
