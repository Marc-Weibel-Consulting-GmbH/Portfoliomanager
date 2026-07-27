/**
 * Umrechnungskurs eines Titels — mit harter Regel für die Referenzwährung.
 *
 * `stocks.exchangeRateToChf` wird gepflegt und kann falsch sein. Bei
 * CHF-Titeln fiel das katastrophal aus, weil der Kurs dann trotzdem
 * multipliziert wurde:
 *
 *   Roche RO.SW      360 × 0.084 =  30.25 CHF  → 876 statt 74 Stück
 *   Julius Bär       ~60 × 0.065 =   3.90 CHF  → Gewicht 39 % statt 4.2 %
 *
 * Für einen Titel, der bereits in der Referenzwährung notiert, gibt es keinen
 * gültigen Umrechnungskurs ausser 1 — das ist keine Datenfrage, sondern eine
 * Definition. Diese Funktion erzwingt sie, statt der Tabelle zu vertrauen.
 */
export function fxRateForStock(
  currency: string | null | undefined,
  storedRate: string | number | null | undefined,
  referenceCurrency = "CHF",
): number {
  const waehrung = String(currency ?? referenceCurrency).toUpperCase();
  // GBp (Pence) ist eine Untereinheit und braucht sehr wohl eine Umrechnung.
  if (waehrung === referenceCurrency.toUpperCase()) return 1;

  const rate = typeof storedRate === "number" ? storedRate : parseFloat(String(storedRate ?? ""));
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}
