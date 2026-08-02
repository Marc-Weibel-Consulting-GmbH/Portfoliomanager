/**
 * Wirksames Regime eines Titels — mit Totband.
 *
 * `computeRegime(prices)` liefert die Einstufung des heutigen Tages. Steht ein
 * Titel nahe einer Regimegrenze, kippt sie von Tag zu Tag hin und her. Für die
 * Gewichtung von Qualität und Zeitpunkt bedeutet ein Wechsel zwischen
 * «Seitwärts ruhig» und «Seitwärts unruhig» einen Sprung um 10 Prozentpunkte —
 * und damit potenziell eine Umschichtung. Jedes Flattern kostet Courtage,
 * Stempelabgabe und Spanne, ohne dass sich in der Sache etwas geändert hätte.
 *
 * Deshalb zählt hier nicht die Einstufung von heute, sondern die, die sich über
 * mehrere Tage gehalten hat.
 *
 * Ohne gespeicherte Historie: Die Einstufungen der Vortage lassen sich aus
 * derselben Kursreihe rekonstruieren, indem man sie schrittweise um einen Tag
 * kürzt. Das Ergebnis ist damit reproduzierbar — dieselbe Reihe ergibt immer
 * dasselbe Regime — und es braucht keine zusätzliche Tabelle.
 */

import { computeRegime } from "./regimeEngine";
import { stabilesRegime, REGIME_TOTBAND_TAGE } from "../kostenModell";

/**
 * Wie viele Tage rückwärts eingestuft werden.
 *
 * Etwas mehr als das Totband, damit ein Wechsel, der genau am Rand liegt, auch
 * erkannt wird. Jeder Tag kostet einen Durchlauf über die Kursreihe; bei fünf
 * bleibt der Aufwand vertretbar.
 */
export const TOTBAND_FENSTER_TAGE = 5;

/**
 * Regime eines Titels nach Totband.
 *
 * Fällt auf die heutige Einstufung zurück, wenn die Reihe für ein Fenster zu
 * kurz ist — dann gibt es nichts zu glätten. Wirft nie; im Fehlerfall kommt
 * `"default"` zurück, was in `signalBlend` die neutrale 50/50-Mischung ergibt.
 */
export function regimeMitTotband(
  prices: number[],
  lpplRisk: number | null = null,
  fensterTage = TOTBAND_FENSTER_TAGE,
): string {
  try {
    if (!Array.isArray(prices) || prices.length < 60) return "default";

    // Einstufungen der letzten Tage, ältestes zuerst. `prices.slice(0, -k)`
    // ist die Reihe, wie sie vor k Tagen vorlag.
    const verlauf: string[] = [];
    for (let k = fensterTage - 1; k >= 0; k--) {
      const reihe = k === 0 ? prices : prices.slice(0, -k);
      if (reihe.length < 60) continue;
      try {
        verlauf.push(computeRegime(reihe, lpplRisk).regime);
      } catch { /* einzelnen Tag überspringen */ }
    }

    if (!verlauf.length) return "default";
    const wirksam = stabilesRegime(verlauf, REGIME_TOTBAND_TAGE);
    return wirksam || verlauf[verlauf.length - 1] || "default";
  } catch {
    return "default";
  }
}
