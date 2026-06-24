/**
 * Weighted per-stock return series.
 *
 * This is the single source of truth for the "weighted price return" methodology
 * used both by the multi-period performance NUMBERS (getMultiPeriodPerformanceV2)
 * and by the performance CHART (getHistoricalPerformance). Keeping the chart on the
 * exact same formula guarantees that the chart's endpoint equals the displayed number
 * for every portfolio — including those with an extreme single-stock mover.
 *
 * Methodology (identical to getMultiPeriodPerformanceV2):
 *   - Weights are normalized over the supplied stocks (Σ weight = 1).
 *   - Per stock, startPrice = first price at or after `startDate`, else the earliest
 *     available price.
 *   - Per emitted date d, endPrice = the most recent price at or before d (forward-fill).
 *   - portfolioReturn(d) = Σ wᵢ · (endPriceᵢ(d) − startPriceᵢ) / startPriceᵢ · 100,
 *     renormalized over the weight actually used (stocks with valid prices).
 *   - Prices are in local currency (no FX conversion), matching the numbers.
 *   - No clamping, no daily-change smoothing — large legitimate moves are preserved.
 *
 * At the last date (today) endPrice == latest available price, so the series endpoint
 * equals the getMultiPeriodPerformanceV2 value for the same period.
 */

export interface WeightedReturnInput {
  ticker: string;
  /** Raw weight (normalized internally). */
  weight: number;
  /** date (YYYY-MM-DD) -> close price in local currency. */
  prices: Record<string, number>;
}

export interface WeightedReturnPoint {
  date: string;
  /** Portfolio return in percent relative to startDate. */
  portfolio: number;
}

interface PreparedStock {
  weight: number;
  startPrice: number;
  /** Sorted ascending price dates. */
  priceDates: string[];
  prices: Record<string, number>;
}

export function computeWeightedReturnSeries(
  inputs: WeightedReturnInput[],
  dates: string[],
  startDate: string,
): WeightedReturnPoint[] {
  // Normalize weights over all supplied stocks.
  const totalWeight = inputs.reduce((sum, s) => sum + (s.weight > 0 ? s.weight : 0), 0);

  const prepared: PreparedStock[] = [];
  for (const input of inputs) {
    if (!(input.weight > 0) || totalWeight <= 0) continue;

    const priceDates = Object.keys(input.prices)
      .filter((d) => input.prices[d] > 0)
      .sort();
    if (priceDates.length === 0) continue;

    // startPrice = first price at or after startDate, else earliest available.
    let startPrice = 0;
    for (const d of priceDates) {
      if (d >= startDate) {
        startPrice = input.prices[d];
        break;
      }
    }
    if (startPrice === 0) startPrice = input.prices[priceDates[0]];
    if (!(startPrice > 0)) continue;

    prepared.push({
      weight: input.weight / totalWeight,
      startPrice,
      priceDates,
      prices: input.prices,
    });
  }

  const sortedDates = [...dates].sort();

  return sortedDates.map((date) => {
    let weightedPerformance = 0;
    let usedWeight = 0;

    for (const stock of prepared) {
      // endPrice = most recent price at or before `date` (forward-fill).
      let endPrice = 0;
      for (const d of stock.priceDates) {
        if (d <= date) endPrice = stock.prices[d];
        else break;
      }
      if (!(endPrice > 0)) continue;

      const stockPerformance = ((endPrice - stock.startPrice) / stock.startPrice) * 100;
      weightedPerformance += stockPerformance * stock.weight;
      usedWeight += stock.weight;
    }

    const portfolio = usedWeight > 0 ? weightedPerformance / usedWeight : 0;
    return { date, portfolio };
  });
}
