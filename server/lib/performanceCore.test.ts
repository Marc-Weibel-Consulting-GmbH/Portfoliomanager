import { describe, it, expect } from 'vitest';
import { toChfPriceMap, latestPrice, deriveStocksValueChf } from './performanceCore';

const fakeRate = async (_date: string, pair: string) => (pair === 'USDCHF' ? 0.9 : 1);

describe('performanceCore', () => {
  describe('toChfPriceMap', () => {
    it('returns CHF prices unchanged', async () => {
      const m = { '2026-01-02': 100 };
      expect(await toChfPriceMap(m, 'CHF', fakeRate)).toEqual(m);
    });
    it('converts USD prices via the rate lookup', async () => {
      const out = await toChfPriceMap({ '2026-01-02': 100, '2026-01-03': 200 }, 'USD', fakeRate);
      expect(out).toEqual({ '2026-01-02': 90, '2026-01-03': 180 });
    });
  });

  describe('latestPrice', () => {
    it('returns the value at the most recent date', () => {
      expect(latestPrice({ '2026-01-02': 10, '2026-06-01': 25, '2026-03-01': 15 })).toBe(25);
    });
    it('returns 0 for an empty map', () => {
      expect(latestPrice({})).toBe(0);
    });
  });

  describe('deriveStocksValueChf', () => {
    it('uses stored shares when available', () => {
      const v = deriveStocksValueChf(
        [{ chfPrices: { '2026-06-01': 50 }, rawWeight: 100, shares: 10 }],
        0,
      );
      expect(v).toBe(500);
    });
    it('derives shares from investment amount and weight when shares missing', () => {
      // 60% of 10000 = 6000 CHF at price 60 -> 100 shares -> value 6000
      const v = deriveStocksValueChf(
        [{ chfPrices: { '2026-06-01': 60 }, rawWeight: 60 }],
        10000,
      );
      expect(v).toBeCloseTo(6000, 6);
    });
    it('sums across holdings', () => {
      const v = deriveStocksValueChf(
        [
          { chfPrices: { '2026-06-01': 50 }, rawWeight: 50, shares: 2 },
          { chfPrices: { '2026-06-01': 100 }, rawWeight: 50, shares: 3 },
        ],
        0,
      );
      expect(v).toBe(100 + 300);
    });
  });
});
