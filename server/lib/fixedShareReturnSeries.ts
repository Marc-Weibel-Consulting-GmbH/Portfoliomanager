export type FixedShareReturnInput = {
  ticker: string;
  shares: number;
  /** Date → CHF split-adjusted close, excluding cash dividends. */
  prices: Record<string, number>;
};

export type FixedShareReturnPoint = {
  date: string;
  /** Securities-only price return, excluding the fixed cash reserve. */
  stocksReturnPct: number;
  /** Full fixed-share allocation including cash held at 0%. */
  totalReturnPct: number;
};

type PreparedInput = {
  shares: number;
  priceDates: string[];
  prices: Record<string, number>;
  startPrice: number;
};

function closeAtOrBefore(prepared: PreparedInput, date: string): number | null {
  let close = 0;
  for (const candidate of prepared.priceDates) {
    if (candidate > date) break;
    close = prepared.prices[candidate];
  }
  return close > 0 ? close : null;
}

/**
 * Builds a historical fixed-share allocation proxy from one homogeneous CHF
 * split-adjusted close series per holding. It deliberately does not apply
 * current weights to historical winners: a stock that rose strongly is worth
 * more because the same number of shares is held, not because it is silently
 * rebalanced every day. Cash remains a 0%-return reserve.
 */
export function computeFixedShareReturnSeries(input: {
  inputs: FixedShareReturnInput[];
  dates: string[];
  startDate: string;
  cashCHF: number;
}): FixedShareReturnPoint[] {
  const prepared: PreparedInput[] = [];
  for (const inputRow of input.inputs) {
    if (!(inputRow.shares > 0)) continue;
    const priceDates = Object.keys(inputRow.prices)
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && inputRow.prices[date] > 0)
      .sort((left, right) => left.localeCompare(right));
    const firstAtOrAfterStart = priceDates.find((date) => date >= input.startDate);
    if (!firstAtOrAfterStart) continue;
    prepared.push({
      shares: inputRow.shares,
      priceDates,
      prices: inputRow.prices,
      startPrice: inputRow.prices[firstAtOrAfterStart],
    });
  }
  if (prepared.length === 0) return [];

  const startStocksValue = prepared.reduce((sum, row) => sum + row.shares * row.startPrice, 0);
  const safeCash = Number.isFinite(input.cashCHF) && input.cashCHF > 0 ? input.cashCHF : 0;
  const startTotalValue = startStocksValue + safeCash;
  if (!(startStocksValue > 0) || !(startTotalValue > 0)) return [];

  const output: FixedShareReturnPoint[] = [];
  for (const date of [...input.dates].sort((left, right) => left.localeCompare(right))) {
    if (date < input.startDate) continue;
    let currentStocksValue = 0;
    let complete = true;
    for (const row of prepared) {
      const close = closeAtOrBefore(row, date);
      if (close === null) {
        complete = false;
        break;
      }
      currentStocksValue += row.shares * close;
    }
    if (!complete) continue;
    output.push({
      date,
      stocksReturnPct: ((currentStocksValue / startStocksValue) - 1) * 100,
      totalReturnPct: (((currentStocksValue + safeCash) / startTotalValue) - 1) * 100,
    });
  }
  return output;
}
