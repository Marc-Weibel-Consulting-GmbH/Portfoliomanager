import { describe, it, expect } from "vitest";
import { bereinigtesPeg, PEG_OBERGRENZE } from "./bereinigtesPeg";

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

  it("liegt ein Vendor-PEG vor, hat es Vorrang vor der eigenen Rechnung", () => {
    const r = bereinigtesPeg({ ...STANDARD, kgv: 99 });
    expect(r.quelle).toBe("vendor");
    expect(r.peg).toBeCloseTo((1.4 * 1.15) / 1.12, 3);
    expect(r.hinweis).toBeNull();
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
    expect(selbst.rechnung).toContain("KGV 18.3 ÷ 6.0 % 5-Jahres-CAGR");
    expect(selbst.rechnung).toContain("bereinigt");
  });
});
