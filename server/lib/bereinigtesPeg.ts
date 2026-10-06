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
  | "wachstum_extrem"      // über MAX_WACHSTUM_FUER_PEG — Basiseffekt, keine tragfähige Rate
  | "peg_extrem";          // bereinigter Wert jenseits jeder Aussage

/**
 * Oberhalb dieser Rate (% p.a.) ist ein Wachstum kein tragfähiger PEG-Nenner
 * mehr, sondern ein Basiseffekt: FDJ (FDJU.PA) stand nach Einmaleffekten mit
 * Mini-Gewinn da — trailing KGV 172, «erwartetes Wachstum» +1944 %, PEG 0.09,
 * volle Punktzahl. Das G im PEG meint nachhaltiges Mehrjahres-Wachstum; die
 * Rangfolge überspringt Quellen darüber. 50 → 35 nach dem Roche-Fall: Ein
 * kaputter Schätzwert von 45.8 % schlüpfte knapp unter die alte Grenze —
 * nachhaltige Raten über 35 % p.a. sind praktisch nie real.
 */
export const MAX_WACHSTUM_FUER_PEG = 35;

/**
 * Analystenschätzungen für schnell wachsende, bereits profitable Unternehmen
 * können plausibel oberhalb der historischen Nachhaltigkeitsgrenze liegen.
 * Sie bleiben klar von Basiseffekten getrennt: Nur die als Schätzung markierte
 * 2026→2027-Rate erhält diesen höheren Korridor; TTM-, CAGR- und Ratenmittel
 * bleiben bei 35 %, damit einmalige Ergebnisbasen nicht ins PEG gelangen.
 */
export const MAX_ERWARTETES_WACHSTUM_FUER_PEG = 60;

/**
 * Konsistenz-Gegenprobe: Weichen Vendor-PEG und eigene Rechnung (KGV ÷
 * tragfähige Quelle) um mehr als diesen Faktor voneinander ab, ist EINE der
 * beiden Zahlen kaputt — welche, ist nicht entscheidbar. Es zählt dann die
 * VORSICHTIGERE (das höhere PEG, weniger Punkte): Bei widersprüchlichen
 * Quellen gibt es nie die günstigere Lesart. Roche-Lehre: Die frühere Regel
 * «eigene Rechnung gewinnt» machte aus Vendor 1.68 ein 100/100-«Schnäppchen»,
 * weil ausgerechnet der eigene Nenner der kaputte war.
 */
export const VENDOR_PEG_ABWEICHUNG_FAKTOR = 2;

/**
 * Erwartetes EPS-Wachstum aus zwei Analystenschätzungen — Schätzung gegen
 * Schätzung, NIE Schätzung gegen berichtetes EPS: Schätzungen basieren oft
 * auf einer bereinigten EPS-Definition (Roche: Core EPS), das berichtete EPS
 * ist IFRS — bei grosser Lücke entsteht ein künstlicher Sprung (Roche:
 * +45.8 % statt ~8 %). Mini-Basen unter 0.1 tragen keinen Nenner.
 */
export function erwartetesWachstum(
  schaetzungLaufend: number | null,
  schaetzungNaechstes: number | null,
): number | null {
  if (schaetzungLaufend === null || schaetzungNaechstes === null) return null;
  if (!Number.isFinite(schaetzungLaufend) || !Number.isFinite(schaetzungNaechstes)) return null;
  if (schaetzungLaufend <= 0.1) return null;
  return ((schaetzungNaechstes - schaetzungLaufend) / schaetzungLaufend) * 100;
}

export interface BereinigtesPegErgebnis {
  peg: number | null;
  /**
   * Rohes PEG VOR der Bereinigung — mit externen Quellen vergleichbar. Bei den
   * frühen Ausblendungen (kein Wert zustande gekommen) null; bei `peg_extrem`
   * bleibt er erhalten, damit Export und Hinweis die Zahl erklären können.
   */
  roh: number | null;
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
  /**
   * Forward-KGV — Zähler, wenn der Nenner das ERWARTETE Wachstum ist
   * (Frame-Konsistenz, so rechnen FactSet & Co.): Ein Schätzungs-Nenner
   * gegen das trailing KGV überzeichnet das PEG, wenn die berichteten
   * Gewinne gedrückt sind. Historische Nenner bleiben beim Trailing-KGV.
   */
  kgvForward?: number | null;
}

