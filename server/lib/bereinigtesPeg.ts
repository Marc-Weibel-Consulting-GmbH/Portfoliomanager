/**
 * Bereinigtes (trailing) PEG mit Wächtern — Befund 2 der Scoring-Prüfung.
 *
 * Vorher lief das Vendor-PEG (EODHD `Highlights.PEGRatio`) ungeprüft in die
 * Bewertung: `adjustedPeg = vendorPeg × (1 + Volatilitätsaufschlag) ÷
 * Qualitätsmultiplikator`. Die 2-%-Ausblendregel (`MIN_WACHSTUM_FUER_PEG`)
 * galt nur für das forward PEG. Ergebnis am Beispiel BCHN.SW: ein wertloser
 * Vendor-Wert von 15.63 drückte den PEG-Faktor (35 % Gewicht) auf 0/100 und
 * entschied damit allein die Note.
 *
 * Dieselben Regeln wie `pegHistory.trailingPeg` (PR #273), ergänzt um eine
 * Obergrenze: Jede Konstellation, in der die Zahl keine Aussage trägt, wird
 * ausgeblendet — mit Grund, damit die Oberfläche «kein Wert» von «kein Wert,
 * weil …» unterscheiden kann. `baueTeilScore` verteilt das Gewicht dann auf
 * die übrigen Faktoren, statt eine erfundene 0 zu verrechnen.
 */

import { MIN_WACHSTUM_FUER_PEG } from "./pegHistory";

/**
 * Oberhalb dieser Schwelle trägt ein PEG keine Aussage mehr: Bei den Ankern
 * der Bewertung (3 → 0 Punkte) ist alles darüber ohnehin 0 — der Unterschied
 * zwischen 8 und 15.63 ist keiner mehr, wohl aber ein Hinweis darauf, dass der
 * Nenner (Vendor-Wachstumsschätzung) kaputt ist.
 */
export const PEG_OBERGRENZE = 8;

export type BereinigtPegGrund =
  | "peg_fehlt"            // Vendor-PEG fehlt, NaN oder ≤ 0 (Vorzeichen-Artefakt)
  | "wachstum_fehlt"       // weder 5j-CAGR noch TTM belegt — der Vendor-Nenner ist nicht prüfbar
  | "wachstum_zu_gering"   // unter MIN_WACHSTUM_FUER_PEG — Division durch fast null
  | "peg_extrem";          // bereinigter Wert jenseits jeder Aussage

export interface BereinigtesPegErgebnis {
  peg: number | null;
  /** Warum kein Wert ausgegeben wird; null, wenn `peg` belegt ist. */
  grund: BereinigtPegGrund | null;
  /** Deutscher Anzeigetext für den Faktor-Hinweis; null bei belegtem Wert. */
  hinweis: string | null;
}

export interface BereinigtesPegEingabe {
  /** EODHD `Highlights.PEGRatio` — rohes Vendor-Feld. */
  vendorPeg: number | null;
  /** EPS-Volatilität (CV) aus der Gewinnhistorie; null = Standard-Aufschlag. */
  epsVolatility: number | null;
  /** Qualitäts-Rohscore 0–100 (Multiplikator 0.7–1.3, wie bisher). */
  qualityScore: number;
  /** EPS-CAGR 5 Jahre, % p.a. — führende Wachstumsmasszahl. */
  epsWachstum5j: number | null;
  /** EPS-Wachstum TTM, % — Rückfall NUR wenn kein 5j-Wert existiert. */
  epsWachstumTTM: number | null;
}

export function bereinigtesPeg(e: BereinigtesPegEingabe): BereinigtesPegErgebnis {
  const leer = (grund: BereinigtPegGrund, hinweis: string | null): BereinigtesPegErgebnis =>
    ({ peg: null, grund, hinweis });

  if (e.vendorPeg === null || !Number.isFinite(e.vendorPeg) || e.vendorPeg <= 0) {
    return leer("peg_fehlt", "kein Vendor-PEG von EODHD geliefert");
  }

  // ANDERS als in pegHistory ist das Wachstum hier nicht der Nenner der
  // eigenen Rechnung, sondern nur die Plausibilitätsprüfung des
  // Vendor-Nenners. Dafür genügt, dass IRGENDEINE der beiden Wachstumszahlen
  // trägt — die strengere «5j führt, kein Ausweichen»-Regel der ersten
  // Fassung blendete das PEG reihenweise aus, weil das 5j-CAGR oft fehlt
  // oder von einem einzelnen schwachen Basisjahr gedrückt wird.
  const belegte = [e.epsWachstum5j, e.epsWachstumTTM]
    .filter((w): w is number => w !== null && Number.isFinite(w));
  if (belegte.length === 0) {
    return leer("wachstum_fehlt",
      "PEG ausgeblendet — kein belegtes Gewinnwachstum, der Nenner der Vendor-Zahl ist nicht prüfbar");
  }
  if (Math.max(...belegte) < MIN_WACHSTUM_FUER_PEG) {
    return leer("wachstum_zu_gering",
      `PEG sagt hier nichts — Wachstum unter ${MIN_WACHSTUM_FUER_PEG} % p.a. ist eine Division durch fast null`);
  }

  // Die bisherige Bereinigung, unverändert: Volatilitätsaufschlag und
  // Qualitätsmultiplikator.
  const volatilityPenalty = e.epsVolatility !== null ? Math.min(1.0, e.epsVolatility * 0.5) : 0.2;
  const qualityMultiplier = 0.7 + (e.qualityScore / 100) * 0.6; // 0.7–1.3
  const peg = e.vendorPeg * (1 + volatilityPenalty) / qualityMultiplier;

  if (peg > PEG_OBERGRENZE) {
    return leer("peg_extrem",
      `bereinigtes PEG ${peg.toFixed(1)} über der Obergrenze ${PEG_OBERGRENZE} — keine Aussage, Faktor ausgeblendet`);
  }

  return { peg, grund: null, hinweis: null };
}
