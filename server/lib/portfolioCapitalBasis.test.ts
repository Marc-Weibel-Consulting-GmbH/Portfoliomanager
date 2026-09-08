import { describe, expect, it } from 'vitest';
import { calculateInitialPortfolioCapitalBasis } from '../../shared/portfolioCapitalBasis';

describe('calculateInitialPortfolioCapitalBasis', () => {
  it('keeps start capital exact by carrying whole-share rounding into residual cash', () => {
    const basis = calculateInitialPortfolioCapitalBasis({
      initialCapitalChf: 600_000,
      targetCashReservePct: 10,
      holdings: [
        { totalValue: '270011.83' },
        { totalValue: '21618.48' },
        { totalValue: '43353.40' },
        { totalValue: '43209.80' },
        { totalValue: '162168.00' },
      ],
    });

    expect(basis.securitiesValueChf).toBe(540_361.51);
    expect(basis.cashValueChf).toBe(59_638.49);
    expect(basis.totalValueChf).toBe(600_000);
    expect(basis.actualCashReservePct).toBeCloseTo(9.939748, 6);
    expect(basis.targetCashReserveChf).toBe(60_000);
    expect(basis.cashRoundingDifferenceChf).toBe(-361.51);
  });

  it('flags a whole-share portfolio that would exceed the available capital', () => {
    const basis = calculateInitialPortfolioCapitalBasis({
      initialCapitalChf: 100,
      targetCashReservePct: 0,
      holdings: [{ totalValue: 100.01 }],
    });

    expect(basis.isOverAllocated).toBe(true);
    expect(basis.cashValueChf).toBe(0);
    expect(basis.totalValueChf).toBe(100.01);
  });
});
