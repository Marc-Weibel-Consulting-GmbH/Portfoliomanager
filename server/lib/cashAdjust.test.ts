import { describe, it, expect } from 'vitest';
import { applyCashDrag } from './cashAdjust';

describe('applyCashDrag', () => {
  it('scales the stock return by the stock fraction', () => {
    // 80% stocks, 20% cash -> +10% stocks becomes +8% total
    const { inclCashPct, cashWeight } = applyCashDrag(10, 800, 200);
    expect(cashWeight).toBeCloseTo(0.2, 9);
    expect(inclCashPct).toBeCloseTo(8, 9);
  });

  it('returns the stock return unchanged when there is no cash', () => {
    expect(applyCashDrag(12.5, 1000, 0)).toEqual({ inclCashPct: 12.5, cashWeight: 0 });
  });

  it('treats negative cash as zero', () => {
    const r = applyCashDrag(10, 1000, -50);
    expect(r.cashWeight).toBe(0);
    expect(r.inclCashPct).toBeCloseTo(10, 9);
  });

  it('falls back to the stock return when total value is zero', () => {
    expect(applyCashDrag(7, 0, 0)).toEqual({ inclCashPct: 7, cashWeight: 0 });
  });

  it('dampens losses too (cash cushions drawdowns)', () => {
    // -10% stocks, 50% cash -> -5% total
    const { inclCashPct } = applyCashDrag(-10, 500, 500);
    expect(inclCashPct).toBeCloseTo(-5, 9);
  });

  it('caps cash weight at 1', () => {
    const { cashWeight, inclCashPct } = applyCashDrag(10, 0, 1000);
    expect(cashWeight).toBe(1);
    expect(inclCashPct).toBeCloseTo(0, 9);
  });
});
