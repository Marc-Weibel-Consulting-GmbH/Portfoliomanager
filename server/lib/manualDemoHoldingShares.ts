type ManualDemoHoldingSharesInput = {
  shares: string | number | null | undefined;
  weightPct: string | number | null | undefined;
  capitalBaseChf: string | number | null | undefined;
  priceLocal: string | number | null | undefined;
  exchangeRateToChf: string | number | null | undefined;
};

/**
 * Supports legacy demo holdings that persisted a target weight but no share count.
 * Explicit share counts remain authoritative once they are available.
 */
export function resolveManualDemoHoldingShares(input: ManualDemoHoldingSharesInput): number {
  const hasExplicitShares = input.shares !== null && input.shares !== undefined && String(input.shares).trim() !== '';
  const explicitShares = Number(input.shares);
  if (hasExplicitShares && Number.isFinite(explicitShares) && explicitShares >= 0) return explicitShares;

  const weightPct = Number(input.weightPct);
  const capitalBaseChf = Number(input.capitalBaseChf);
  const priceLocal = Number(input.priceLocal);
  const exchangeRateToChf = Number(input.exchangeRateToChf);
  if (!(weightPct >= 0) || !(capitalBaseChf > 0) || !(priceLocal > 0) || !(exchangeRateToChf > 0)) {
    throw new Error('Gewichtsbasierten Altbestand kann nicht sicher in Stückzahl aufgelöst werden.');
  }
  return (capitalBaseChf * weightPct / 100) / (priceLocal * exchangeRateToChf);
}
