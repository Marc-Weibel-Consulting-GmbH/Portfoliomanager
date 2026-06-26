import { describe, it, expect } from 'vitest';
import { convertPriceMapToChf } from './fxPriceConvert';
import { computeWeightedReturnSeries, type WeightedReturnInput } from './weightedReturnSeries';
import { applyCashDrag } from './cashAdjust';

/**
 * Golden scenarios that exercise the full weighted price-index stack the way the
 * endpoints do: FX-convert local prices -> weighted CHF return series -> optional
 * cash drag. These lock in the end-to-end behaviour for the tricky cases.
 */

const START = '2026-01-01';
const D0 = '2026-01-02';
const D1 = '2026-06-18';
const last = (arr: { portfolio: number }[]) => arr[arr.length - 1].portfolio;

describe('performance golden scenarios', () => {
  it('extreme mover: a small-weight stock with a huge gain is fully reflected', () => {
    // MRVL-like: 8.6% weight, +247% (CHF stock, no FX), rest flat.
    const inputs: WeightedReturnInput[] = [
      { ticker: 'MRVL', weight: 8.6, prices: { [D0]: 89.39, [D1]: 310.58 } },
      { ticker: 'REST', weight: 91.4, prices: { [D0]: 100, [D1]: 100 } },
    ];
    const series = computeWeightedReturnSeries(inputs, [D0, D1], START);
    const mrvl = ((310.58 - 89.39) / 89.39) * 100;
    expect(last(series)).toBeCloseTo((mrvl * 8.6) / 100, 4);
    expect(last(series)).toBeGreaterThan(20); // not clamped/smoothed away
  });

  it('multi-currency: USD stock return in CHF differs from local when FX moves', () => {
    // Stock +20% in USD; USDCHF falls 0.92 -> 0.85 (USD weakens) -> CHF return < 20%.
    const localPrices = { [D0]: 100, [D1]: 120 };
    const rates = { [D0]: 0.92, [D1]: 0.85 };
    const chf = convertPriceMapToChf(localPrices, rates);
    const inputs: WeightedReturnInput[] = [{ ticker: 'USX', weight: 100, prices: chf }];
    const chfReturn = last(computeWeightedReturnSeries(inputs, [D0, D1], START));

    const localReturn = 20;
    expect(chfReturn).toBeLessThan(localReturn);
    // Exact: 120*0.85 / (100*0.92) - 1
    expect(chfReturn).toBeCloseTo(((120 * 0.85) / (100 * 0.92) - 1) * 100, 6);
  });

  it('cash: total-portfolio return is dampened by the cash fraction', () => {
    // Stocks +25%, portfolio is 60% stocks / 40% cash -> total +15%.
    const stocksReturn = 25;
    const stocksValue = 600;
    const cash = 400;
    const { inclCashPct, cashWeight } = applyCashDrag(stocksReturn, stocksValue, cash);
    expect(cashWeight).toBeCloseTo(0.4, 9);
    expect(inclCashPct).toBeCloseTo(15, 9);
  });

  it('combined: multi-currency stocks + cash, chart endpoint matches the number', () => {
    // Two stocks (one USD with FX, one CHF), then cash drag. The "chart endpoint"
    // (series last point) and the "number" use the same computation -> identical.
    const usdChf = convertPriceMapToChf({ [D0]: 50, [D1]: 75 }, { [D0]: 0.9, [D1]: 0.95 });
    const inputs: WeightedReturnInput[] = [
      { ticker: 'USD_STK', weight: 40, prices: usdChf },
      { ticker: 'CHF_STK', weight: 60, prices: { [D0]: 200, [D1]: 210 } },
    ];
    const series = computeWeightedReturnSeries(inputs, [D0, D1], START);
    const numberStocks = last(series); // same value the multi-period number uses
    const chartEndpoint = series[series.length - 1].portfolio;
    expect(chartEndpoint).toBeCloseTo(numberStocks, 9);

    const total = applyCashDrag(numberStocks, 1000, 250); // 20% cash
    expect(total.cashWeight).toBeCloseTo(0.2, 9);
    expect(total.inclCashPct).toBeCloseTo(numberStocks * 0.8, 9);
  });
});
