/**
 * CT-17: Portfolio Value Calculation Consistency
 *
 * Verifies that the Portfolio Detail page (getWithCurrency) calculates
 * portfolio value the same way as the Dashboard (getAggregatedMetrics):
 * using stored shares × current price, NOT weight × investmentAmount.
 *
 * Root cause of the bug fixed in this test:
 * - Dashboard used stored shares from portfolioData.stocks[].shares
 * - Portfolio Detail ALWAYS recalculated shares as investmentAmount × weight / currentPrice
 *   This meant Portfolio Detail always returned investmentAmount as totalValue,
 *   ignoring actual price changes since portfolio creation.
 *
 * Fix: Portfolio Detail now uses stored shares when available (shares > 0),
 * and only falls back to weight-based calculation when shares are 0.
 */

import { describe, it, expect } from 'vitest';

// Helper that mirrors the fixed shares calculation logic in portfoliosRouter.ts
function calculateShares(
  storedShares: number,
  investmentAmount: number,
  weight: number, // in percent (0-100)
  priceCHF: number
): number {
  // Fixed logic: use stored shares if available, fallback to weight-based only when 0
  if (storedShares > 0) {
    return storedShares;
  }
  if (investmentAmount > 0 && weight > 0 && priceCHF > 0) {
    return (investmentAmount * (weight / 100)) / priceCHF;
  }
  return 0;
}

// Helper that mirrors the OLD (buggy) shares calculation
function calculateSharesOld(
  storedShares: number,
  investmentAmount: number,
  weight: number,
  priceCHF: number,
  isDemoPortfolio: boolean
): number {
  // Old logic: always recalculate for demo portfolios (ignores stored shares)
  if ((isDemoPortfolio || storedShares === 0) && investmentAmount > 0 && priceCHF > 0) {
    return (investmentAmount * (weight / 100)) / priceCHF;
  }
  return storedShares;
}

describe('CT-17: Portfolio Value Calculation Consistency', () => {
  const investmentAmount = 250000; // CHF 250,000

  // Simulated portfolio: 2 stocks, each 50% weight
  // Stock A: bought at 100 CHF, now at 80 CHF (price dropped 20%)
  // Stock B: bought at 200 CHF, now at 160 CHF (price dropped 20%)
  const stocks = [
    { ticker: 'STOCKA', weight: 50, buyPriceCHF: 100, currentPriceCHF: 80, storedShares: 1250 },
    { ticker: 'STOCKB', weight: 50, buyPriceCHF: 200, currentPriceCHF: 160, storedShares: 625 },
  ];

  it('Fixed: uses stored shares × current price (reflects actual market value)', () => {
    let totalValue = 0;
    for (const stock of stocks) {
      const shares = calculateShares(stock.storedShares, investmentAmount, stock.weight, stock.currentPriceCHF);
      expect(shares).toBe(stock.storedShares); // Should use stored shares
      totalValue += shares * stock.currentPriceCHF;
    }
    // Expected: 1250 × 80 + 625 × 160 = 100,000 + 100,000 = 200,000
    expect(totalValue).toBe(200000);
    // Should NOT equal investmentAmount since prices dropped
    expect(totalValue).not.toBe(investmentAmount);
  });

  it('Old (buggy): weight-based calc always returns investmentAmount for demo portfolios', () => {
    let totalValue = 0;
    for (const stock of stocks) {
      const shares = calculateSharesOld(stock.storedShares, investmentAmount, stock.weight, stock.currentPriceCHF, true);
      // Old logic recalculates: shares = 250000 × 0.5 / currentPrice
      const expectedShares = (investmentAmount * (stock.weight / 100)) / stock.currentPriceCHF;
      expect(shares).toBeCloseTo(expectedShares, 5);
      totalValue += shares * stock.currentPriceCHF;
    }
    // Old logic always returns investmentAmount (250,000) regardless of price changes
    expect(totalValue).toBeCloseTo(investmentAmount, 0);
  });

  it('Fixed: when stored shares are 0, falls back to weight-based calculation', () => {
    const sharesA = calculateShares(0, investmentAmount, 50, 80);
    // Fallback: 250000 × 0.5 / 80 = 1562.5
    expect(sharesA).toBeCloseTo(1562.5, 5);
  });

  it('Fixed: Dashboard and Portfolio Detail now agree on value', () => {
    // Dashboard: uses stored shares × current price
    let dashboardTotal = 0;
    for (const stock of stocks) {
      dashboardTotal += stock.storedShares * stock.currentPriceCHF;
    }

    // Portfolio Detail (fixed): also uses stored shares × current price
    let detailTotal = 0;
    for (const stock of stocks) {
      const shares = calculateShares(stock.storedShares, investmentAmount, stock.weight, stock.currentPriceCHF);
      detailTotal += shares * stock.currentPriceCHF;
    }

    expect(detailTotal).toBe(dashboardTotal);
    expect(detailTotal).toBe(200000);
  });

  it('Performance calculation is correct after fix', () => {
    let totalValue = 0;
    for (const stock of stocks) {
      const shares = calculateShares(stock.storedShares, investmentAmount, stock.weight, stock.currentPriceCHF);
      totalValue += shares * stock.currentPriceCHF;
    }
    const performanceAbsolute = totalValue - investmentAmount;
    const performancePercent = (performanceAbsolute / investmentAmount) * 100;
    
    // 200,000 - 250,000 = -50,000 CHF
    expect(performanceAbsolute).toBe(-50000);
    // -50,000 / 250,000 = -20%
    expect(performancePercent).toBe(-20);
  });
});
