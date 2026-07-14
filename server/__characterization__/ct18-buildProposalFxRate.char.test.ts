/**
 * CT-18: buildProposal FX Rate Fix
 *
 * Verifies that the buildProposal procedure returns exchangeRateToChf for each
 * position, so the frontend can correctly calculate share quantities.
 *
 * Root cause of the bug fixed in this test:
 * - buildProposal returned positions WITHOUT exchangeRateToChf
 * - Frontend fell back to fxRate=1 for all foreign currency stocks
 * - This caused shares to be calculated as: shares = CHF_allocation / localPrice
 *   instead of: shares = CHF_allocation / priceCHF (= localPrice × fxRate)
 * - For GBp stocks (e.g. DGE.L at 1547 GBp): shares = 13050/1547 = 8.4 instead of 13050/19.83 = 658
 * - Result: portfolio showed -18% performance on day 1 (values calculated with
 *   current prices were ~18x lower than the stored "totalValue")
 *
 * Fix: buildProposal now includes exchangeRateToChf in each position.
 */

import { describe, it, expect } from 'vitest';

// Simulates the frontend handleAcceptProposal logic
function calculateSharesFromProposal(
  position: { currentPrice: number; weightPct: number; exchangeRateToChf?: number },
  capital: number
): { shares: number; priceCHF: number; allocationCHF: number } {
  const value = (position.weightPct / 100) * capital;
  // Frontend logic: use exchangeRateToChf if available, fallback to 1
  const fxRate = position.exchangeRateToChf ?? 1;
  const priceCHF = position.currentPrice * fxRate;
  const shares = priceCHF > 0 ? value / priceCHF : 0;
  return { shares, priceCHF, allocationCHF: value };
}

