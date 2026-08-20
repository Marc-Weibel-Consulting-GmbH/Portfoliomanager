/**
 * Kernsignal-Übernahme (K2, design/KONSOLIDIERUNG_RECHENWERKE.md):
 * EIN Signal für Badges & Alerts.
 *
 * `stocks.signalScore`/`signalType` wurden bisher von zwei eigenen Formeln
 * gefüllt (Alert-Heuristik F3 und calcSignalScore F4) — dieselbe Zeile auf
 * /aktien zeigte damit ein Badge aus einem anderen Modell als die Zahl.
 * Seit K2 werden beide Spalten ausschliesslich aus dem Drei-Score-Signal
 * (stock_signal_cache, geschrieben von signalCacheCron aus `rechneSignal`)
 * übernommen: Badge = Zahl, und die Push-/WhatsApp-Hinweise feuern auf
 * derselben Rechnung, die der Kunde sieht.
 */

export interface KernsignalCacheZeile {
  combinedScore: string | number | null;
  signalType: string | null;
  signalStrength: string | null;
}

export interface SignalFelder {
  signalScore: number | null;
  signalType: "buy" | "sell" | "hold" | null;
}

/**
 * Übersetzt eine stock_signal_cache-Zeile in die stocks-Signalspalten.
 * Ohne Cache-Zeile oder ohne Score gibt es ehrlich kein Signal (null) —
 * die Anzeige zeigt dann «—» statt einer Zweitformel.
 */
export function signalFelderAusCache(zeile?: KernsignalCacheZeile | null): SignalFelder {
  if (!zeile || zeile.combinedScore == null) return { signalScore: null, signalType: null };
  const score = Math.round(Number(zeile.combinedScore));
  if (!Number.isFinite(score)) return { signalScore: null, signalType: null };
  const typ = zeile.signalType === "buy" || zeile.signalType === "sell" || zeile.signalType === "hold"
    ? zeile.signalType
    : "hold";
  return { signalScore: Math.max(0, Math.min(100, score)), signalType: typ };
}

export interface AlertLage {
  /** Aktueller Zustand aus dem Kernsignal-Cache. */
  typ: string | null;
  staerke: string | null;
  score: number | null;
  /** Zuletzt gespeicherter Zustand (stocks-Spalten VOR dem Update). */
  vorherTyp: string | null;
  vorherScore: number | null;
  /** Tage seit dem letzten Alert für diesen Titel (Infinity = nie). */
  tageSeitLetztemAlert: number;
  cooldownTage: number;
}

/** Mindest-Score-Sprung, damit ein unveränderter Zustandstyp erneut meldet. */
export const ALERT_SCORE_SPRUNG = 10;

/**
 * Entscheidet, ob ein Titel einen Hinweis auslöst.
 *
 * Gemeldet wird nur der starke Rand des Kernsignals — «stark» (sehr guter
 * Zustand) bzw. «schwach» — und nur beim Übergang: entweder hat der
 * Zustandstyp gewechselt, oder der Score ist um ≥ ALERT_SCORE_SPRUNG
 * gesprungen. Der Cooldown verhindert Wiederholungs-Meldungen.
 */
export function alertEntscheid(lage: AlertLage): "stark" | "schwach" | null {
  const { typ, staerke, score, vorherTyp, vorherScore, tageSeitLetztemAlert, cooldownTage } = lage;
  if (score == null || staerke !== "strong") return null;
  const richtung = typ === "buy" ? "stark" : typ === "sell" ? "schwach" : null;
  if (!richtung) return null;
  if (cooldownTage > 0 && tageSeitLetztemAlert < cooldownTage) return null;
  const uebergang =
    vorherTyp !== typ ||
    vorherScore == null ||
    Math.abs(score - vorherScore) >= ALERT_SCORE_SPRUNG;
  return uebergang ? richtung : null;
}
