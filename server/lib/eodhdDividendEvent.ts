/**
 * EODHD returns two cash figures for an event when a later split changed the
 * number of shares. `value` is expressed per current (split-adjusted) share;
 * `unadjustedValue` is the historical declared amount per pre-split share.
 *
 * All callers that combine an event with a current price or a split-adjusted
 * price series must use `value`. Falling back to `unadjustedValue` is safe only
 * when the provider did not supply the adjusted field.
 */
export function selectSplitAdjustedEodhdDividendAmount(input: {
  value?: number | string | null | undefined;
  unadjustedValue?: number | string | null | undefined;
}): number | null {
  const adjusted = Number(input.value);
  if (Number.isFinite(adjusted) && adjusted > 0) return adjusted;
  const historical = Number(input.unadjustedValue);
  return Number.isFinite(historical) && historical > 0 ? historical : null;
}
