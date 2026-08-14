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

  it("blendet unter 2 % Wachstum aus statt eine wertlose Zahl zu liefern", () => {
    // Gleiche Semantik wie pegHistory: das 5j-CAGR führt; liegt es unter der
    // Schwelle, wird NICHT auf TTM ausgewichen.
    const r = bereinigtesPeg({ ...STANDARD, epsWachstum5j: 0.7 });
    expect(r.peg).toBeNull();
    expect(r.grund).toBe("wachstum_zu_gering");
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
});
