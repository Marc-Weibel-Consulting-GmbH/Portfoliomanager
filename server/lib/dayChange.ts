/**
 * Day change (R-29 / CT-13) — symmetric per-ticker day change for the
 * dashboard, extracted from dashboardRouter.getAggregatedMetrics.
 *
 * Old behavior (known wrong, documented here because a behavior-neutral
 * extraction of the previous inline logic was impractical — it was spread
 * over two async DB-bound helpers): "today" was valued with
 * `stocks.currentPrice` (18:00 cron snapshot), "yesterday" with the
 * `historicalPrices` close (nearest-<= fallback), and the skip logic was
 * asymmetric — a ticker with a currentPrice but no price history counted
 * fully today and not at all yesterday, so its ENTIRE position value showed
 * up as day gain. FX for today vs. yesterday was also mixed inconsistently.
 *
 * New behavior: per ticker, day change = shares × (close(last trading day) −
 * close(previous trading day)), both closes from `historicalPrices`. Only
 * tickers that have BOTH closes contribute — to the change AND to the base
 * value (symmetric skipping). One FX rate per currency is applied to both
 * sides, so the result is pure price movement.
 */

export interface DayChangeHolding {
  ticker: string;
  shares: number;
  currency: string;
}

export interface DayChangePriceRow {
  /** YYYY-MM-DD */
  date: string;
  /** Close in the ticker's local currency */
  close: number;
}

export interface DayChangeResult {
  /** Absolute day change in CHF (only tickers with both closes). */
  dayChangeCHF: number;
  /** Value of the contributing positions at the previous trading day's closes. */
  baseValueCHF: number;
  /** dayChangeCHF relative to baseValueCHF, in %. */
  dayChangePercent: number;
}

/**
 * Compute the aggregated day change from historical closes only.
 *
 * @param holdings positions (duplicate tickers allowed; they add up)
 * @param priceRowsByTicker recent `historicalPrices` rows per ticker
 *   (order irrelevant; the two most recent distinct dates are used)
 * @param fxRateByCurrency currency -> CHF rate for 1 unit (CHF is implied 1)
 */
export function computeDayChange(
  holdings: DayChangeHolding[],
  priceRowsByTicker: Map<string, DayChangePriceRow[]>,
  fxRateByCurrency: Map<string, number>,
): DayChangeResult {
  let dayChangeCHF = 0;
  let baseValueCHF = 0;

  for (const holding of holdings) {
    if (!holding.ticker || !(holding.shares > 0)) continue;

    const rows = priceRowsByTicker.get(holding.ticker);
    if (!rows || rows.length === 0) continue;

    // Most recent close and the close of the trading day before it
    const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
    const latest = sorted[0];
    const previous = sorted.find(r => r.date < latest.date);

    // Symmetric skip (R-29): a ticker without BOTH closes contributes nothing —
    // neither to the change nor to the base value.
    if (!previous) continue;
    if (!(latest.close > 0) || !(previous.close > 0)) continue;

    const fxRate = holding.currency === 'CHF'
      ? 1
      : fxRateByCurrency.get(holding.currency);
    if (!fxRate || !(fxRate > 0)) continue;

    dayChangeCHF += holding.shares * (latest.close - previous.close) * fxRate;
    baseValueCHF += holding.shares * previous.close * fxRate;
  }

  return {
    dayChangeCHF,
    baseValueCHF,
    dayChangePercent: baseValueCHF > 0 ? (dayChangeCHF / baseValueCHF) * 100 : 0,
  };
}
