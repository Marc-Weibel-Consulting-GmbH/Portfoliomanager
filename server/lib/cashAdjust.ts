/**
 * Cash-drag adjustment for weighted price-index returns.
 *
 * The weighted return series (computeWeightedReturnSeries) and the multi-period
 * numbers are computed over the STOCK weights only (which sum to 100%). Cash is
 * held separately as an absolute amount (portfolio.cashBalance). To express the
 * return of the TOTAL portfolio — including uninvested cash earning 0% — we scale
 * the stocks return by the current stock fraction:
 *
 *   returnInclCash = returnStocks * stocksValue / (stocksValue + cash)
 *
 * This uses the current cash weight as a constant over the period, consistent with
 * the "current weights held throughout" assumption of the weighted-index model.
 */
export interface CashDragResult {
  /** Total-portfolio return in percent (cash assumed 0%). */
  inclCashPct: number;
  /** Current cash fraction of the total portfolio, in [0, 1]. */
  cashWeight: number;
}

export function applyCashDrag(
  stockReturnPct: number,
  stocksValue: number,
  cashBalance: number,
): CashDragResult {
  const cash = cashBalance > 0 ? cashBalance : 0;
  const total = (stocksValue > 0 ? stocksValue : 0) + cash;
  if (!(total > 0)) return { inclCashPct: stockReturnPct, cashWeight: 0 };
  const cashWeight = Math.min(1, cash / total);
  return { inclCashPct: stockReturnPct * (1 - cashWeight), cashWeight };
}
