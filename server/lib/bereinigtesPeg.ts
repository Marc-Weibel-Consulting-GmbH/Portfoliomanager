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
  /**
   * Deutscher Anzeigetext für den Faktor-Hinweis. Bei ausgeblendetem Wert der
   * Grund; bei selbst gerechnetem Wert die Herkunft; null nur beim
   * unauffälligen Vendor-Fall.
   */
  hinweis: string | null;
  /** Woher das rohe PEG stammt; null, wenn keines zustande kam. */
  quelle: "vendor" | "selbst" | null;
  /**
   * Die komplette Herleitung mit den konkreten Zahlen — Quelle, Nenner,
   * Bereinigungsformel, Ergebnis. Für die Klick-Nachvollziehbarkeit.
   */
  rechnung: string | null;
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
  /**
   * Robustes Mittel der Jahreswachstumsraten (aus `gewinnStabilitaet`), %.
   * Dritte Quelle (Schindler-Befund): Der 5-Jahres-CAGR ist eine
   * Endpunkt-Rechnung — EIN starkes Basisjahr drückt ihn unter 2 % und
   * blendete das PEG aus, obwohl die Jahresraten im Mittel klar wachsen.
   */
  wachstumRatenMittel?: number | null;
  /**
   * Erwartetes EPS-Wachstum (Analystenschätzung), % — letzte Stufe, wie es
   * Yahoo & Co. für ihr PEG verwenden. Keine Aufweichung: Das Vendor-PEG,
   * das ohnehin Vorrang hat, basiert selbst auf Schätzungen, und der
   * PEG-Faktor ist als «geschätzt» markiert.
   */
  wachstumErwartet?: number | null;
  /**
   * Trailing-KGV — nur für den Rückfall, wenn der Vendor kein PEG liefert:
   * Dann wird das rohe PEG selbst gerechnet (KGV ÷ belegtes Wachstum) statt
   * den Faktor auszublenden. Screener-Befund: Bei vielen Nicht-US-Titeln
   * fehlt die Zahl beim Vendor, nicht in den Daten.
   */
  kgv?: number | null;
}

export function bereinigtesPeg(e: BereinigtesPegEingabe): BereinigtesPegErgebnis {
  const leer = (grund: BereinigtPegGrund, hinweis: string | null): BereinigtesPegErgebnis =>
    ({ peg: null, grund, hinweis, quelle: null, rechnung: null });

  // Wachstumsquellen in fester Rangfolge: belegt vor geschätzt, robust vor
  // zerbrechlich. Der 5-Jahres-CAGR bleibt vorne (etablierte Grösse), aber
  // das robuste Raten-Mittel fängt seine Basisjahr-Schwäche auf, und die
  // Analystenschätzung schliesst die letzte Lücke (Schindler-Fall: Yahoo
  // zeigt ein PEG aus erwartetem Wachstum, wir zeigten «sagt nichts»).
  const quellen: Array<{ wert: number | null | undefined; label: string }> = [
    { wert: e.epsWachstum5j, label: "5-Jahres-CAGR" },
    { wert: e.epsWachstumTTM, label: "TTM-Wachstum" },
    { wert: e.wachstumRatenMittel, label: "robustes Raten-Mittel" },
    { wert: e.wachstumErwartet, label: "erwartetes Wachstum (Analystenschätzung)" },
  ];
  const belegte = quellen.filter((q): q is { wert: number; label: string } =>
    q.wert !== null && q.wert !== undefined && Number.isFinite(q.wert));

  const volatilityPenalty = e.epsVolatility !== null ? Math.min(1.0, e.epsVolatility * 0.5) : 0.2;
  const qualityMultiplier = 0.7 + (e.qualityScore / 100) * 0.6; // 0.7–1.3
  const bereinigung = (roh: number) => roh * (1 + volatilityPenalty) / qualityMultiplier;
  const bereinigungsText = `× ${(1 + volatilityPenalty).toFixed(2)} (Volatilitätsaufschlag) ` +
    `÷ ${qualityMultiplier.toFixed(2)} (Qualitätsmultiplikator 0.7–1.3)`;

  let rohesPeg: number;
  let quelle: "vendor" | "selbst";
  let quellenHinweis: string | null = null;
  let rechnungKopf: string;

  if (e.vendorPeg !== null && Number.isFinite(e.vendorPeg) && e.vendorPeg > 0) {
    // ANDERS als in pegHistory ist das Wachstum hier nicht der Nenner der
    // eigenen Rechnung, sondern nur die Plausibilitätsprüfung des
    // Vendor-Nenners: IRGENDEINE tragfähige Wachstumszahl genügt.
    if (belegte.length === 0) {
      return leer("wachstum_fehlt",
        "PEG ausgeblendet — kein belegtes Gewinnwachstum, der Nenner der Vendor-Zahl ist nicht prüfbar");
    }
    if (Math.max(...belegte.map((q) => q.wert)) < MIN_WACHSTUM_FUER_PEG) {
      return leer("wachstum_zu_gering",
        `PEG sagt hier nichts — Wachstum unter ${MIN_WACHSTUM_FUER_PEG} % p.a. ist eine Division durch fast null`);
    }
    rohesPeg = e.vendorPeg;
    quelle = "vendor";
    rechnungKopf = `Vendor-PEG ${e.vendorPeg.toFixed(2)} (EODHD)`;
  } else {
    // Kein Vendor-PEG: selbst rechnen. Hier IST das Wachstum der Nenner —
    // erste tragfähige Quelle der Rangfolge, 2-%-Untergrenze strikt.
    const kgv = e.kgv !== null && e.kgv !== undefined && Number.isFinite(e.kgv) && e.kgv > 0 ? e.kgv : null;
    if (kgv === null) {
      return leer("peg_fehlt", "kein Vendor-PEG von EODHD geliefert");
    }
    const nenner = belegte.find((q) => q.wert >= MIN_WACHSTUM_FUER_PEG) ?? null;
    if (nenner === null) {
      return belegte.length > 0
        ? leer("wachstum_zu_gering",
            `PEG sagt hier nichts — Wachstum unter ${MIN_WACHSTUM_FUER_PEG} % p.a. ist eine Division durch fast null ` +
            `(geprüft: ${belegte.map((q) => `${q.label} ${q.wert.toFixed(1)} %`).join(", ")})`)
        : leer("wachstum_fehlt",
            "PEG ausgeblendet — kein Vendor-PEG und kein belegtes Gewinnwachstum zum Selbstrechnen");
    }
    rohesPeg = kgv / nenner.wert;
    quelle = "selbst";
    quellenHinweis = `selbst gerechnet: KGV ${kgv.toFixed(1)} ÷ ${nenner.wert.toFixed(1)} % ${nenner.label} (kein Vendor-PEG)`;
    rechnungKopf = `KGV ${kgv.toFixed(1)} ÷ ${nenner.wert.toFixed(1)} % ${nenner.label} = ${rohesPeg.toFixed(2)} roh`;
  }

  const peg = bereinigung(rohesPeg);
  const rechnung = `${rechnungKopf} · ${bereinigungsText} = ${peg.toFixed(2)} bereinigt`;

  if (peg > PEG_OBERGRENZE) {
    return leer("peg_extrem",
      `bereinigtes PEG ${peg.toFixed(1)} über der Obergrenze ${PEG_OBERGRENZE} — keine Aussage, Faktor ausgeblendet`);
  }

  return { peg, grund: null, hinweis: quellenHinweis, quelle, rechnung };
}
