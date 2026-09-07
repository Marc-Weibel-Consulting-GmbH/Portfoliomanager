import { describe, expect, it } from 'vitest';
import { buildManualTranchePlan } from './manualTranchePlan';

describe('manual tranche plan', () => {
  it('splits CHF 600,000 into three exactly cash-conserving manual tranches', () => {
    const plan = buildManualTranchePlan({ totalAmountChf: 600_000, trancheCount: 3 });

    expect(plan).toMatchObject({
      totalAmountChf: 600_000,
      trancheCount: 3,
      requiresManualRelease: true,
    });
    expect(plan.tranches.map((tranche) => tranche.amountChf)).toEqual([200_000, 200_000, 200_000]);
    expect(plan.tranches.every((tranche) => tranche.status === 'not_released')).toBe(true);
  });

  it('keeps the total exact after CHF-cent rounding in four tranches', () => {
    const plan = buildManualTranchePlan({ totalAmountChf: 600_000.01, trancheCount: 4 });

    expect(plan.tranches.reduce((sum, tranche) => sum + tranche.amountChf, 0)).toBe(600_000.01);
    expect(plan.tranches).toHaveLength(4);
  });

  it('rejects invalid tranche counts and non-positive capital', () => {
    expect(() => buildManualTranchePlan({ totalAmountChf: 0, trancheCount: 3 })).toThrow('positive');
    expect(() => buildManualTranchePlan({ totalAmountChf: 600_000, trancheCount: 2 as 3 })).toThrow('3 or 4');
  });
});
