/**
 * Convert a per-date price map into CHF using per-date FX rates.
 *
 * Pure & unit-testable. The caller resolves the actual rates (e.g. via
 * fxHelper.getFxRate, which already handles nearest-previous lookups) and passes
 * them in as a date->rate map. As a safety net this helper also forward-fills
 * rates for any price date missing an exact rate, so a sparse rate map still
 * produces a fully-converted price series.
 *
 * Reporting currency is CHF: priceCHF(date) = price(date) * rate(date), where
 * rate is <currency>CHF. For CHF inputs the prices are returned unchanged.
 */
export function convertPriceMapToChf(
  prices: Record<string, number>,
  ratesByDate: Record<string, number>,
): Record<string, number> {
  const rateDates = Object.keys(ratesByDate)
    .filter((d) => ratesByDate[d] > 0)
    .sort((a, b) => a.localeCompare(b));

  if (rateDates.length === 0) return { ...prices };

  const out: Record<string, number> = {};
  for (const date of Object.keys(prices)) {
    let rate = ratesByDate[date];
    if (!(rate > 0)) {
      // Forward-fill: most recent rate at or before `date`, else earliest rate.
      let filled = 0;
      for (const rd of rateDates) {
        if (rd <= date) filled = ratesByDate[rd];
        else break;
      }
      rate = filled > 0 ? filled : ratesByDate[rateDates[0]];
    }
    out[date] = prices[date] * rate;
  }
  return out;
}
