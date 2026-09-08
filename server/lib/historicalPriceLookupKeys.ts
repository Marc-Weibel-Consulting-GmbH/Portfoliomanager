import { normalizeTickerForDb } from "../tickerNormalization";

export function historicalPriceLookupKeys(ticker: string): string[] {
  const raw = String(ticker ?? "").trim().toUpperCase();
  const canonical = normalizeTickerForDb(raw);
  // Historische US-Reihen wurden vor der kanonischen `.US`-Einführung teilweise
  // ohne Börsensuffix persistiert. Beide Schlüssel werden nur lesend abgefragt;
  // bei gleicher Serie gewinnt in der Engine weiterhin der kanonische Key.
  return raw && !raw.includes(".") && canonical !== raw
    ? [canonical, raw]
    : [canonical];
}
