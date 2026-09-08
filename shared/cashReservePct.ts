/**
 * Calculates the cash reserve percentage against the declared capital base.
 * The actual cash balance is authoritative after manual stock adjustments.
 */
export function calculateCashReservePct(input: {
  cashBalanceChf: string | number | null | undefined;
  capitalBaseChf: string | number | null | undefined;
}): number {
  const cashBalanceChf = Number(input.cashBalanceChf);
  const capitalBaseChf = Number(input.capitalBaseChf);
  if (!Number.isFinite(cashBalanceChf) || !Number.isFinite(capitalBaseChf) || capitalBaseChf <= 0) return 0;
  return Math.max(0, (cashBalanceChf / capitalBaseChf) * 100);
}
