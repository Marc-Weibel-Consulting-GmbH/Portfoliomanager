/**
 * Dashboard value/performance series — extracted from
 * dashboardPerformanceRouter.getHistoricalPerformance (CT-12).
 *
 * Fixes applied after the behavior-neutral extraction (pins flipped in
 * server/__characterization__/ct12-dashboardValueSeries.char.test.ts):
 *
 * - R-06: transactions are sorted ASC locally before the holdings loop.
 *   batchGetPortfolioTransactions returns DESC (db-optimized.ts:42); the
 *   `break` on txDate > date previously collapsed the series to 0.
 * - R-07: performance is TTWROR (performanceEngine.calculateTTWROR) fed by
 *   the daily valuations plus external flows (transactionSemantics) instead
 *   of the naive (value − startingValue)/startingValue, which counted every
 *   deposit as gain and every withdrawal as loss.
 * - 'entry' transactions (go-live opening positions) count as buy-like
 *   holdings (parity with performanceEngine.buildHoldingsTimeline) and as
 *   external inflows (isExternalFlow) so go-live portfolios are neutral.
 */

import { calculateTTWROR, type CashFlow, type DailyValuation } from './performanceEngine';
import { getSignedFlowCHF, isExternalFlow } from './transactionSemantics';

export interface ValueSeriesTransaction {
  ticker: string | null;
  transactionType: string;
  transactionDate: string | Date;
  shares?: string | null;
  totalAmountCHF?: string | null;
  totalAmount?: string | null;
  fxRate?: string | null;
}

export interface ValueSeriesResult {
  /** Aggregated portfolio market value (CHF) per entry of `sortedDates`. */
  values: number[];
  /** Cumulative performance in % per entry of `sortedDates`. */
  performance: number[];
  /** Market value at the first date of the series. */
  startingValue: number;
}

/**
 * Build the aggregated daily value + performance series for the dashboard.
 *
 * @param transactionLists one transaction list per live portfolio
 * @param stocksMap ticker -> stock row (only `currency` is read)
 * @param priceMap ticker -> (date -> close, local currency)
 * @param sortedDates ascending list of YYYY-MM-DD trading dates
 * @param convertToCHF FX conversion (amount, currency, date) -> CHF
 */
export async function buildDashboardValueSeries(
  transactionLists: ValueSeriesTransaction[][],
  stocksMap: Map<string, { currency?: string | null }>,
  priceMap: Map<string, Map<string, number>>,
  sortedDates: string[],
  convertToCHF: (amount: number, currency: string, date: string) => Promise<number>,
): Promise<ValueSeriesResult> {
  const dateValues: number[] = [];

  // R-06: sort ASC locally — batchGetPortfolioTransactions delivers DESC and
  // the `break` below assumes ascending order.
  const ascendingLists = transactionLists.map(transactions =>
    [...transactions].sort(
      (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    )
  );

  for (let i = 0; i < sortedDates.length; i++) {
    const date = sortedDates[i];
    let totalValueCHF = 0;

    // For each portfolio, calculate holdings at this date
    for (const transactions of ascendingLists) {
      // Calculate holdings up to this date
      const holdingsMap = new Map<string, number>();

      for (const tx of transactions) {
        const txDate = new Date(tx.transactionDate).toISOString().split('T')[0];
        if (txDate > date) break; // Only process transactions before or on this date

        const ticker = tx.ticker;
        if (!ticker) continue;

        // 'entry' = go-live opening position, buy-like (performanceEngine parity)
        if (tx.transactionType === 'buy' || tx.transactionType === 'entry') {
          const shares = parseFloat(tx.shares || '0');
          holdingsMap.set(ticker, (holdingsMap.get(ticker) || 0) + shares);
        } else if (tx.transactionType === 'sell') {
          const shares = parseFloat(tx.shares || '0');
          holdingsMap.set(ticker, (holdingsMap.get(ticker) || 0) - shares);
        }
      }

      // Calculate value of holdings at this date
      for (const [ticker, shares] of Array.from(holdingsMap.entries())) {
        if (shares <= 0) continue;

        const stock = stocksMap.get(ticker);
        if (!stock) continue;

        const currency = stock.currency || 'CHF';

        // Get price for this date (or most recent available)
        const tickerPrices = priceMap.get(ticker);
        if (!tickerPrices) continue;

        let price = tickerPrices.get(date);
        if (!price) {
          // Find most recent price before this date
          const availableDates = Array.from(tickerPrices.keys()).sort();
          for (let j = availableDates.length - 1; j >= 0; j--) {
            if (availableDates[j] <= date) {
              price = tickerPrices.get(availableDates[j]);
              break;
            }
          }
        }

        if (!price) continue;

        // Convert to CHF
        const priceCHF = await convertToCHF(price, currency, date);
        totalValueCHF += shares * priceCHF;
      }
    }

    dateValues.push(totalValueCHF);
  }

  // R-07: performance = TTWROR over the daily valuations with external cash
  // flows (deposits/withdrawals/entries) so that money moving across the
  // portfolio boundary is not reported as gain/loss.
  const valuations: DailyValuation[] = sortedDates.map((date, i) => ({
    date,
    marketValue: dateValues[i],
  }));

  const cashFlows: CashFlow[] = [];
  for (const transactions of ascendingLists) {
    for (const tx of transactions) {
      if (!isExternalFlow(tx)) continue;
      const amount = getSignedFlowCHF(tx);
      if (amount === 0) continue;
      const txDate = new Date(tx.transactionDate).toISOString().split('T')[0];
      // Snap to the first valuation date >= txDate (flows on non-trading days
      // would otherwise never match a TTWROR sub-period).
      const flowDate = sortedDates.find(d => d >= txDate);
      if (!flowDate) continue; // flow after the last valuation — out of window
      cashFlows.push({ date: flowDate, amount, type: tx.transactionType as CashFlow['type'] });
    }
  }

  const ttwror = calculateTTWROR(valuations, cashFlows);
  const datePerformance = ttwror.dailySeries.map(p => p.cumulativeReturn * 100);

  return { values: dateValues, performance: datePerformance, startingValue: dateValues[0] ?? 0 };
}
