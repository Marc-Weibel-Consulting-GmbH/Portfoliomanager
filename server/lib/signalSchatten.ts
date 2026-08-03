/**
 * Schattenrechnung: Empfehlung ohne Qualität im Timing-Teil.
 *
 * Der heutige Signal-Score mischt Qualität und Momentum:
 *
 *     Signal = w_q × Qualität + w_t × Momentum − Blasen-Abschlag
 *
 * Die Qualitätsgewichte reichen von 0.35 (bull) bis 0.75 (crisis). Zwischen 35
 * und 75 Prozent dessen, was als «Timing» gelesen wird, sind also Qualität.
 * Wer «Qualität 80 · Timing 75» nebeneinander liest, zählt Qualität zweimal —
 * und weiss nicht, wie oft.
 *
 * Dazu kommt: Der Qualitätsanteil im Signal stammt aus `calculateQualityScore`
 * (ROE, Verschuldungs-Proxy, FCF-Rendite, Bruttomarge). Seit der Dreiteilung
 * (#240) gibt es einen umfassenderen Qualitätsscore — ROIC, Betriebsmarge,
 * Ertragsqualität, Gewinnstabilität und den Piotroski-Richtungsteil. Das System
 * trüge sonst zwei konkurrierende Qualitätszahlen, und die schmalere säße im
 * Signal.
 *
 * Die saubere Aufteilung wäre:
 *
 *     Timing      = Momentum allein
 *     Empfehlung  = Qualität + Bewertung + Timing, regimeabhängig gewichtet
 *
 * Umgestellt wird hier nichts. Die Regime-Gewichte sind darauf kalibriert, dass
 * Qualität im Score steckt — «crisis: 75 % Qualität» ergibt nur Sinn, solange
 * das so ist. Welche Zusammensetzung besser trifft, lässt sich nicht
 * argumentieren, nur messen. Dieselbe Vorgehensweise wie bei der
 * Regime-Schattenrechnung (#227).
 */

import { bandFuerScore, resolveWeights, type RegimeBlendConfig } from "./signalBlend";

/**
 * Vorläufige Dreiergewichte je Regime.
 *
 * Herleitung: Der Qualitätsanteil folgt grob den bisherigen Gewichten, liegt
 * aber tiefer, weil die Bewertung neu einen eigenen Anteil erhält. Der
 * Timing-Anteil folgt dem bisherigen Trading-Anteil. Die Bewertung wiegt in
 * defensiven Regimen schwerer — dort entscheidet der Einstiegspreis mehr über
 * das Ergebnis als die Kursbewegung.
 *
 * Das sind **Hypothesen**, keine kalibrierten Werte. Genau deshalb läuft die
 * Rechnung im Schatten: Die Messung soll zeigen, ob und wie sie zu korrigieren
 * sind.
 */
export const SCHATTEN_GEWICHTE: Record<string, { qualitaet: number; bewertung: number; timing: number }> = {
  crisis:            { qualitaet: 0.55, bewertung: 0.25, timing: 0.20 },
  bear:              { qualitaet: 0.50, bewertung: 0.25, timing: 0.25 },
  sideways_high_vol: { qualitaet: 0.45, bewertung: 0.20, timing: 0.35 },
  sideways_low_vol:  { qualitaet: 0.40, bewertung: 0.20, timing: 0.40 },
  default:           { qualitaet: 0.40, bewertung: 0.20, timing: 0.40 },
  recovery:          { qualitaet: 0.35, bewertung: 0.15, timing: 0.50 },
  bull:              { qualitaet: 0.30, bewertung: 0.15, timing: 0.55 },
};

export function schattenGewichte(regime: string) {
  const key = (regime || "").toLowerCase().replace(/[\s-]+/g, "_");
  return SCHATTEN_GEWICHTE[key] ?? SCHATTEN_GEWICHTE.default;
}

