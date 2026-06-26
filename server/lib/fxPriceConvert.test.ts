import { describe, it, expect } from 'vitest';
import { convertPriceMapToChf } from './fxPriceConvert';

describe('convertPriceMapToChf', () => {
  it('multiplies each date price by that date FX rate', () => {
    const prices = { '2026-01-02': 100, '2026-01-03': 110 };
    const rates = { '2026-01-02': 0.9, '2026-01-03': 0.95 };
    expect(convertPriceMapToChf(prices, rates)).toEqual({
      '2026-01-02': 90,
      '2026-01-03': 104.5,
    });
  });

  it('forward-fills a missing rate from the most recent prior date', () => {
    const prices = { '2026-01-02': 100, '2026-01-03': 100, '2026-01-06': 100 };
    const rates = { '2026-01-02': 0.9 }; // Jan 3 & 6 missing -> use 0.9
    const out = convertPriceMapToChf(prices, rates);
    expect(out['2026-01-03']).toBeCloseTo(90, 9);
    expect(out['2026-01-06']).toBeCloseTo(90, 9);
  });

  it('uses the earliest rate when a price predates all rates', () => {
    const prices = { '2026-01-01': 100 };
    const rates = { '2026-02-01': 0.8 };
    expect(convertPriceMapToChf(prices, rates)['2026-01-01']).toBeCloseTo(80, 9);
  });

  it('returns prices unchanged when no rates are supplied (graceful degradation)', () => {
    const prices = { '2026-01-02': 100 };
    expect(convertPriceMapToChf(prices, {})).toEqual({ '2026-01-02': 100 });
  });

  it('preserves the CHF return invariant: ratio is FX-adjusted, not just price-adjusted', () => {
    // Stock +0% in local currency but FX moved -> CHF return reflects FX.
    const prices = { '2026-01-02': 100, '2026-06-01': 100 };
    const rates = { '2026-01-02': 1.0, '2026-06-01': 1.1 };
    const chf = convertPriceMapToChf(prices, rates);
    const ret = (chf['2026-06-01'] - chf['2026-01-02']) / chf['2026-01-02'];
    expect(ret).toBeCloseTo(0.1, 9); // +10% purely from FX
  });
});
