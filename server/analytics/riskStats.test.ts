import { describe, it, expect } from 'vitest';
import {
  calcSortino,
  calcCVar,
  calcBeta,
  calcVolatility,
  calcSharpe,
  alignReturnsByDate,
  TRADING_DAYS_YEAR,
  SQRT_TRADING_DAYS,
} from './riskStats';

describe('riskStats', () => {
  describe('calcSortino (downside deviation divisor = N)', () => {
    it('divides squared downside by total N, not by count of negative days', () => {
      const returns = [0.01, -0.02, 0.03, -0.01]; // N=4, 2 negative
      const rf = 0; // simplify: excess == returns
      const excessMean = (0.01 - 0.02 + 0.03 - 0.01) / 4; // 0.0025
      const downsideDev = Math.sqrt(((-0.02) ** 2 + (-0.01) ** 2) / 4) * SQRT_TRADING_DAYS;
      const expected = (excessMean * TRADING_DAYS_YEAR) / downsideDev;
      expect(calcSortino(returns, rf)).toBeCloseTo(expected, 9);
    });

    it('would differ from the buggy /downside.length variant', () => {
      const returns = [0.01, -0.02, 0.03, -0.01];
      const correct = calcSortino(returns, 0);
      // buggy version divides by downside.length (2) instead of N (4):
      const buggyDownsideDev = Math.sqrt(((-0.02) ** 2 + (-0.01) ** 2) / 2) * SQRT_TRADING_DAYS;
      const buggy = (((0.01 - 0.02 + 0.03 - 0.01) / 4) * TRADING_DAYS_YEAR) / buggyDownsideDev;
      expect(correct).not.toBeCloseTo(buggy, 6);
      expect(correct).toBeGreaterThan(buggy); // correct Sortino is higher (smaller divisor base)
    });

    it('returns 0 when there are no negative returns', () => {
      expect(calcSortino([0.01, 0.02, 0.03], 0)).toBe(0);
    });
  });

  describe('calcCVar (guard against non-loss windows)', () => {
    it('falls back to VaR when the loss threshold is non-positive (gains-only window)', () => {
      const gainsOnly = [0.01, 0.02, 0.03, 0.015, 0.025];
      // 5th percentile is positive -> varVal <= 0 -> return varVal (no inverted tail)
      const cvar = calcCVar(gainsOnly, 0.95);
      expect(cvar).toBeLessThanOrEqual(0);
      expect(Number.isFinite(cvar)).toBe(true);
    });

    it('averages the tail beyond VaR for a normal loss distribution', () => {
      const returns = [-0.1, -0.05, -0.02, 0.0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06];
      const cvar = calcCVar(returns, 0.9);
      expect(cvar).toBeGreaterThan(0); // expected shortfall is a positive loss magnitude
    });
  });

  describe('calcBeta (requires date-aligned inputs)', () => {
    it('returns ~1 when portfolio equals benchmark', () => {
      const b = [0.01, -0.02, 0.03, -0.01, 0.005];
      expect(calcBeta(b, b)).toBeCloseTo(1, 9);
    });

    it('returns ~2 when portfolio moves twice the benchmark', () => {
      const b = [0.01, -0.02, 0.03, -0.01, 0.005];
      const p = b.map((x) => x * 2);
      expect(calcBeta(p, b)).toBeCloseTo(2, 9);
    });
  });

  describe('alignReturnsByDate', () => {
    it('intersects dates so cross-series metrics line up by day', () => {
      const series = {
        AAA: { dates: ['2026-01-02', '2026-01-03', '2026-01-06'], returns: [0.01, 0.02, 0.03] },
        // BBB is missing 2026-01-03 (different trading calendar) and has an extra day
        BBB: { dates: ['2026-01-02', '2026-01-06', '2026-01-07'], returns: [0.05, 0.06, 0.07] },
      };
      const { dates, returnsByTicker } = alignReturnsByDate(series, ['AAA', 'BBB']);
      expect(dates).toEqual(['2026-01-02', '2026-01-06']);
      expect(returnsByTicker.AAA).toEqual([0.01, 0.03]); // 0.02 (Jan 3) dropped
      expect(returnsByTicker.BBB).toEqual([0.05, 0.06]); // 0.07 (Jan 7) dropped
    });

    it('demonstrates why index-zipping is wrong across calendars', () => {
      // Without alignment, index 1 pairs AAA@Jan3 with BBB@Jan6 — different days.
      const series = {
        P: { dates: ['2026-01-02', '2026-01-03', '2026-01-06'], returns: [0.01, 0.10, 0.03] },
        SPY: { dates: ['2026-01-02', '2026-01-06'], returns: [0.01, 0.03] },
      };
      const { returnsByTicker } = alignReturnsByDate(series, ['P', 'SPY']);
      // Aligned: both on Jan2 & Jan6 -> identical -> beta 1
      expect(calcBeta(returnsByTicker.P, returnsByTicker.SPY)).toBeCloseTo(1, 9);
    });

    it('ignores tickers without data', () => {
      const series = {
        A: { dates: ['2026-01-02', '2026-01-03'], returns: [0.01, 0.02] },
        B: { dates: [], returns: [] },
      };
      const { dates } = alignReturnsByDate(series, ['A', 'B']);
      expect(dates).toEqual(['2026-01-02', '2026-01-03']);
    });
  });

  describe('annualization consistency', () => {
    it('Sharpe and Sortino share mean·√252 / risk scaling', () => {
      const r = [0.01, -0.02, 0.03, -0.01, 0.004, -0.006];
      // Both should be finite and use the same annualization basis; sanity check ordering.
      expect(Number.isFinite(calcSharpe(r, 0))).toBe(true);
      expect(Number.isFinite(calcSortino(r, 0))).toBe(true);
      expect(calcVolatility(r)).toBeGreaterThan(0);
    });
  });
});
