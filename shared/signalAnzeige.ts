/**
 * Anzeige-Texte für das Signal — E2 der Reform (REFORM_BEWERTUNG_SIGNAL.md).
 *
 * Das Signal beschreibt den Zustand eines Titels, es ordnet keine Kaufliste:
 * Der Rangtest mit Kosten zeigte, dass eine Kaufauswahl nach Signal-Rangliste
 * dem gleichgewichteten kuratierten Universum unterliegt. Die GESPEICHERTEN
 * Schlüssel («STRONG BUY» … «STRONG SELL») bleiben unverändert — sie stehen in
 * Datenbank-Spalten, Exporten und Vergleichen; nur die Anzeige wird neutral.
 * Die Note A–F bleibt daneben bestehen.
 */
export const SIGNAL_ANZEIGE: Record<string, string> = {
  "STRONG BUY": "Sehr gut",
  BUY: "Gut",
  HOLD: "Neutral",
  SELL: "Schwach",
  "STRONG SELL": "Sehr schwach",
};

/** Gespeicherter Schlüssel → neutraler Anzeigetext; Unbekanntes bleibt, wie es ist. */
export function signalAnzeige(label: string | null | undefined): string | null {
  if (!label) return null;
  return SIGNAL_ANZEIGE[label] ?? label;
}
