import { describe, it, expect } from 'vitest';
import { computeWeightedReturnSeries, type WeightedReturnInput } from './weightedReturnSeries';

const last = (arr: { portfolio: number }[]) => arr[arr.length - 1].portfolio;

describe('computeWeightedReturnSeries', () => {
  it('returns the weighted average endpoint for two equally-weighted stocks', () => {
    const inputs: WeightedReturnInput[] = [
      { ticker: 'FLAT', weight: 50, prices: { '2026-01-01': 100, '2026-06-01': 100 } },
      { ticker: 'DOUBLE', weight: 50, prices: { '2026-01-01': 100, '2026-06-01': 200 } },
    ];
    const series = computeWeightedReturnSeries(inputs, ['2026-01-01', '2026-06-01'], '2026-01-01');
    expect(series[0].portfolio).toBeCloseTo(0, 6);
    expect(last(series)).toBeCloseTo(50, 6); // (0% + 100%) / 2
  });

  it('reflects an extreme single-stock mover (the bug this fixes)', () => {
    // MRVL-like: small weight, +247% move, rest flat. Must NOT be clamped/smoothed away.
    const inputs: WeightedReturnInput[] = [
      { ticker: 'MRVL', weight: 8.6, prices: { '2026-01-02': 89.39, '2026-06-18': 310.58 } },
      { ticker: 'REST', weight: 91.4, prices: { '2026-01-02': 100, '2026-06-18': 100 } },
    ];
    const series = computeWeightedReturnSeries(inputs, ['2026-01-02', '2026-06-18'], '2026-01-01');
    const mrvlPerf = ((310.58 - 89.39) / 89.39) * 100; // ~247.4%
    const expected = (mrvlPerf * 8.6 + 0 * 91.4) / 100; // ~21.3%
    expect(last(series)).toBeCloseTo(expected, 4);
    expect(last(series)).toBeGreaterThan(20); // sanity: extreme mover IS reflected
  });

  it('matches the getMultiPeriodPerformanceV2 formula at the endpoint', () => {
    // Independent reimplementation of the V2 number, asserted against the series endpoint.
    const inputs: WeightedReturnInput[] = [
      { ticker: 'A', weight: 30, prices: { '2026-01-05': 50, '2026-03-01': 60, '2026-06-01': 75 } },
      { ticker: 'B', weight: 70, prices: { '2026-01-05': 200, '2026-04-01': 190, '2026-06-01': 210 } },
    ];
    const startDate = '2026-01-01';
    const totalWeight = 30 + 70;
    const v2 = inputs.reduce((acc, s) => {
      const dates = Object.keys(s.prices).sort();
      const startPrice = s.prices[dates[0]];
      const endPrice = s.prices[dates[dates.length - 1]];
      const perf = ((endPrice - startPrice) / startPrice) * 100;
      return acc + perf * (s.weight / totalWeight);
    }, 0);
    const series = computeWeightedReturnSeries(inputs, ['2026-01-05', '2026-03-01', '2026-06-01'], startDate);
    expect(last(series)).toBeCloseTo(v2, 6);
  });

  it('forward-fills missing prices on intermediate dates', () => {
    const inputs: WeightedReturnInput[] = [
      { ticker: 'X', weight: 100, prices: { '2026-01-01': 100, '2026-01-10': 120 } },
    ];
    // 2026-01-05 has no price -> forward-fill from 2026-01-01 (no change yet).
    const series = computeWeightedReturnSeries(inputs, ['2026-01-01', '2026-01-05', '2026-01-10'], '2026-01-01');
    expect(series[0].portfolio).toBeCloseTo(0, 6);
    expect(series[1].portfolio).toBeCloseTo(0, 6); // forward-filled
    expect(series[2].portfolio).toBeCloseTo(20, 6);
  });

  it('falls back to earliest price when none exists at/after startDate', () => {
    const inputs: WeightedReturnInput[] = [
      { ticker: 'IPO', weight: 100, prices: { '2026-03-15': 10, '2026-06-01': 15 } },
    ];
    const series = computeWeightedReturnSeries(inputs, ['2026-03-15', '2026-06-01'], '2026-01-01');
    expect(last(series)).toBeCloseTo(50, 6); // start = earliest (10) -> +50%
  });

  it('renormalizes over stocks that have prices, ignoring those without', () => {
    const inputs: WeightedReturnInput[] = [
      { ticker: 'HAS', weight: 50, prices: { '2026-01-01': 100, '2026-06-01': 150 } },
      { ticker: 'NONE', weight: 50, prices: {} },
    ];
    const series = computeWeightedReturnSeries(inputs, ['2026-01-01', '2026-06-01'], '2026-01-01');
    expect(last(series)).toBeCloseTo(50, 6); // only HAS counts -> +50%, not 25%
  });

  it('returns 0 when there are no usable stocks', () => {
    const series = computeWeightedReturnSeries([], ['2026-01-01'], '2026-01-01');
    expect(series[0].portfolio).toBe(0);
  });
});
