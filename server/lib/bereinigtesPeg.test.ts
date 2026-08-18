import { describe, it, expect } from "vitest";
import { bereinigtesPeg, erwartetesWachstum, PEG_OBERGRENZE } from "./bereinigtesPeg";

/**
 * Befund 2 der Scoring-Prüfung (BCHN.SW): Ein Vendor-PEG von 15.63 lief ohne
 * Wächter in die Bewertung und drückte den Faktor mit 35 % Gewicht auf 0/100.
 * Die 2-%-Ausblendregel galt nur für das forward PEG — der bereinigte
 * trailing-Pfad braucht dieselben Regeln (Schwellen und Gründe-Semantik wie
 * `pegHistory.trailingPeg`).
 */

const STANDARD = {
  vendorPeg: 1.4,
  epsVolatility: 0.3,
  qualityScore: 70,
  epsWachstum5j: 8,
  epsWachstumTTM: 12,
};

describe("bereinigtesPeg", () => {
  it("liefert bei gesundem Profil einen Wert ohne Grund", () => {
    const r = bereinigtesPeg(STANDARD);
    expect(r.peg).not.toBeNull();
    expect(r.grund).toBeNull();
    // Dieselbe Formel wie bisher: vendor × (1 + min(1, vol·0.5)) / (0.7 + q/100·0.6)
    expect(r.peg!).toBeCloseTo((1.4 * 1.15) / 1.12, 3);
  });

  it("blendet aus, wenn kein Vendor-PEG vorliegt", () => {
    expect(bereinigtesPeg({ ...STANDARD, vendorPeg: null }).grund).toBe("peg_fehlt");
    expect(bereinigtesPeg({ ...STANDARD, vendorPeg: -0.5 }).grund).toBe("peg_fehlt");
  });

  it("blendet aus, wenn kein Wachstum belegt ist — der Vendor-Nenner ist dann nicht prüfbar", () => {
    const r = bereinigtesPeg({ ...STANDARD, epsWachstum5j: null, epsWachstumTTM: null });
    expect(r.peg).toBeNull();
    expect(r.grund).toBe("wachstum_fehlt");
    expect(r.hinweis).toMatch(/wachstum/i);
  });

  it("blendet aus, wenn ALLE belegten Wachstumszahlen unter 2 % liegen", () => {
    const r = bereinigtesPeg({ ...STANDARD, epsWachstum5j: 0.7, epsWachstumTTM: 1.1 });
    expect(r.peg).toBeNull();
    expect(r.grund).toBe("wachstum_zu_gering");
  });

  it("eine tragende Wachstumszahl genügt — das Wachstum ist hier Plausibilitätsprüfung, kein Nenner", () => {
    // 5j-CAGR schwach (Basisjahr-Effekt), TTM klar über der Schwelle → Wert bleibt.
    const r = bereinigtesPeg({ ...STANDARD, epsWachstum5j: 0.7, epsWachstumTTM: 12 });
    expect(r.grund).toBeNull();
    expect(r.peg).not.toBeNull();
    // Und umgekehrt: nur das 5j-CAGR belegt und tragfähig.
    const nur5j = bereinigtesPeg({ ...STANDARD, epsWachstum5j: 6, epsWachstumTTM: null });
    expect(nur5j.peg).not.toBeNull();
  });

  it("blendet absurde Vendor-Werte aus (Befund BCHN: 15.63 → nicht 0/100)", () => {
    const r = bereinigtesPeg({ ...STANDARD, vendorPeg: 15.63 });
    expect(r.peg).toBeNull();
    expect(r.grund).toBe("peg_extrem");
    expect(r.hinweis).toContain(String(PEG_OBERGRENZE));
  });

  it("Randfälle: NaN und fehlende Volatilität kippen nicht in erfundene Werte", () => {
    expect(bereinigtesPeg({ ...STANDARD, vendorPeg: Number.NaN }).grund).toBe("peg_fehlt");
    const ohneVol = bereinigtesPeg({ ...STANDARD, epsVolatility: null });
    // Ohne Volatilität gilt der bisherige Standard-Aufschlag 0.2 — kein null.
    expect(ohneVol.peg).toBeCloseTo((1.4 * 1.2) / 1.12, 3);
  });

  it("rechnet das PEG selbst (KGV ÷ Wachstum), wenn der Vendor keins liefert", () => {
    // Screener-Befund: Viele Nicht-US-Titel haben kein Vendor-PEG, obwohl KGV
    // und belegtes Wachstum vorliegen — die Zahl fehlt beim Vendor, nicht in
    // den Daten. 18.3er-KGV bei 6 % Wachstum → rohes PEG 3.05, dann dieselbe
    // Bereinigung wie beim Vendor-Wert.
    const r = bereinigtesPeg({ ...STANDARD, vendorPeg: null, kgv: 18.3, epsWachstum5j: 6, epsWachstumTTM: null });
    expect(r.grund).toBeNull();
    expect(r.quelle).toBe("selbst");
    expect(r.peg).toBeCloseTo(((18.3 / 6) * 1.15) / 1.12, 3);
    expect(r.hinweis).toMatch(/selbst gerechnet/);
  });

  it("selbst gerechnet: 5j-Wachstum führt, TTM nur als Rückfall", () => {
    const beide = bereinigtesPeg({ ...STANDARD, vendorPeg: null, kgv: 20, epsWachstum5j: 5, epsWachstumTTM: 10 });
    expect(beide.peg).toBeCloseTo(((20 / 5) * 1.15) / 1.12, 3); // 5j, nicht TTM
    const nurTtm = bereinigtesPeg({ ...STANDARD, vendorPeg: null, kgv: 20, epsWachstum5j: null, epsWachstumTTM: 10 });
    expect(nurTtm.peg).toBeCloseTo(((20 / 10) * 1.15) / 1.12, 3);
  });

  it("selbst gerechnet gelten dieselben Wächter: Mini-Wachstum und Extremwerte bleiben ausgeblendet", () => {
    // Wachstum unter 2 % ist als NENNER erst recht tabu (Division durch fast null).
    expect(bereinigtesPeg({ ...STANDARD, vendorPeg: null, kgv: 15, epsWachstum5j: 1, epsWachstumTTM: 0.5 }).grund)
      .toBe("wachstum_zu_gering");
    // KGV 40 bei 2.5 % Wachstum → rohes PEG 16 → jenseits der Obergrenze.
    expect(bereinigtesPeg({ ...STANDARD, vendorPeg: null, kgv: 40, epsWachstum5j: 2.5, epsWachstumTTM: null }).grund)
      .toBe("peg_extrem");
    // Ohne KGV bleibt es beim bisherigen «peg_fehlt».
    expect(bereinigtesPeg({ ...STANDARD, vendorPeg: null, kgv: null }).grund).toBe("peg_fehlt");
  });

  it("liegt ein bestätigtes Vendor-PEG vor, hat es Vorrang vor der eigenen Rechnung", () => {
    // KGV 11.2 bei 8 % Wachstum → eigene Rechnung 1.40 = Vendor-Wert. Bestätigt.
    const r = bereinigtesPeg({ ...STANDARD, kgv: 11.2 });
    expect(r.quelle).toBe("vendor");
    expect(r.peg).toBeCloseTo((1.4 * 1.15) / 1.12, 3);
    expect(r.hinweis).toBeNull();
  });

  // KIMI Punkt 7, nachgeschärft am Roche-Fall: Weichen Vendor-Wert und eigene
  // Rechnung um mehr als Faktor 2 voneinander ab, ist EINE der beiden Zahlen
  // kaputt — welche, ist nicht entscheidbar. Es zählt die VORSICHTIGERE
  // (das höhere PEG, weniger Punkte): Bei widersprüchlichen Quellen gibt es
  // nie die günstigere Lesart. Vorher gewann die eigene Rechnung — und bei
  // Roche machte ein kaputter Schätz-Nenner (45.8 %) aus Vendor 1.68 ein
  // 100/100-«Schnäppchen» von 0.49.
  describe("Konsistenz-Gegenprobe gegen die eigene Rechnung", () => {
    it("bei Widerspruch über Faktor 2 zählt die vorsichtigere Zahl — hier der Vendor-Wert", () => {
      // Eigene Rechnung: 20 ÷ 8 = 2.50. Vendor 6.00 → Faktor 2.4 auseinander.
      const r = bereinigtesPeg({ ...STANDARD, vendorPeg: 6, kgv: 20 });
      expect(r.quelle).toBe("vendor");
      expect(r.peg).toBeCloseTo((6 * 1.15) / 1.12, 3);
      expect(r.hinweis).toContain("widersprechen sich");
      expect(r.rechnung).toContain("vorsichtigere Zahl");
    });

    it("in der Gegenrichtung zählt die eigene Rechnung — weil sie die vorsichtigere ist", () => {
      // Eigene Rechnung: 24 ÷ 8 = 3.00. Vendor 0.9 → Faktor 3.3 auseinander.
      const r = bereinigtesPeg({ ...STANDARD, vendorPeg: 0.9, kgv: 24 });
      expect(r.quelle).toBe("selbst");
      expect(r.peg).toBeCloseTo(((24 / 8) * 1.15) / 1.12, 3);
      expect(r.hinweis).toContain("widersprechen sich");
    });

    it("ohne KGV bleibt der Vendor-Wert ungeprüft in Kraft — keine Gegenprobe möglich", () => {
      const r = bereinigtesPeg({ ...STANDARD, kgv: null });
      expect(r.quelle).toBe("vendor");
      expect(r.hinweis).toBeNull();
    });

    it("Roche-Fall: kaputte Schätzquelle über dem Korridor trägt keinen Gegen-Nenner — Vendor bleibt", () => {
      // Einzige Quelle «erwartetes Wachstum» 45.8 % (Core-Schätzung ÷
      // IFRS-Gewinn, Definitionsbruch) — über der 35-%-Obergrenze, wird
      // übersprungen. Der plausible Vendor-Wert 1.68 bleibt in Kraft,
      // statt von einer 0.52er-Eigenrechnung verdrängt zu werden.
      const r = bereinigtesPeg({
        ...STANDARD, vendorPeg: 1.68, kgv: 23.6,
        epsWachstum5j: null, epsWachstumTTM: null, wachstumRatenMittel: null, wachstumErwartet: 45.8,
      });
      expect(r.quelle).toBe("vendor");
      expect(r.peg).toBeCloseTo((1.68 * 1.15) / 1.12, 3);
    });

    it("landet die vorsichtigere Zahl jenseits der Obergrenze, wird ausgeblendet statt geraten", () => {
      // Vendor 1.4 wirkt gesund, aber KGV 99 bei 8 % Wachstum heisst PEG 12.4 —
      // der Vendor-Nenner (implizit ~70 % Wachstum) ist ein Basiseffekt.
      const r = bereinigtesPeg({ ...STANDARD, kgv: 99 });
      expect(r.grund).toBe("peg_extrem");
      expect(r.peg).toBeNull();
    });
  });

  // Sanofi-Befund: EODHDs PEG-Feld lieferte ~50 (FactSet: 1.20). Ein Wert,
  // der bereinigt jenseits der Obergrenze läge, trägt keine Aussage — er ist
  // kein «vorsichtiger» Wert, sondern gar keiner. Er gilt als fehlend, und
  // die Selbstrechnung übernimmt mit allen Wächtern.
  describe("unbrauchbarer Vendor-Wert (jenseits der Obergrenze)", () => {
    it("Sanofi-Fall: Müll-Vendor gilt als fehlend — die Selbstrechnung übernimmt", () => {
      const r = bereinigtesPeg({
        ...STANDARD, vendorPeg: 50, kgv: 12, kgvForward: 8.6,
        epsWachstum5j: null, epsWachstumTTM: null, wachstumErwartet: 6.1,
      });
      expect(r.quelle).toBe("selbst");
      expect(r.peg).toBeCloseTo(((8.6 / 6.1) * 1.15) / 1.12, 3);
      expect(r.hinweis).toContain("unbrauchbar");
    });

    it("ohne eigene Rechenbasis bleibt es beim Ausblenden mit Grund", () => {
      const r = bereinigtesPeg({
        ...STANDARD, vendorPeg: 50, kgv: null,
        epsWachstum5j: 8, epsWachstumTTM: null,
      });
      expect(r.peg).toBeNull();
      expect(r.grund).toBe("peg_extrem");
      expect(r.hinweis).toContain("unbrauchbar");
    });
  });

  // Frame-Konsistenz: Vendor-PEGs und FactSet & Co. rechnen mit erwartetem
  // Wachstum das Forward-KGV. Ein Schätzungs-Nenner gegen das trailing KGV
  // überzeichnet das PEG, wenn die berichteten Gewinne gedrückt sind (Roche:
  // 23.6 ÷ 6.1 = 3.9 statt 18.3 ÷ 6.1 = 3.0) — und kippte den Vergleich mit
  // dem Vendor-Wert fälschlich in den Widerspruchsfall.
  describe("KGV-Paarung nach Nenner-Zeitrahmen", () => {
    it("Schätzungs-Nenner paart mit dem Forward-KGV", () => {
      const r = bereinigtesPeg({
        ...STANDARD, vendorPeg: null, kgv: 20, kgvForward: 15,
        epsWachstum5j: null, epsWachstumTTM: null, wachstumErwartet: 10,
      });
      expect(r.peg).toBeCloseTo(((15 / 10) * 1.15) / 1.12, 3);
      expect(r.rechnung).toContain("KGV (forward) 15.0");
    });

    it("historische Nenner bleiben beim Trailing-KGV", () => {
      const r = bereinigtesPeg({
        ...STANDARD, vendorPeg: null, kgv: 20, kgvForward: 15,
        epsWachstum5j: 10, epsWachstumTTM: null,
      });
      expect(r.peg).toBeCloseTo(((20 / 10) * 1.15) / 1.12, 3);
      expect(r.rechnung).toContain("KGV (trailing) 20.0");
    });

    it("Roche-Fall komplett: Vendor plausibel, eigene Forward-Rechnung bestätigt ihn", () => {
      // Eigene Rechnung 18.28 ÷ 6.07 = 3.01; Vendor 1.68 → Faktor 1.79 —
      // KEIN Widerspruch (unter 2), der Vendor-Wert bleibt in Kraft.
      const r = bereinigtesPeg({
        ...STANDARD, vendorPeg: 1.68, kgv: 23.6, kgvForward: 18.28,
        epsWachstum5j: null, epsWachstumTTM: null, wachstumErwartet: 6.07,
      });
      expect(r.quelle).toBe("vendor");
      expect(r.peg).toBeCloseTo((1.68 * 1.15) / 1.12, 3);
    });
  });

  // Roche-Befund, Wurzel: «erwartetes Wachstum» verglich die Analystenschätzung
  // (Core-EPS-Basis) mit dem berichteten IFRS-EPS — bei grosser Core/IFRS-Lücke
  // entsteht ein künstlicher Sprung (+45.8 % statt ~8 %). Schätzung gegen
  // Schätzung hat dieselbe Definition auf beiden Seiten.
  describe("erwartetesWachstum (Schätzung gegen Schätzung)", () => {
    it("rechnet den Schritt zwischen laufender und nächster Jahresschätzung", () => {
      expect(erwartetesWachstum(20, 21.6)).toBeCloseTo(8, 5);
      expect(erwartetesWachstum(2.5, 2.4)).toBeCloseTo(-4, 5);
    });

    it("liefert ohne belastbare Basis keinen Wert — kein Mini-Nenner, kein null-Vergleich", () => {
      expect(erwartetesWachstum(null, 21.6)).toBeNull();
      expect(erwartetesWachstum(20, null)).toBeNull();
      expect(erwartetesWachstum(0.05, 2)).toBeNull();   // Mini-Basis → Basiseffekt
      expect(erwartetesWachstum(-1, 2)).toBeNull();
      expect(erwartetesWachstum(Number.NaN, 2)).toBeNull();
    });
  });

  // Schindler-Befund: Der 5-Jahres-CAGR ist eine Endpunkt-Rechnung — ein
  // starkes Basisjahr drückt ihn unter 2 %, und das PEG verschwand, obwohl
  // die Jahresraten im Mittel klar wachsen (und Yahoo längst ein PEG aus
  // erwartetem Wachstum zeigt).
  it("robustes Raten-Mittel trägt den Nenner, wenn CAGR und TTM versagen", () => {
    const r = bereinigtesPeg({
      ...STANDARD, vendorPeg: null, kgv: 26,
      epsWachstum5j: 0.8, epsWachstumTTM: null, wachstumRatenMittel: 5.4,
    });
    expect(r.grund).toBeNull();
    expect(r.peg).toBeCloseTo(((26 / 5.4) * 1.15) / 1.12, 3);
    expect(r.hinweis).toContain("Raten-Mittel");
  });

  it("erwartetes Wachstum ist die letzte Stufe und wird als Schätzung benannt", () => {
    const r = bereinigtesPeg({
      ...STANDARD, vendorPeg: null, kgv: 26,
      epsWachstum5j: 0.8, epsWachstumTTM: null, wachstumRatenMittel: 1.2, wachstumErwartet: 7.9,
    });
    expect(r.grund).toBeNull();
    expect(r.peg).toBeCloseTo(((26 / 7.9) * 1.15) / 1.12, 3);
    expect(r.hinweis).toContain("Analystenschätzung");
  });

  it("die Rangfolge bleibt: eine tragfähige frühere Quelle schlägt die spätere", () => {
    const r = bereinigtesPeg({
      ...STANDARD, vendorPeg: null, kgv: 20,
      epsWachstum5j: 5, epsWachstumTTM: null, wachstumRatenMittel: 10, wachstumErwartet: 15,
    });
    expect(r.peg).toBeCloseTo(((20 / 5) * 1.15) / 1.12, 3); // 5j-CAGR, nicht 10 oder 15
  });

  it("bleiben alle vier Quellen unter 2 %, bleibt das PEG ausgeblendet — mit Beleg im Hinweis", () => {
    const r = bereinigtesPeg({
      ...STANDARD, vendorPeg: null, kgv: 20,
      epsWachstum5j: 1, epsWachstumTTM: 0.5, wachstumRatenMittel: 1.8, wachstumErwartet: 1.2,
    });
    expect(r.grund).toBe("wachstum_zu_gering");
    expect(r.hinweis).toContain("geprüft:");
  });

  // Burkhalter-Befund: Die Rangfolge nahm die ERSTE tragfähige historische
  // Quelle, auch wenn sie ein PEG jenseits der Obergrenze ergab (KGV 23.3 ÷
  // 2.4 % fusionszerdrückter 5j-CAGR = 9.7 → ausgeblendet), während
  // MarketScreener aus der intakten Schätzung ~1.9 zeigt. Ergibt die
  // historische Quelle einen Wert über der Obergrenze, weicht die Rechnung
  // auf das erwartete Wachstum aus (frame-konsistent mit dem Forward-KGV).
  describe("Ausweichen auf die Schätzquelle (Burkhalter-Befund)", () => {
    it("historische Rate über der Obergrenze → die Analystenschätzung übernimmt", () => {
      const r = bereinigtesPeg({
        vendorPeg: null, epsVolatility: null, qualityScore: 82,
        epsWachstum5j: 2.4, epsWachstumTTM: null, wachstumRatenMittel: null,
        wachstumErwartet: 10.9, kgv: 23.3, kgvForward: 20.9,
      });
      expect(r.quelle).toBe("selbst");
      // roh = Forward-KGV 20.9 ÷ 10.9 % = 1.92; × 1.2 (Standard-Aufschlag) ÷ 1.192
      expect(r.peg).toBeCloseTo(((20.9 / 10.9) * 1.2) / (0.7 + 0.82 * 0.6), 2);
      expect(r.hinweis).toContain("ausgewichen");
    });

    it("ohne Schätzquelle bleibt es beim Ausblenden — jetzt mit Herleitung im Hinweis", () => {
      const r = bereinigtesPeg({
        vendorPeg: null, epsVolatility: null, qualityScore: 82,
        epsWachstum5j: 2.4, epsWachstumTTM: null, kgv: 23.3,
      });
      expect(r.peg).toBeNull();
      expect(r.grund).toBe("peg_extrem");
      // Die «9.7» muss sich selbst erklären: Zähler, Nenner und Rohwert
      // stehen im Hinweis, der Rohwert bleibt für den Export erhalten.
      expect(r.hinweis).toContain("5-Jahres-CAGR");
      expect(r.roh).toBeCloseTo(23.3 / 2.4, 2);
      expect(r.rechnung).not.toBeNull();
    });

    it("hilft auch die Schätzquelle nicht unter die Obergrenze, bleibt es ausgeblendet", () => {
      const r = bereinigtesPeg({
        vendorPeg: null, epsVolatility: null, qualityScore: 82,
        epsWachstum5j: 2.4, epsWachstumTTM: null, wachstumErwartet: 2.1,
        kgv: 23.3, kgvForward: 20.9,
      });
      expect(r.peg).toBeNull();
      expect(r.grund).toBe("peg_extrem");
    });
  });

  // FDJ-Befund (FDJU.PA): Einmaleffekte drückten den Gewinn auf ein
  // Mini-Niveau — trailing KGV 172, «erwartetes Wachstum» +1944 %, PEG 0.09,
  // 100/100 Punkte. Ein Basiseffekt ist keine tragfähige Wachstumsrate.
  it("FDJ-Fall: Basiseffekt-Wachstum über der Obergrenze trägt den Nenner nicht", () => {
    const r = bereinigtesPeg({
      ...STANDARD, vendorPeg: null, kgv: 172.3,
      epsWachstum5j: null, epsWachstumTTM: null, wachstumRatenMittel: null, wachstumErwartet: 1944.5,
    });
    expect(r.peg).toBeNull();
    expect(r.grund).toBe("wachstum_extrem");
    expect(r.hinweis).toMatch(/Basiseffekt/);
    expect(r.hinweis).toContain("1944");
  });

  it("eine extreme Quelle wird übersprungen, eine tragfähige spätere übernimmt", () => {
    // TTM +300 % (Erholungs-Basiseffekt), aber das robuste Raten-Mittel 8 %
    // trägt — die Rangfolge überspringt die unplausible Quelle.
    const r = bereinigtesPeg({
      ...STANDARD, vendorPeg: null, kgv: 20,
      epsWachstum5j: null, epsWachstumTTM: 300, wachstumRatenMittel: 8,
    });
    expect(r.grund).toBeNull();
    expect(r.peg).toBeCloseTo(((20 / 8) * 1.15) / 1.12, 3);
    expect(r.hinweis).toContain("Raten-Mittel");
  });

  it("liefert die komplette Herleitung als Rechnung — für die Klick-Nachvollziehbarkeit", () => {
    const vendor = bereinigtesPeg(STANDARD);
    expect(vendor.rechnung).toContain("Vendor-PEG 1.40");
    expect(vendor.rechnung).toContain("Volatilitätsaufschlag");
    expect(vendor.rechnung).toContain("Qualitätsmultiplikator");
    const selbst = bereinigtesPeg({ ...STANDARD, vendorPeg: null, kgv: 18.3, epsWachstum5j: 6, epsWachstumTTM: null });
    // «trailing» steht dabei, weil der KGV-Faktor daneben das Forward-KGV
    // zeigt — zwei verschiedene Zahlen ohne Beschriftung verwirren (Roche).
    expect(selbst.rechnung).toContain("KGV (trailing) 18.3 ÷ 6.0 % 5-Jahres-CAGR");
    expect(selbst.rechnung).toContain("bereinigt");
  });
});
