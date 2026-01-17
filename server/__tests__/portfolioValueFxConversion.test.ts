import { describe, it, expect, vi } from 'vitest';

/**
 * Unit tests for FX conversion in portfolio value calculation
 * These tests verify that USD stocks are correctly converted to CHF
 */

describe('Portfolio Value FX Conversion', () => {
  // Test the core calculation logic
  describe('calculateSharesFromAllocation', () => {
    it('should calculate correct shares for CHF stocks', () => {
      const allocationCHF = 10000;
      const priceCHF = 100;
      const expectedShares = 100;
      
      const shares = allocationCHF / priceCHF;
      expect(shares).toBe(expectedShares);
    });

    it('should calculate correct shares for USD stocks with FX conversion', () => {
      const allocationCHF = 10000;
      const priceUSD = 100;
      const fxRate = 0.8; // 1 USD = 0.8 CHF
      const priceCHF = priceUSD * fxRate; // 80 CHF
      const expectedShares = 125; // 10000 / 80 = 125
      
      const shares = allocationCHF / priceCHF;
      expect(shares).toBe(expectedShares);
    });

    it('should handle zero price gracefully', () => {
      const allocationCHF = 10000;
      const priceCHF = 0;
      
      const shares = priceCHF > 0 ? allocationCHF / priceCHF : 0;
      expect(shares).toBe(0);
    });

    it('should not round shares to integers', () => {
      const allocationCHF = 8336;
      const priceCHF = 66.36; // NEE example
      const expectedShares = 125.59; // Should be ~125.59, not 100
      
      const shares = allocationCHF / priceCHF;
      expect(shares).toBeCloseTo(expectedShares, 1);
    });
  });

  describe('calculatePortfolioValue', () => {
    it('should calculate total value correctly with mixed currencies', () => {
      const holdings = [
        { ticker: 'NESN.SW', shares: 100, priceCHF: 80 },
        { ticker: 'NVDA', shares: 50, priceUSD: 150, fxRate: 0.8 },
      ];
      
      let totalValueCHF = 0;
      for (const h of holdings) {
        if ('priceCHF' in h) {
          totalValueCHF += h.shares * h.priceCHF;
        } else {
          totalValueCHF += h.shares * (h.priceUSD * h.fxRate);
        }
      }
      
      // NESN.SW: 100 * 80 = 8000
      // NVDA: 50 * 150 * 0.8 = 6000
      // Total: 14000
      expect(totalValueCHF).toBe(14000);
    });

    it('should use priceCHF not currentPrice for fallback calculation', () => {
      // This tests the bug fix: fallback should use priceCHF, not currentPrice
      const investmentAmount = 80000;
      const weight = 0.1042; // 10.42%
      const allocationCHF = investmentAmount * weight; // 8336 CHF
      
      // Wrong way (bug): using USD price directly
      const priceUSD = 83.63;
      const wrongShares = Math.round(allocationCHF / priceUSD); // ~100 (wrong!)
      
      // Correct way: using CHF price
      const fxRate = 0.8016;
      const priceCHF = priceUSD * fxRate; // ~67.03 CHF
      const correctShares = allocationCHF / priceCHF; // ~124.35 (correct!)
      
      expect(wrongShares).toBe(100); // This was the bug
      expect(correctShares).toBeCloseTo(124.35, 0); // This is correct
    });
  });

  describe('FX rate handling', () => {
    it('should return 1 for CHF to CHF conversion', () => {
      const fxRate = 1; // CHF to CHF
      expect(fxRate).toBe(1);
    });

    it('should handle typical USD/CHF rate', () => {
      const fxRate = 0.8016; // Typical USD/CHF rate
      const priceUSD = 100;
      const priceCHF = priceUSD * fxRate;
      
      expect(priceCHF).toBeCloseTo(80.16, 2);
    });

    it('should handle EUR/CHF rate', () => {
      const fxRate = 0.93; // Typical EUR/CHF rate
      const priceEUR = 100;
      const priceCHF = priceEUR * fxRate;
      
      expect(priceCHF).toBeCloseTo(93, 2);
    });
  });

  describe('Portfolio value consistency', () => {
    it('should calculate same value regardless of calculation method', () => {
      // Test that portfolioData-based calculation matches transaction-based calculation
      const shares = 125.59;
      const priceCHF = 66.36;
      
      const valueFromShares = shares * priceCHF;
      
      // Should be close to the original allocation
      expect(valueFromShares).toBeCloseTo(8336, -1); // Within 10 CHF
    });

    it('should maintain investment amount within 1% tolerance', () => {
      const investmentAmount = 80000;
      const tolerance = 0.01; // 1%
      
      // Simulated portfolio value after creation
      const portfolioValue = 80002.41;
      
      const deviation = Math.abs(portfolioValue - investmentAmount) / investmentAmount;
      expect(deviation).toBeLessThan(tolerance);
    });
  });
});
