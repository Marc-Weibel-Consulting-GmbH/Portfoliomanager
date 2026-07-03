/**
 * rounding — Schweizer Rundungskonvention (OPTIMIZATION_PLAN.md R-22).
 *
 * Rappenrundung (auf 0.05 CHF) gilt fachlich für CASH-Beträge, d. h. Beträge,
 * die tatsächlich einem Konto belastet/gutgeschrieben werden:
 * - Ein- und Auszahlungen (Settlement-Beträge)
 * - Gebühren/Courtagen
 * - Dividenden-Auszahlungen
 *
 * NICHT Rappen-gerundet werden: Kurse/Preise pro Stück, Stückzahlen,
 * Gewichtungen und Performance-Kennzahlen (Prozente) — diese behalten volle
 * Präzision (für Anzeige-Rundung auf 2 Nachkommastellen gibt es `roundCHF`).
 *
 * Anwendung derzeit NUR an den Live-Schreibpfaden (db.ts
 * createPortfolioTransaction); ein flächendeckender Anzeige-/Format-Pass
 * folgt separat (D-06, Phase 4).
 */

/** Schweizer Rappenrundung: kaufmännisch auf 0.05 CHF. */
export function roundRappen(x: number): number {
  return Math.round(x * 20) / 20;
}

/** Kaufmännische Rundung auf `decimals` Nachkommastellen (Default 2). */
export function roundCHF(x: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(x * f) / f;
}
