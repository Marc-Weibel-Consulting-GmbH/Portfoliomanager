/**
 * Ein Regime-Name, drei Schreibweisen — hier wird daraus ein Schlüssel.
 *
 * `regimeEngine.classifyRegime` vergibt `bull_trend` und `bear_trend`. Die
 * Gewichtstabellen heissen ihre Zeilen aber `bull` und `bear`. Wer den Namen
 * ungeprüft als Schlüssel benutzt, trifft ausgerechnet in den zwei häufigsten
 * Regimes daneben und landet still auf `default`.
 *
 * Genau das war 2026-07 als SIG-2 in `signalBlend.resolveWeights` behoben
 * worden — die Korrektur blieb dort aber liegen. `dreiScoreSignal` und
 * `signalSchatten` bekamen später eigene Tabellen mit denselben Zeilennamen und
 * eine eigene, wieder alias-lose Auflösung. Der Fehler war damit zurück, und
 * zwar in dem Signal, das inzwischen führt.
 *
 * Deshalb steht die Auflösung jetzt einmal hier. Eine weitere Gewichtstabelle
 * kann den Fehler nicht mehr wiederholen, solange sie diese Funktion benutzt.
 */

/**
 * Namen der Regime-Engine, die von den Gewichtstabellen anders geschrieben werden.
 *
 * Bewusst KEINE Abbildung von `recovery` oder den Seitwärtslagen: Die heissen
 * in beiden Welten gleich. Der Alias soll Schreibweisen versöhnen, nicht
 * Regimes zusammenlegen.
 */
const ALIASE: Record<string, string> = {
  bull_trend: "bull",
  bear_trend: "bear",
};

/** Kleinschreibung, Leerzeichen und Bindestriche zu `_`. */
export function normalisiereRegime(regime: string | null | undefined): string {
  return String(regime ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Die Zeile einer Gewichtstabelle zu einem Regime-Namen.
 *
 * Reihenfolge: exakter Treffer, dann Alias, dann `default`. Der exakte Treffer
 * geht vor, damit eine Tabelle, die `bull_trend` ausdrücklich führt, nicht
 * gegen ihren Willen auf `bull` umgebogen wird.
 */
export function gewichtsZeile<T>(
  regime: string | null | undefined,
  tabelle: Record<string, T>,
): T {
  const key = normalisiereRegime(regime);
  if (tabelle[key]) return tabelle[key];
  const alias = ALIASE[key];
  if (alias && tabelle[alias]) return tabelle[alias];
  return tabelle.default;
}