export interface SchattenEingang {
  /** -1..1 — Momentum allein, ohne Qualitätsanteil. */
  momentumScore: number;
  /** -1..1 — der bisherige, schmale Qualitätsscore (Eingang der Live-Formel). */
  qualityScoreAlt: number;
  /** 0..100 aus `dreiScores.berechneQualitaet`, `null` wenn nicht beurteilbar. */
  qualitaetNeu: number | null;
  /** 0..100 aus `dreiScores.berechneBewertung`, `null` wenn nicht beurteilbar. */
  bewertungNeu: number | null;
  /** 0..1, subtraktiv. */
  lpplPenalty: number;
  regime: string;
}

export interface SchattenErgebnis {
  /**
   * Der Score der ALTEN Zusammensetzung (Momentum + Qualität − LPPL), 0–100.
   *
   * ACHTUNG ZUM NAMEN: Seit der Umstellung des Signals auf die Kombination der
   * drei Scores ist diese Variante nicht mehr live — sie läuft im Schatten,
   * und die neue trägt die Entscheidung. Die Feldnamen bleiben trotzdem, wie
   * sie sind: In `signal_blend_shadow` steht `liveScore` seit dem ersten Tag
   * für die alte Zusammensetzung. Die Spalten umzuwidmen hiesse, die
   * Messreihe genau in der Mitte zu brechen — jede Auswertung müsste dann das
   * Umstellungsdatum kennen. Die Vergleichbarkeit der Reihe ist hier mehr wert
   * als die Genauigkeit des Spaltennamens.
   */
  liveScore: number;
  liveSignal: string;
  /** Die Schattenvariante, 0–100 — oder `null`, wenn die neuen Scores fehlen. */
  schattenScore: number | null;
  schattenSignal: string | null;
  /** Timing allein, 0–100 — das, was künftig unter «Timing» stünde. */
  timingScore: number;
  /** Wie viel Qualität heute im Live-Score steckt (0–1). */
  qualitaetsAnteilLive: number;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Rechnet beide Varianten aus denselben Eingangswerten.
 *
 * Fehlt einer der neuen Scores, wird **kein** Schattenwert gebildet. Die
 * verbleibenden hochzuskalieren würde eine Vergleichbarkeit vortäuschen, die
 * nicht besteht — die Messung soll den Unterschied der Zusammensetzung zeigen,
 * nicht den der Datenlage.
 */
export function rechneSignalSchatten(
  e: SchattenEingang,
  config: RegimeBlendConfig,
): SchattenErgebnis {
  const w = resolveWeights(e.regime, config);
  const gesamt = w.quality + w.trading;
  const wq = gesamt > 0 ? w.quality / gesamt : 0.5;
  const wt = gesamt > 0 ? w.trading / gesamt : 0.5;

  const mNorm = (clamp(e.momentumScore, -1, 1) + 1) / 2;
  const qNorm = (clamp(e.qualityScoreAlt, -1, 1) + 1) / 2;

  const live = clamp(wq * qNorm + wt * mNorm - e.lpplPenalty, 0, 1);
  const liveScore = parseFloat((live * 100).toFixed(1));
  const timingScore = parseFloat((mNorm * 100).toFixed(1));

  if (e.qualitaetNeu === null || e.bewertungNeu === null) {
    return {
      liveScore,
      liveSignal: bandFuerScore(live).signal,
      schattenScore: null,
      schattenSignal: null,
      timingScore,
      qualitaetsAnteilLive: parseFloat(wq.toFixed(3)),
    };
  }

  const g = schattenGewichte(e.regime);
  const schatten = clamp(
    (g.qualitaet * (e.qualitaetNeu / 100) +
      g.bewertung * (e.bewertungNeu / 100) +
      g.timing * mNorm) - e.lpplPenalty,
    0,
    1,
  );

  return {
    liveScore,
    liveSignal: bandFuerScore(live).signal,
    schattenScore: parseFloat((schatten * 100).toFixed(1)),
    schattenSignal: bandFuerScore(schatten).signal,
    timingScore,
    qualitaetsAnteilLive: parseFloat(wq.toFixed(3)),
  };
}
