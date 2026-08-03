/**
 * Mindestabdeckung für gewichtete Scores.
 *
 * Anlass: `calculateStockScore` normalisierte auf die belegte Gewichtung, ohne
 * Untergrenze. Eine einzige vorhandene Kennzahl bestimmte damit den ganzen
 * Score. Gemessen am Universum (289 Titel, 2026-08-03):
 *
 *  - GLD.US (Gold-ETF): 87.5 «ausgezeichnet», allein aus Beta 0.41 — 20 % der
 *    Gewichtung. Ein Gold-ETF hat weder KGV noch Dividendenrendite.
 *  - VBTC.SW (Bitcoin-ETN): 0 «schwach», aus gar keiner Kennzahl.
 *  - 63 von 289 Titeln (21.8 %) waren zu weniger als 70 % belegt.
 *
 * Dieselbe Konsequenz wie beim Regime-Verlauf (PR #235): keine Zahl statt einer
 * schwach belegten.
 */

import { describe, it, expect } from "vitest";
import { calculateStockScore, MIN_ABDECKUNG_SCORE, type StockMetrics } from "../scoring";
import { calculateQualityScore } from "../analytics/qualityMomentumEngine";

describe("calculateStockScore — Mindestabdeckung", () => {
  it("GLD.US: eine einzige Kennzahl ergibt keinen Score mehr", () => {
    const r = calculateStockScore("GLD.US", { beta: 0.41, ytdPerformance: -6.25 }, undefined, "ETF");
    expect(r.totalScore).toBeNull();
    expect(r.abdeckung).toBeCloseTo(0.20, 3);
  });

  it("VBTC.SW: gar keine Kennzahl ergibt keinen Score — nicht die Note 0", () => {
    const r = calculateStockScore("VBTC.SW", {}, undefined, "ETF");
    expect(r.totalScore).toBeNull();
    expect(r.abdeckung).toBe(0);
  });

  it("ein vollständig belegter Titel behält seinen Score", () => {
    // ABB, Dividendenprofil, alle vier Kennzahlen vorhanden.
    const abb: StockMetrics = {
      dividendYield: 1.51, peRatio: 35.98, beta: 1.026, volatility: 27.15,
    };
    const r = calculateStockScore("ABBN.SW", abb, undefined, "Dividendenaktien");
    expect(r.abdeckung).toBe(1);
    expect(r.totalScore).not.toBeNull();
    expect(r.totalScore).toBeCloseTo(26.63, 1);
  });

  it("die Teilscores bleiben auch ohne Gesamtscore sichtbar", () => {
    // Die Begründung soll nicht verschwinden, nur die Note.
    const r = calculateStockScore("GLD.US", { beta: 0.41 }, undefined, "ETF");
    expect(r.totalScore).toBeNull();
    const belegte = r.subScores.filter((s) => s.value !== null);
    expect(belegte).toHaveLength(1);
    expect(belegte[0].metric).toContain("Beta");
  });

  it("knapp über der Schwelle wird bewertet, knapp darunter nicht", () => {
    // Dividendenprofil: Rendite .40 + KGV .30 = 0.70 -> über 0.60.
    const drueber = calculateStockScore("X", { dividendYield: 3, peRatio: 15 }, undefined, "Dividendenaktien");
    expect(drueber.abdeckung).toBeCloseTo(0.70, 3);
    expect(drueber.totalScore).not.toBeNull();

    // Nur KGV .30 + Beta .20 = 0.50 -> unter 0.60.
    const drunter = calculateStockScore("Y", { peRatio: 15, beta: 1.0 }, undefined, "Dividendenaktien");
    expect(drunter.abdeckung).toBeCloseTo(0.50, 3);
    expect(drunter.totalScore).toBeNull();
  });

  it("die Abdeckung wird auch bei bewertetem Titel ausgewiesen", () => {
    const r = calculateStockScore("X", { dividendYield: 3, peRatio: 15 }, undefined, "Dividendenaktien");
    expect(r.abdeckung).toBeGreaterThanOrEqual(MIN_ABDECKUNG_SCORE);
  });
});

describe("calculateQualityScore — dieselbe Schwelle", () => {
  const voll = { roe: 18, debtToEquity: 0.5, fcfYield: 5, grossMargin: 45 };

  it("vollständig belegt ergibt eine Note", () => {
    const r = calculateQualityScore(voll);
    expect(r.dataAvailable).toBe(true);
    expect(r.grade).not.toBe("N/A");
  });

  it("allein die Eigenkapitalrendite reicht nicht mehr für eine Note", () => {
    // ROE trägt 0.35 von 1.0 — vorher genügte das, weil nur totalWeight === 0
    // als «keine Daten» galt.
    const r = calculateQualityScore({ roe: 18, debtToEquity: null, fcfYield: null, grossMargin: null });
    expect(r.grade).toBe("N/A");
    expect(r.dataAvailable).toBe(false);
  });

  it("ROE plus Verschuldung (0.60) erreicht die Schwelle genau", () => {
    const r = calculateQualityScore({ roe: 18, debtToEquity: 0.5, fcfYield: null, grossMargin: null });
    expect(r.dataAvailable).toBe(true);
    expect(r.grade).not.toBe("N/A");
  });

  it("gar keine Kennzahl bleibt N/A", () => {
    const r = calculateQualityScore({ roe: null, debtToEquity: null, fcfYield: null, grossMargin: null });
    expect(r.grade).toBe("N/A");
    expect(r.dataAvailable).toBe(false);
  });

  it("eine fehlende FCF-Rendite kippt eine sonst belegte Beurteilung nicht", () => {
    // Der Platzhalter in signalsRouter lieferte früher immer einen Wert. Jetzt
    // kann er fehlen — die übrigen 0.75 tragen weiterhin.
    const r = calculateQualityScore({ ...voll, fcfYield: null });
    expect(r.dataAvailable).toBe(true);
  });
});
