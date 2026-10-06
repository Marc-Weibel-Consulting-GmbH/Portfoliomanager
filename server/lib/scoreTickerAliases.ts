/**
 * Löst ausschliesslich die syntaktische Differenz zwischen der internen
 * US-Stammzeile (`PLTR`) und dem EODHD-Detailticker (`PLTR.US`) auf.
 *
 * Keine Börsen-, ADR- oder Klassen-Aliase: Diese würden Instrumente vermischen
 * und bleiben ausdrücklich ausserhalb dieses Helfers.
 */
export function scoreTickerAliases(ticker: string): string[] {
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) return [];

  if (normalized.endsWith(".US")) {
    return [normalized, normalized.slice(0, -3)];
  }

  return [normalized];
}
