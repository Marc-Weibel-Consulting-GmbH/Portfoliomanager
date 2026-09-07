export type ManualTrancheCount = 3 | 4;

export interface ManualTranchePlanInput {
  totalAmountChf: number;
  trancheCount: ManualTrancheCount;
}

export interface ManualTranchePlan {
  totalAmountChf: number;
  trancheCount: ManualTrancheCount;
  requiresManualRelease: true;
  tranches: Array<{
    number: number;
    amountChf: number;
    percentage: number;
    status: 'not_released';
  }>;
}

/**
 * Teilt einen geplanten Anlagebetrag nur für die Vorschau auf. Jede Tranche
 * bleibt bis zu einer separaten menschlichen Entscheidung nicht freigegeben.
 */
export function buildManualTranchePlan(input: ManualTranchePlanInput): ManualTranchePlan {
  if (!Number.isFinite(input.totalAmountChf) || input.totalAmountChf <= 0) {
    throw new Error('totalAmountChf must be positive');
  }
  if (input.trancheCount !== 3 && input.trancheCount !== 4) {
    throw new Error('trancheCount must be 3 or 4');
  }

  const totalCents = Math.round(input.totalAmountChf * 100);
  const baseCents = Math.floor(totalCents / input.trancheCount);
  const remainderCents = totalCents - baseCents * input.trancheCount;
  const tranches = Array.from({ length: input.trancheCount }, (_, index) => {
    const amountChf = (baseCents + (index < remainderCents ? 1 : 0)) / 100;
    return {
      number: index + 1,
      amountChf,
      percentage: Math.round((amountChf / input.totalAmountChf) * 10_000) / 100,
      status: 'not_released' as const,
    };
  });

  return {
    totalAmountChf: totalCents / 100,
    trancheCount: input.trancheCount,
    requiresManualRelease: true,
    tranches,
  };
}
