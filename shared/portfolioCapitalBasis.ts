export type InitialHoldingValue = {
  totalValue?: string | number | null;
};

export type InitialPortfolioCapitalBasis = {
  securitiesValueChf: number;
  targetCashReservePct: number;
  targetCashReserveChf: number;
  cashValueChf: number;
  actualCashReservePct: number;
  cashRoundingDifferenceChf: number;
  totalValueChf: number;
  isOverAllocated: boolean;
};

function asFiniteAmount(value: string | number | null | undefined): number {
  const amount = Number.parseFloat(String(value ?? '0'));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Reconciles whole-share holdings with the cash reserve at portfolio inception.
 * The residual cash amount, not the target percentage, is authoritative after
 * quantities have been rounded to tradable whole units.
 */
export function calculateInitialPortfolioCapitalBasis(input: {
  initialCapitalChf: number;
  targetCashReservePct?: string | number | null;
  holdings: InitialHoldingValue[];
}): InitialPortfolioCapitalBasis {
  const initialCapitalChf = roundCurrency(Math.max(0, asFiniteAmount(input.initialCapitalChf)));
  const targetCashReservePct = Math.min(100, Math.max(0, asFiniteAmount(input.targetCashReservePct)));
  const securitiesValueChf = roundCurrency(
    input.holdings.reduce((sum, holding) => sum + asFiniteAmount(holding.totalValue), 0),
  );
  const targetCashReserveChf = roundCurrency(initialCapitalChf * (targetCashReservePct / 100));
  const rawCashValueChf = roundCurrency(initialCapitalChf - securitiesValueChf);
  const isOverAllocated = rawCashValueChf < -0.005;
  const cashValueChf = isOverAllocated ? 0 : rawCashValueChf;
  const totalValueChf = roundCurrency(securitiesValueChf + cashValueChf);

  return {
    securitiesValueChf,
    targetCashReservePct,
    targetCashReserveChf,
    cashValueChf,
    actualCashReservePct: initialCapitalChf > 0 ? (cashValueChf / initialCapitalChf) * 100 : 0,
    cashRoundingDifferenceChf: roundCurrency(cashValueChf - targetCashReserveChf),
    totalValueChf,
    isOverAllocated,
  };
}
