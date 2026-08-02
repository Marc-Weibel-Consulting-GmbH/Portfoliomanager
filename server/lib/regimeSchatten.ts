/**
 * Schattenrechnung: Marktregime gegen Titel-Kursphase.
 *
 * Heute bestimmt die Kursphase des EINZELNEN TITELS die Mischung aus Qualität
 * und Zeitpunkt. Begründet ist diese Mischung aber mit dem Marktzustand. Welche
 * der beiden Lesarten besser trifft, lässt sich nicht argumentieren — nur
 * messen.
 *
 * Also läuft die zweite Variante mit, ohne etwas anzuzeigen: Bei jedem
 * Signal-Lauf wird neben dem echten Score derselbe Score ein zweites Mal
 * gerechnet, nur mit dem Marktregime als Mischungsschlüssel. Beide werden
 * festgehalten; nach `HORIZON_DAYS` wird für beide dieselbe Frage beantwortet —
 * lag die Richtung richtig, und wie viel Alpha blieb gegenüber dem SMI.
 *
 * Erst wenn genügend ausgewertete Paare vorliegen, ist die Umstellung eine
 * belegte Entscheidung. Bis dahin ändert sich für Kunden nichts.
 *
 * Eigene Tabelle statt neuer Spalten: `stock_signal_cache` ist der heisse Pfad,
 * und der manus-Deploy führt `drizzle-kit migrate` nicht aus. Die Tabelle legt
 * sich darum selbst an — dasselbe Muster wie `combined_score_history`.
 */

import { blendCombinedScore, type RegimeBlendConfig } from "./signalBlend";
import { mischungsSchluessel, type MarktRegimeEingabe } from "./marktRegimeBlend";

/** Auswertungshorizont in Tagen — identisch zu combined_score_history. */
export const HORIZON_DAYS = 30;

export interface SchattenEingabe {
  /** Momentum/Timing-Score, −1..1 (dieselbe Grösse wie im echten Lauf). */
  momentumScore: number;
  /** Qualitäts-Score, −1..1, bereits RF-justiert wie im echten Lauf. */
  qualityScore: number;
  /** LPPL-/Blasen-Abschlag, 0..1. */
  lpplPenalty: number;
  /** Schlüssel aus der Kursphase des Titels — das, was heute wirkt. */
  titelRegime: string;
  /** Marktzustand aus der Marktübersicht. */
  markt: MarktRegimeEingabe;
}

export interface SchattenErgebnis {
  /** Score, wie ihn Kunden sehen (Kursphase des Titels als Schlüssel). */
  liveScore: number;
  liveSignal: string;
  liveRegime: string;
  /** Score, wie er mit dem Marktregime herauskäme — nicht angezeigt. */
  schattenScore: number;
  schattenSignal: string;
  schattenRegime: string;
  /** Differenz in Punkten (Schatten − Live); 0 = beide Lesarten einig. */
  differenz: number;
}

/**
 * Beide Varianten aus denselben Eingangswerten rechnen (rein, testbar).
 *
 * Wichtig: Es wird NUR der Mischungsschlüssel getauscht. Momentum, Qualität und
 * Blasenabschlag sind in beiden Zweigen identisch — sonst würde die Messung
 * zwei Änderungen gleichzeitig vergleichen und könnte keiner davon etwas
 * zuschreiben.
 */
export function rechneSchatten(
  eingabe: SchattenEingabe,
  config?: RegimeBlendConfig,
): SchattenErgebnis {
  const { momentumScore, qualityScore, lpplPenalty } = eingabe;
  const schattenRegime = mischungsSchluessel(eingabe.markt);

  const live = blendCombinedScore(
    { momentumScore, qualityScore, regime: eingabe.titelRegime, lpplPenalty },
    config,
  );
  const schatten = blendCombinedScore(
    { momentumScore, qualityScore, regime: schattenRegime, lpplPenalty },
    config,
  );

  return {
    liveScore: live.combinedScore,
    liveSignal: live.signalLabel,
    liveRegime: eingabe.titelRegime,
    schattenScore: schatten.combinedScore,
    schattenSignal: schatten.signalLabel,
    schattenRegime,
    differenz: parseFloat((schatten.combinedScore - live.combinedScore).toFixed(1)),
  };
}