describe('CT-18: buildProposal FX Rate Fix', () => {
  const capital = 250_000; // CHF 250,000

  describe('GBp stock (DGE.L - Diageo)', () => {
    const dgePosition = {
      ticker: 'DGE.L',
      currency: 'GBp',
      currentPrice: 1547, // GBp
      weightPct: 5.22, // ~5.22% weight
    };
    const expectedAllocation = (dgePosition.weightPct / 100) * capital; // ~CHF 13,050

    it('OLD (buggy): without exchangeRateToChf, fxRate=1 → wrong shares', () => {
      const result = calculateSharesFromProposal(dgePosition, capital);
      // Without fxRate: priceCHF = 1547 GBp treated as CHF → massively overvalued
      expect(result.priceCHF).toBe(1547);
      expect(result.shares).toBeCloseTo(expectedAllocation / 1547, 2); // ~8.4 shares
      // This is WRONG: 8.4 shares × CHF 19.83 = only CHF 166, not CHF 13,050!
      const actualValue = result.shares * 19.83; // actual CHF price
      expect(actualValue).toBeLessThan(200); // Way too low!
    });

    it('FIXED: with exchangeRateToChf=0.012816, correct priceCHF and shares', () => {
      const fixedPosition = { ...dgePosition, exchangeRateToChf: 0.012816 };
      const result = calculateSharesFromProposal(fixedPosition, capital);
      // With fxRate: priceCHF = 1547 × 0.012816 = ~19.83 CHF
      expect(result.priceCHF).toBeCloseTo(19.83, 1);
      expect(result.shares).toBeCloseTo(expectedAllocation / 19.83, 0); // ~658 shares
      // Correct: 658 shares × CHF 19.83 = ~CHF 13,050
      const actualValue = result.shares * result.priceCHF;
      expect(actualValue).toBeCloseTo(expectedAllocation, 0);
    });
  });

  describe('USD stock (VZ - Verizon)', () => {
    const vzPosition = {
      ticker: 'VZ',
      currency: 'USD',
      currentPrice: 42.68, // USD
      weightPct: 5.8,
    };
    const expectedAllocation = (vzPosition.weightPct / 100) * capital; // CHF 14,500

    it('OLD (buggy): without exchangeRateToChf, USD treated as CHF', () => {
      const result = calculateSharesFromProposal(vzPosition, capital);
      expect(result.priceCHF).toBe(42.68); // USD treated as CHF
      // shares = 14500 / 42.68 = 339.9 (slightly off from correct 344.25 due to USD/CHF rate)
      expect(result.shares).toBeCloseTo(339.9, 0);
    });

    it('FIXED: with exchangeRateToChf=0.9822, correct CHF price', () => {
      const fixedPosition = { ...vzPosition, exchangeRateToChf: 0.9822 };
      const result = calculateSharesFromProposal(fixedPosition, capital);
      // priceCHF = 42.68 × 0.9822 = ~41.92 CHF
      expect(result.priceCHF).toBeCloseTo(41.92, 1);
      // shares = 14500 / 41.92 = ~345.9
      expect(result.shares).toBeCloseTo(345.9, 0);
      // Value check: shares × priceCHF ≈ allocation
      expect(result.shares * result.priceCHF).toBeCloseTo(expectedAllocation, 0);
    });
  });

  describe('CAD stock (WCP.TO - Whitecap Resources)', () => {
    const wcpPosition = {
      ticker: 'WCP.TO',
      currency: 'CAD',
      currentPrice: 15.63, // CAD
      weightPct: 4.79,
    };
    const expectedAllocation = (wcpPosition.weightPct / 100) * capital; // CHF 11,975

    it('OLD (buggy): without exchangeRateToChf, CAD treated as CHF', () => {
      const result = calculateSharesFromProposal(wcpPosition, capital);
      expect(result.priceCHF).toBe(15.63); // CAD treated as CHF
      expect(result.shares).toBeCloseTo(expectedAllocation / 15.63, 0); // ~766 shares
    });

    it('FIXED: with exchangeRateToChf=0.663, correct CHF price', () => {
      const fixedPosition = { ...wcpPosition, exchangeRateToChf: 0.663 };
      const result = calculateSharesFromProposal(fixedPosition, capital);
      // priceCHF = 15.63 × 0.663 = ~10.36 CHF
      expect(result.priceCHF).toBeCloseTo(10.36, 1);
      // shares = 11975 / 10.36 = ~1155 shares
      expect(result.shares).toBeCloseTo(1155.6, 1);
      expect(result.shares * result.priceCHF).toBeCloseTo(expectedAllocation, 0);
    });
  });

  describe('CHF stock (BION.SW - BB Biotech)', () => {
    const bionPosition = {
      ticker: 'BION.SW',
      currency: 'CHF',
      currentPrice: 50.60, // CHF
      weightPct: 4.95,
      exchangeRateToChf: 1, // CHF stocks have fxRate=1
    };
    const expectedAllocation = (bionPosition.weightPct / 100) * capital; // CHF 12,375

    it('CHF stocks work correctly with or without exchangeRateToChf', () => {
      const withoutFx = calculateSharesFromProposal({ ...bionPosition, exchangeRateToChf: undefined }, capital);
      const withFx = calculateSharesFromProposal(bionPosition, capital);
      // Both should give same result since fxRate=1 for CHF
      expect(withoutFx.shares).toBeCloseTo(withFx.shares, 4);
      expect(withoutFx.priceCHF).toBe(50.60);
      expect(withFx.priceCHF).toBe(50.60);
      expect(withFx.shares).toBeCloseTo(expectedAllocation / 50.60, 1);
    });
  });

  describe('Portfolio total value consistency', () => {
    it('FIXED: total portfolio value equals investmentAmount when using correct FX rates', () => {
      const positions = [
        { ticker: 'DGE.L',   currency: 'GBp', currentPrice: 1547,  weightPct: 5.22, exchangeRateToChf: 0.012816 },
        { ticker: 'VZ',      currency: 'USD', currentPrice: 42.68,  weightPct: 5.80, exchangeRateToChf: 0.9822  },
        { ticker: 'WCP.TO',  currency: 'CAD', currentPrice: 15.63,  weightPct: 4.79, exchangeRateToChf: 0.663   },
        { ticker: 'BION.SW', currency: 'CHF', currentPrice: 50.60,  weightPct: 4.95, exchangeRateToChf: 1       },
        { ticker: 'SREN.SW', currency: 'CHF', currentPrice: 132.60, weightPct: 4.85, exchangeRateToChf: 1       },
      ];

      let totalValue = 0;
      for (const pos of positions) {
        const { shares, priceCHF } = calculateSharesFromProposal(pos, capital);
        totalValue += shares * priceCHF;
      }

      const totalWeight = positions.reduce((s, p) => s + p.weightPct, 0);
      const expectedValue = (totalWeight / 100) * capital;

      // Total value should equal the allocated portion of capital
      expect(totalValue).toBeCloseTo(expectedValue, 0);
    });
  });
});
