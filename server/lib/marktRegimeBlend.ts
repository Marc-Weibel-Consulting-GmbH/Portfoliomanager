/**
 * Marktregime → Mischungsschlüssel für den Combined Score.
 *
 * Ausgangslage: Die Gewichtung von Qualität und Zeitpunkt in `signalBlend.ts`
 * ist mit einer Marktaussage begründet — «in der Krise zählt Qualität mehr, im
 * Bullenmarkt das Timing». Gefüttert wird sie heute aber mit `regimeEngine`,
 * und die klassifiziert die Kursreihe EINES TITELS. Der Schlüssel
 * `sideways_high_vol` beschreibt also den Kursverlauf des Titels, nicht den
 * Markt.
 *
 * Die Aufteilung, die daraus folgt: Das Marktregime bestimmt die MISCHUNG
 * (eine Makro-Frage), die Kursphase des Titels bestimmt die ENGINE-WAHL (eine
 * Kurs-Frage). Diese Datei liefert das erste Stück — die Abbildung der
 * Marktlage auf die Schlüssel, die `DEFAULT_REGIME_BLEND` kennt.
 *
 * WIRD VORERST NICHT ANGEZEIGT. Die damit gerechneten Werte laufen als
 * Schattenrechnung mit, bis die 30-Tage-Auswertung sagt, welche der beiden
 * Varianten besser trifft. Eine Umstellung ohne diese Messung wäre eine
 * Meinung, keine Verbesserung.
 */

/** Die von `marketRegimeRouter.computeRegime()` vergebenen Marktzustände. */
export type MarktRegime = "Risk-On" | "Neutral" | "Defensive" | "Risk-Off";

/** Wie schwankungsfreudig der Markt gerade ist (Teil-Engine «volatility»). */
export type VolatilitaetsLage = "bullish" | "neutral" | "bearish";

export interface MarktRegimeEingabe {
  /** Gesamtzustand aus der Marktübersicht. */
  overallRegime: string;
  /**
   * Einstufung der Volatilitäts-Teil-Engine. «bullish» heisst dort: Volatilität
   * fällt, der Markt beruhigt sich. Nur im neutralen Gesamtzustand relevant —
   * dort entscheidet sie zwischen ruhiger und unruhiger Seitwärtslage.
   */
  volatilitaet?: string | null;
}

/**
 * Marktlage → Schlüssel für `DEFAULT_REGIME_BLEND`.
 *
 * `recovery` wird bewusst NICHT vergeben: Eine Erholung ist ein Übergang und
 * aus einer einzelnen Momentaufnahme nicht erkennbar. Sie zu raten hiesse, eine
 * Bewegung zu behaupten, die in den Daten gar nicht steht. Sobald die Auswertung
 * der Regime-Historie das trägt, kann sie ergänzt werden.
 */
export function mischungsSchluessel(eingabe: MarktRegimeEingabe): string {
  const regime = String(eingabe.overallRegime ?? "").trim().toLowerCase();

  if (regime === "risk-off") return "crisis";
  if (regime === "defensive") return "bear";
  if (regime === "risk-on") return "bull";

  if (regime === "neutral") {
    // Unruhige Seitwärtslage nur, wenn die Volatilität NICHT für Beruhigung
    // spricht. Fehlt die Angabe, gilt die vorsichtigere Variante (mehr Gewicht
    // auf Qualität) — nicht die für den Titel schmeichelhaftere.
    const vola = String(eingabe.volatilitaet ?? "").trim().toLowerCase();
    return vola === "bullish" ? "sideways_low_vol" : "sideways_high_vol";
  }

  // Unbekannter Zustand: `default` heisst in signalBlend 50/50 — die neutrale
  // Annahme, nicht eine geratene Marktlage.
  return "default";
}

/** Deutsche Bezeichnung des Marktzustands für Protokoll und Admin-Ansicht. */
export const MARKT_REGIME_LABELS: Record<string, string> = {
  "risk-on": "Risikofreudig",
  neutral: "Neutral",
  defensive: "Defensiv",
  "risk-off": "Risikoscheu",
};

export function marktRegimeLabel(regime: string): string {
  return MARKT_REGIME_LABELS[String(regime ?? "").trim().toLowerCase()] ?? "Unbekannt";
}
