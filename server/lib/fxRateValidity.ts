/**
 * Safety limits for direct currency-to-CHF FX observations.
 *
 * These are deliberately wide operational envelopes, not price forecasts.  They
 * exist to prevent a malformed provider row such as DKKCHF = 12.34 or
 * JPYCHF = 0.4983 (both factor-100 errors found in the 2026-09-28 historic
 * watchlist audit) from entering a CHF valuation, risk or score calculation.
 *
 * The source record remains immutable in `exchange_rates`; callers skip the
 * invalid observation and may use an earlier validated rate within their
 * documented lookback window. Unknown pairs are not silently accepted.
 */
const CHF_RATE_RANGES: Record<string, readonly [number, number]> = {
  USDCHF: [0.25, 2],
  EURCHF: [0.25, 2],
  GBPCHF: [0.25, 2.5],
  CADCHF: [0.2, 1.3],
  AUDCHF: [0.2, 1.2],
  DKKCHF: [0.05, 0.3],
  NOKCHF: [0.03, 0.2],
  SEKCHF: [0.03, 0.2],
  JPYCHF: [0.001, 0.03],
  PLNCHF: [0.05, 0.4],
  SGDCHF: [0.2, 1.5],
  ILSCHF: [0.05, 1],
};

export function isPlausibleChfFxRate(currencyPair: string, value: unknown): boolean {
  const rate = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  const range = CHF_RATE_RANGES[String(currencyPair ?? "").trim().toUpperCase()];
  return Boolean(range && Number.isFinite(rate) && rate >= range[0] && rate <= range[1]);
}

export function fxRatePlausibilityReason(currencyPair: string, value: unknown): string {
  const pair = String(currencyPair ?? "").trim().toUpperCase();
  const range = CHF_RATE_RANGES[pair];
  if (!range) return `kein bestätigter Plausibilitätsbereich für ${pair || "unbekanntes FX-Paar"}`;
  return `${pair}=${String(value)} liegt ausserhalb des validierten Bereichs ${range[0]}–${range[1]}`;
}
