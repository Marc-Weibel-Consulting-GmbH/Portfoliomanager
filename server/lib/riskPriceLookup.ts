export type RiskPriceMap = Map<string, Map<string, number>>;

export type RiskPriceLookup = (ticker: string, date: string) => number | null;

type PreparedTickerPrices = {
  dates: string[];
  prices: number[];
};

/**
 * Builds a deterministic, binary-searchable view of historical close prices.
 *
 * The risk series needs one last known price for every constituent and every
 * portfolio calendar date. Re-sorting all source dates inside that nested loop
 * turns a five-year calculation into millions of repeated comparisons. This
 * helper keeps the existing semantics exactly: the most recent observed row on
 * or before a date wins; a stale, invalid, or missing winning row produces a
 * data gap rather than a guessed CHF valuation.
 */
export function createRiskPriceLookup(
  pricesByTicker: RiskPriceMap,
  maxStalenessDays: number,
): RiskPriceLookup {
  const prepared = new Map<string, PreparedTickerPrices>();

  for (const [ticker, source] of pricesByTicker) {
    const rows = Array.from(source.entries()).sort(([left], [right]) => left.localeCompare(right));
    prepared.set(ticker, {
      dates: rows.map(([date]) => date),
      prices: rows.map(([, price]) => price),
    });
  }

  return (ticker: string, targetDate: string): number | null => {
    const series = prepared.get(ticker);
    if (!series || series.dates.length === 0) return null;

    // Upper-bound binary search: first entry after targetDate, then step back.
    let low = 0;
    let high = series.dates.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (series.dates[middle] <= targetDate) low = middle + 1;
      else high = middle;
    }
    const index = low - 1;
    if (index < 0) return null;

    const observedDate = series.dates[index];
    const stalenessDays = Math.round(
      (Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${observedDate}T00:00:00Z`)) / 86_400_000,
    );
    if (stalenessDays > maxStalenessDays) return null;

    const price = series.prices[index];
    return Number.isFinite(price) && price > 0 ? price : null;
  };
}