/** Signal-Label → Richtung. `hold` ist nicht bewertbar (keine Richtung behauptet). */
export function richtungAusSignal(signal: string): "buy" | "sell" | null {
  const s = String(signal ?? "").toUpperCase();
  if (s === "STRONG BUY" || s === "BUY") return "buy";
  if (s === "STRONG SELL" || s === "SELL") return "sell";
  return null;
}

/**
 * Lag die Richtung richtig? `null`, wenn kein Richtungsanspruch bestand.
 * Ein Score, der «halten» sagt, kann weder recht noch unrecht haben.
 */
export function richtungKorrekt(signal: string, returnPct: number): boolean | null {
  const richtung = richtungAusSignal(signal);
  if (richtung === null) return null;
  return richtung === "buy" ? returnPct > 0 : returnPct < 0;
}

export interface SchattenBilanz {
  /** Anzahl Paare, bei denen BEIDE Varianten eine Richtung behauptet haben. */
  bewertet: number;
  liveTrefferPct: number | null;
  schattenTrefferPct: number | null;
  liveAlphaPct: number | null;
  schattenAlphaPct: number | null;
  /** Bei wie vielen Paaren die beiden Lesarten überhaupt auseinandergingen. */
  uneinig: number;
}

export interface SchattenZeile {
  liveSignal: string;
  schattenSignal: string;
  actualReturnPct: number | null;
  benchmarkReturnPct: number | null;
}

/**
 * Bilanz über ausgewertete Paare (rein).
 *
 * Gezählt werden nur Zeilen, bei denen BEIDE Varianten eine Richtung behaupten —
 * sonst verglichen wir unterschiedlich grosse Stichproben und der Vergleich
 * würde bedeutungslos. Fehlt der Return, zählt die Zeile gar nicht.
 */
export function bilanziere(zeilen: SchattenZeile[]): SchattenBilanz {
  let bewertet = 0;
  let liveTreffer = 0;
  let schattenTreffer = 0;
  let liveAlphaSumme = 0;
  let schattenAlphaSumme = 0;
  let uneinig = 0;

  for (const z of zeilen) {
    if (z.actualReturnPct == null || !Number.isFinite(z.actualReturnPct)) continue;
    const liveOk = richtungKorrekt(z.liveSignal, z.actualReturnPct);
    const schattenOk = richtungKorrekt(z.schattenSignal, z.actualReturnPct);
    if (liveOk === null || schattenOk === null) continue;

    bewertet++;
    if (liveOk) liveTreffer++;
    if (schattenOk) schattenTreffer++;
    if (z.liveSignal !== z.schattenSignal) uneinig++;

    const bench = z.benchmarkReturnPct ?? 0;
    // Alpha zählt vorzeichenrichtig zur behaupteten Richtung: Ein Verkaufssignal
    // ist erfolgreich, wenn der Titel HINTER dem Markt zurueckbleibt.
    const alpha = z.actualReturnPct - bench;
    liveAlphaSumme += richtungAusSignal(z.liveSignal) === "sell" ? -alpha : alpha;
    schattenAlphaSumme += richtungAusSignal(z.schattenSignal) === "sell" ? -alpha : alpha;
  }

  if (bewertet === 0) {
    return {
      bewertet: 0,
      liveTrefferPct: null,
      schattenTrefferPct: null,
      liveAlphaPct: null,
      schattenAlphaPct: null,
      uneinig: 0,
    };
  }

  const r1 = (v: number) => parseFloat(v.toFixed(1));
  const r2 = (v: number) => parseFloat(v.toFixed(2));
  return {
    bewertet,
    liveTrefferPct: r1((liveTreffer / bewertet) * 100),
    schattenTrefferPct: r1((schattenTreffer / bewertet) * 100),
    liveAlphaPct: r2(liveAlphaSumme / bewertet),
    schattenAlphaPct: r2(schattenAlphaSumme / bewertet),
    uneinig,
  };
}