export function bereinigtesPeg(e: BereinigtesPegEingabe): BereinigtesPegErgebnis {
  const leer = (grund: BereinigtPegGrund, hinweis: string | null): BereinigtesPegErgebnis =>
    ({ peg: null, roh: null, grund, hinweis, quelle: null, rechnung: null });

  // Wachstumskandidaten: Historische Raten dürfen nur im nachhaltigen
  // Korridor 2–35 % liegen. Eine aktuelle Analystenschätzung ist dagegen
  // zukunftsbezogen und erhält für echte Wachstumsunternehmen einen klar
  // beschrifteten Korridor bis 60 %. So bleibt ein TTM-/CAGR-Basiseffekt
  // gesperrt, ohne valide 2026→2027-Prognosen wie Palantir zu verwerfen.
  type Wachstumsquelle = { wert: number | null | undefined; label: string; geschaetzt: boolean };
  const quellen: Wachstumsquelle[] = [
    { wert: e.epsWachstum5j, label: "5-Jahres-CAGR", geschaetzt: false },
    { wert: e.epsWachstumTTM, label: "TTM-Wachstum", geschaetzt: false },
    { wert: e.wachstumRatenMittel, label: "robustes Raten-Mittel", geschaetzt: false },
    { wert: e.wachstumErwartet, label: "erwartetes Wachstum (Analystenschätzung)", geschaetzt: true },
  ];
  const belegte = quellen.filter((q): q is Wachstumsquelle & { wert: number } =>
    q.wert !== null && q.wert !== undefined && Number.isFinite(q.wert));
  const istTragfaehig = (q: Wachstumsquelle & { wert: number }) =>
    q.wert >= MIN_WACHSTUM_FUER_PEG &&
    q.wert <= (q.geschaetzt ? MAX_ERWARTETES_WACHSTUM_FUER_PEG : MAX_WACHSTUM_FUER_PEG);
  const historischeQuelle = belegte.find((q) => !q.geschaetzt && istTragfaehig(q)) ?? null;
  const schaetzungsQuelle = belegte.find((q) => q.geschaetzt && istTragfaehig(q)) ?? null;

  const volatilityPenalty = e.epsVolatility !== null ? Math.min(1.0, e.epsVolatility * 0.5) : 0.2;
  const qualityMultiplier = 0.7 + (e.qualityScore / 100) * 0.6; // 0.7–1.3
  const bereinigung = (roh: number) => roh * (1 + volatilityPenalty) / qualityMultiplier;
  const bereinigungsText = `× ${(1 + volatilityPenalty).toFixed(2)} (Volatilitätsaufschlag) ` +
    `÷ ${qualityMultiplier.toFixed(2)} (Qualitätsmultiplikator 0.7–1.3)`;

  let rohesPeg: number;
  let quelle: "vendor" | "selbst";
  let quellenHinweis: string | null = null;
  let rechnungKopf: string;

  // Frame-Konsistenz: Schätzungs-Nenner paart mit Forward-KGV, historische
  // Nenner mit Trailing-KGV. Die Vendor-Gegenprobe bevorzugt eine gültige
  // aktuelle Schätzung, da Vendor-PEGs definitionsgemäss zukunftsbezogen sind.
  const kgv = e.kgv !== null && e.kgv !== undefined && Number.isFinite(e.kgv) && e.kgv > 0 ? e.kgv : null;
  const kgvForward = e.kgvForward !== null && e.kgvForward !== undefined &&
    Number.isFinite(e.kgvForward) && e.kgvForward > 0 ? e.kgvForward : null;
  const berechneEigenesPeg = (nenner: (Wachstumsquelle & { wert: number }) | null) => {
    if (nenner === null) return null;
    const zaehler = nenner.geschaetzt ? (kgvForward ?? kgv) : kgv;
    if (zaehler === null) return null;
    return {
      nenner,
      zaehler,
      zaehlerLabel: nenner.geschaetzt && kgvForward !== null ? "KGV (forward)" : "KGV (trailing)",
      peg: zaehler / nenner.wert,
    };
  };
  const vendorGegenprobe = berechneEigenesPeg(schaetzungsQuelle ?? historischeQuelle);
  const selbstBerechnung = berechneEigenesPeg(historischeQuelle ?? schaetzungsQuelle);

  // Sanofi-Befund: Ein Vendor-Wert, der bereinigt jenseits der Obergrenze
  // läge (EODHD lieferte ~50, FactSet 1.20), trägt keine Aussage — er ist
  // kein «vorsichtiger» Wert, sondern gar keiner. Er gilt als fehlend, die
  // Selbstrechnung übernimmt mit allen Wächtern.
  const vendorRoh = e.vendorPeg !== null && Number.isFinite(e.vendorPeg) && e.vendorPeg > 0 ? e.vendorPeg : null;
  const vendorUnbrauchbar = vendorRoh !== null && bereinigung(vendorRoh) > PEG_OBERGRENZE
    ? `Vendor-PEG ${vendorRoh.toFixed(1)} unbrauchbar (bereinigt über der Obergrenze ${PEG_OBERGRENZE})`
    : null;

  if (vendorRoh !== null && vendorUnbrauchbar === null) {
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
    if (vendorGegenprobe !== null &&
        (vendorRoh / vendorGegenprobe.peg > VENDOR_PEG_ABWEICHUNG_FAKTOR ||
         vendorGegenprobe.peg / vendorRoh > VENDOR_PEG_ABWEICHUNG_FAKTOR)) {
      // Widerspruch: Die vorsichtigere Zahl (höheres PEG) zählt — landet sie
      // jenseits der Obergrenze, blendet der bestehende Wächter unten aus.
      const widerspruch = `Vendor-PEG ${vendorRoh.toFixed(2)} und eigene Rechnung ` +
        `${vendorGegenprobe.peg.toFixed(2)} widersprechen sich (über Faktor ${VENDOR_PEG_ABWEICHUNG_FAKTOR}) — ` +
        `vorsichtigere Zahl verwendet`;
      quellenHinweis = widerspruch;
      if (vendorGegenprobe.peg > vendorRoh) {
        rohesPeg = vendorGegenprobe.peg;
        quelle = "selbst";
        rechnungKopf = `${vendorGegenprobe.zaehlerLabel} ${vendorGegenprobe.zaehler.toFixed(1)} ÷ ${vendorGegenprobe.nenner.wert.toFixed(1)} % ${vendorGegenprobe.nenner.label} ` +
          `= ${vendorGegenprobe.peg.toFixed(2)} roh (vorsichtigere Zahl — Vendor-PEG ${vendorRoh.toFixed(2)} widersprochen)`;
      } else {
        rohesPeg = vendorRoh;
        quelle = "vendor";
        rechnungKopf = `Vendor-PEG ${vendorRoh.toFixed(2)} (EODHD; vorsichtigere Zahl — ` +
          `eigene Rechnung ${vendorGegenprobe.peg.toFixed(2)} widersprochen)`;
      }
    } else {
      rohesPeg = vendorRoh;
      quelle = "vendor";
      rechnungKopf = `Vendor-PEG ${vendorRoh.toFixed(2)} (EODHD)`;
    }
  } else {
    // Kein (brauchbares) Vendor-PEG: selbst rechnen. Hier IST das Wachstum
    // der Nenner — erste tragfähige Quelle der Rangfolge, Korridor strikt.
    const vendorNote = vendorUnbrauchbar ?? "kein Vendor-PEG";
    if (selbstBerechnung === null && kgv === null && kgvForward === null) {
      return vendorUnbrauchbar !== null
        ? leer("peg_extrem", `${vendorUnbrauchbar} — und kein KGV für die eigene Rechnung`)
        : leer("peg_fehlt", "kein Vendor-PEG von EODHD geliefert");
    }
    const eigeneBerechnung = selbstBerechnung;
    const nenner = eigeneBerechnung?.nenner ?? null;
    if (nenner === null) {
      if (belegte.length === 0) {
        return leer("wachstum_fehlt",
          "PEG ausgeblendet — kein Vendor-PEG und kein belegtes Gewinnwachstum zum Selbstrechnen");
      }
      const geprueft = belegte.map((q) => `${q.label} ${q.wert.toFixed(1)} %`).join(", ");
      // Alle Quellen ausserhalb des Korridors: die Meldung nennt die
      // dominierende Ursache — Basiseffekt (zu gross) oder fast null.
      return belegte.some((q) => q.wert > MAX_WACHSTUM_FUER_PEG)
        ? leer("wachstum_extrem",
            `PEG sagt hier nichts — Wachstum über ${MAX_WACHSTUM_FUER_PEG} % p.a. ist ein Basiseffekt ` +
            `(winziger Ausgangsgewinn), keine tragfähige Rate (geprüft: ${geprueft})`)
        : leer("wachstum_zu_gering",
            `PEG sagt hier nichts — Wachstum unter ${MIN_WACHSTUM_FUER_PEG} % p.a. ist eine Division durch fast null ` +
            `(geprüft: ${geprueft})`);
    }
    // Burkhalter-Befund: Die erste tragfähige Quelle kann selbst kaputt sein —
    // ein fusions- oder basisjahrzerdrückter 5j-CAGR knapp über 2 % ergibt
    // PEG 8–12 und blendete den Faktor aus, während die intakte
    // Analystenschätzung (~11 %) ein realistisches PEG trüge (MarketScreener
    // zeigt es). Ergibt die historische Quelle einen Wert jenseits der
    // Obergrenze, weicht die Rechnung auf das erwartete Wachstum aus —
    // frame-konsistent mit dem Forward-KGV. Hilft auch das nicht unter die
    // Obergrenze, greift unten der bestehende Wächter.
    let nennerFinal = nenner;
    let zaehlerFinal = eigeneBerechnung!.zaehler;
    let zaehlerLabelFinal = eigeneBerechnung!.zaehlerLabel;
    let ausweichNote = "";
    if (bereinigung(eigeneBerechnung!.peg) > PEG_OBERGRENZE && !nenner.geschaetzt) {
      const schaetz = schaetzungsQuelle;
      const schaetzZaehler = kgvForward ?? kgv;
      if (schaetz !== null && schaetzZaehler !== null &&
          bereinigung(schaetzZaehler / schaetz.wert) <= PEG_OBERGRENZE) {
        ausweichNote = `; historische Rate ${nenner.wert.toFixed(1)} % ergäbe PEG ` +
          `${eigeneBerechnung!.peg.toFixed(1)} über der Obergrenze ${PEG_OBERGRENZE} — auf die Schätzung ausgewichen`;
        nennerFinal = schaetz;
        zaehlerFinal = schaetzZaehler;
        zaehlerLabelFinal = kgvForward !== null ? "KGV (forward)" : "KGV (trailing)";
      }
    }
    rohesPeg = zaehlerFinal / nennerFinal.wert;
    quelle = "selbst";
    quellenHinweis = `selbst gerechnet: ${zaehlerLabelFinal} ${zaehlerFinal.toFixed(1)} ÷ ${nennerFinal.wert.toFixed(1)} % ${nennerFinal.label} (${vendorNote}${ausweichNote})`;
    rechnungKopf = `selbst gerechnet: ${zaehlerLabelFinal} ${zaehlerFinal.toFixed(1)} ÷ ${nennerFinal.wert.toFixed(1)} % ${nennerFinal.label} = ${rohesPeg.toFixed(2)} roh`;
  }

  const peg = bereinigung(rohesPeg);
  const rechnung = `${rechnungKopf} · ${bereinigungsText} = ${peg.toFixed(2)} bereinigt`;

  if (peg > PEG_OBERGRENZE) {
    // ANDERS als bei den frühen Ausblendungen bleiben Rohwert und Herleitung
    // erhalten: Ohne sie las sich die wiederkehrende «9.7» wie hardcoded —
    // tatsächlich ist sie KGV ÷ (Rate knapp über 2 %), und genau das muss
    // am Faktor und im Export stehen.
    return {
      peg: null,
      roh: rohesPeg,
      grund: "peg_extrem",
      hinweis: `bereinigtes PEG ${peg.toFixed(1)} über der Obergrenze ${PEG_OBERGRENZE} ` +
        `(${rechnungKopf}) — keine Aussage, Faktor ausgeblendet`,
      quelle,
      rechnung,
    };
  }

  return { peg, roh: rohesPeg, grund: null, hinweis: quellenHinweis, quelle, rechnung };
}
