/**
 * Einheit der Dividendenrendite — eine Stelle, eine Konvention.
 *
 * `stocks.dividendYield` steht in **Prozent**: 1.51 bedeutet 1.51 %.
 *
 * Das war nicht immer so. Fünf Stellen schreiben in diese Spalte, und sie
 * bezogen ihre Werte aus drei Quellen mit unterschiedlichen Konventionen:
 *
 *  - EODHD liefert einen Bruch (0.0151). `eodhdApi.ts` rechnet ihn in Prozent
 *    um — ab dort ist der Wert 1.51.
 *  - Yahoo liefert ebenfalls einen Bruch; die Aufrufer multiplizieren mit 100.
 *  - Finnhub liefert bereits Prozent.
 *
 * `signalScoreRefreshScheduled` nahm den **bereits umgerechneten** EODHD-Wert
 * und multiplizierte erneut mit 100. In der Datenbank standen dadurch Werte wie
 * 151 für ABB (1.51 %), 376 für Nestlé (3.76 %) oder 31 für Apple (0.31 %) —
 * alle exakt hundertfach zu hoch.
 *
 * Sichtbar wurde das an drei Stellen: Die Detailseite gibt den Rohwert mit
 * Prozentzeichen aus, die Bewertungsampel stuft «> 3 %» als gut ein (bei 151
 * also immer), und `calculateStockScore` vergleicht mit Schwellen in Prozent —
 * bei ABB Teilscore 87.5 statt 12.8, bei 40 % Gewicht ein Gesamtscore von 56.5
 * statt 26.6.
 */

/**
 * Obergrenze einer plausiblen Dividendenrendite in Prozent.
 *
 * Real existierende Ausschüttungsrenditen liegen fast immer unter 10 %.
 * Spezialfälle — geschlossene Fonds, hochverschuldete REITs, Titel nach einem
 * Kurssturz — erreichen 12 bis 15 %. Alles über 25 % ist als Prozentangabe
 * nicht mehr erklärbar und daher ein Einheitenfehler, kein Ausreisser.
 *
 * Die Schwelle ist bewusst grosszügig: Sie soll den Faktor 100 fangen, nicht
 * ungewöhnliche, aber echte Werte verwerfen.
 */
export const PLAUSIBEL_MAX_PROZENT = 25;

/** Ob ein Wert als Prozentangabe erklärbar ist. */
export function istPlausibleRendite(wert: number | null | undefined): boolean {
  if (wert == null || !Number.isFinite(wert)) return false;
  return wert >= 0 && wert <= PLAUSIBEL_MAX_PROZENT;
}

/**
 * EODHD-Screener-Rohwert in die projektweite Prozentkonvention überführen.
 *
 * Der Vertrag ist quellenspezifisch und absichtlich frei von Plausibilitäts-
 * heuristiken: 0.0024 bedeutet bei EODHD immer 0.24 %. Eine bereits in Prozent
 * vorliegende Zahl darf diese Funktion deshalb nie erneut durchlaufen.
 */
export function eodhdBruchZuProzent(wert: number | null | undefined): number | null {
  if (wert == null || !Number.isFinite(wert) || wert < 0 || wert > 1) return null;
  return wert * 100;
}

/**
 * Bringt einen Wert auf die Prozent-Konvention.
 *
 * Liegt er über der Plausibilitätsschranke, war er hundertfach zu hoch und wird
 * geteilt. Bleibt er danach unplausibel, wird `null` zurückgegeben statt einer
 * geratenen Zahl — eine fehlende Angabe ist ehrlicher als eine erfundene.
 *
 * `kontext` erscheint in der Warnung, damit im Log sichtbar wird, welcher
 * Schreibpfad die Konvention verletzt hat.
 */
export function alsProzent(wert: number | null | undefined, kontext = ""): number | null {
  if (wert == null || !Number.isFinite(wert) || wert < 0) return null;
  if (istPlausibleRendite(wert)) return wert;

  const geteilt = wert / 100;
  if (istPlausibleRendite(geteilt)) {
    console.warn(
      `[Dividendenrendite] ${kontext || "unbekannte Quelle"}: ${wert} ist als Prozentwert nicht erklärbar — ` +
      `als ${geteilt} gelesen. Die Spalte führt Prozent (1.51 = 1.51 %).`,
    );
    return geteilt;
  }

  console.warn(
    `[Dividendenrendite] ${kontext || "unbekannte Quelle"}: ${wert} bleibt auch geteilt unplausibel — verworfen.`,
  );
  return null;
}
