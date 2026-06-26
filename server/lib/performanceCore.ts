/**
 * Shared building blocks for the weighted price-index performance model.
 *
 * Both the multi-period numbers (getMultiPeriodPerformanceV2) and the chart
 * (getHistoricalPerformance) build the same thing: per-stock CHF price maps fed
 * into computeWeightedReturnSeries, plus a cash weight for the optional total-
 * portfolio figure. These helpers centralize that wiring so the two endpoints
 * cannot drift apart.
 */
import { convertPriceMapToChf } from "./fxPriceConvert";

export type FxRateLookup = (date: string, pair: string) => Promise<number>;

/**
 * Convert a local-currency price map to CHF using per-date FX rates.
 * CHF inputs are returned unchanged. Rates are fetched via the injected lookup
 * (e.g. fxHelper.getFxRate) so this stays testable.
 */
export async function toChfPriceMap(
  priceMap: Record<string, number>,
  currency: string,
  getRate: FxRateLookup,
): Promise<Record<string, number>> {
  if (!currency || currency === "CHF") return priceMap;
  const pair = `${currency}CHF`;
  const ratesByDate: Record<string, number> = {};
  for (const d of Object.keys(priceMap)) ratesByDate[d] = await getRate(d, pair);
  return convertPriceMapToChf(priceMap, ratesByDate);
}

/** Latest (most recent date) value in a price map, or 0 if empty. */
export function latestPrice(priceMap: Record<string, number>): number {
  const dates = Object.keys(priceMap).sort((a, b) => a.localeCompare(b));
  return dates.length ? priceMap[dates[dates.length - 1]] : 0;
}

export interface StockValueItem {
  /** CHF price map for the stock. */
  chfPrices: Record<string, number>;
  /** Raw portfolio weight in percent (0-100). */
  rawWeight: number;
  /** Stored share count, if known. */
  shares?: number;
}

/**
 * Current CHF value of the stock holdings. Uses stored shares when available,
 * otherwise derives them from the initial investment amount and weight
 * (investmentAmount * weight% / latestPriceCHF) — mirroring portfolios.list.
 */
export function deriveStocksValueChf(items: StockValueItem[], investmentAmount: number): number {
  let total = 0;
  for (const it of items) {
    const latest = latestPrice(it.chfPrices);
    let shares = it.shares && it.shares > 0 ? it.shares : 0;
    if (shares === 0 && investmentAmount > 0 && it.rawWeight > 0 && latest > 0) {
      shares = (investmentAmount * (it.rawWeight / 100)) / latest;
    }
    total += shares * latest;
  }
  return total;
}
