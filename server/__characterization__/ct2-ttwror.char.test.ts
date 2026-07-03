/**
 * CT-2 — Charakterisierungstests für calculateTTWROR (+ extractPortfolioCashFlows)
 * (server/lib/performanceEngine.ts)
 *
 * Pinnt das IST-Verhalten inkl. Flow-Klassifikation (R-01) und ±50-%-Cap (R-08).
 * Erwartungswerte wurden durch AUSFÜHREN des aktuellen Codes ermittelt.
 */

import { describe, it, expect } from "vitest";
import {
  calculateTTWROR,
  extractPortfolioCashFlows,
  type CashFlow,
} from "../lib/performanceEngine";
import { S1, S2, S5, S13_CRASH20, S13_CRASH60, D } from "./fixtures";

describe("CT-2 extractPortfolioCashFlows (Flow-Klassifikation)", () => {
  it("Szenario 1: Deposit wird als Inflow extrahiert; Buy ist kein externer Flow", () => {
    const flows = extractPortfolioCashFlows(S1.transactions);
    expect(flows).toEqual([{ date: D.mar03, amount: 9500, type: "deposit" }]);
  });

  it("Szenario 2: negativ gespeicherte Entnahme wird zum POSITIVEN Inflow (R-01)", () => {
    const flows = extractPortfolioCashFlows(S2.transactions);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-01:
    // amount = −(−10'000) = +10'000 — die Entnahme wird für TTWROR/IRR als
    // Einzahlung klassifiziert (Typ bleibt 'withdrawal').
    expect(flows).toEqual([
      { date: D.mar03, amount: 20000, type: "deposit" },
      { date: D.mar05, amount: 10000, type: "withdrawal" },
    ]);
  });

  it("Szenario 5: Dividende ist KEIN externer Flow (korrekt — Kontrast zu R-05 in CT-1)", () => {
    const flows = extractPortfolioCashFlows(S5.transactions);
    // Im Gegensatz zu performanceCalculations.buildValuePoints (CT-1, R-05)
    // behandelt die neuere Engine Dividenden korrekt als internen Vorgang.
    expect(flows).toEqual([{ date: D.mar03, amount: 9500, type: "deposit" }]);
  });
});

describe("CT-2 calculateTTWROR", () => {
  it("Szenario 1: Nur-Kauf — TTWROR entspricht der reinen Kursentwicklung", () => {
    const result = calculateTTWROR(S1.valuations, extractPortfolioCashFlows(S1.transactions));
    expect(result.totalReturn).toBeCloseTo(0.05263157894736836, 10);
    expect(result.periodDays).toBe(4);
    // < 365 Tage → keine Annualisierung, periodische Rendite wird ausgewiesen:
    expect(result.annualizedReturn).toBeCloseTo(0.05263157894736836, 10);
    expect(result.dailySeries).toEqual([
      { date: D.mar03, cumulativeReturn: 0 },
      { date: D.mar04, cumulativeReturn: 0.010526315789473717 },
      { date: D.mar05, cumulativeReturn: 0.021052631578947434 },
      { date: D.mar06, cumulativeReturn: 0.042105263157894646 },
      { date: D.mar07, cumulativeReturn: 0.05263157894736836 },
    ]);
  });

  it("Szenario 2: Entnahme als Inflow verzerrt TTWROR auf −48.3 % (R-01, Cap greift)", () => {
    const result = calculateTTWROR(S2.valuations, extractPortfolioCashFlows(S2.transactions));
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-01 (+ R-08):
    // Am 05.03. steht der sign-geflippte Inflow +10'000 im Nenner:
    // r = 10'200 / (20'100 + 10'000) − 1 = −66.1 % → vom ±50-%-Cap auf −50 %
    // gekappt. Kumuliert: −48.27 % statt +3.97 %.
    expect(result.totalReturn).toBeCloseTo(-0.4827205882352943, 10);
    expect(result.dailySeries[2]).toEqual({ date: D.mar05, cumulativeReturn: -0.49750000000000005 });

    // Kontrast (Soll-Verhalten mit korrekt vorzeichen-normalisierten Flows):
    const correctFlows: CashFlow[] = [
      { date: D.mar03, amount: 20000, type: "deposit" },
      { date: D.mar05, amount: -10000, type: "withdrawal" },
    ];
    const correct = calculateTTWROR(S2.valuations, correctFlows);
    expect(correct.totalReturn).toBeCloseTo(0.039705882352941035, 10);
  });

  it("Szenario 13: Crash-Tag −20 % passiert die Engine ungekappt", () => {
    const result = calculateTTWROR(S13_CRASH20.valuations, []);
    expect(result.dailySeries[1].cumulativeReturn).toBeCloseTo(-0.19999999999999996, 10);
    expect(result.totalReturn).toBeCloseTo(-0.18000000000000005, 10);
  });

  it("Szenario 13: Crash-Tag −60 % wird bei −50 % gekappt (R-08)", () => {
    const result = calculateTTWROR(S13_CRASH60.valuations, []);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-08:
    // Der echte Tagesverlust von −60 % wird stillschweigend auf −50 % gekappt;
    // die Serie weicht dauerhaft von der Realität ab.
    expect(result.dailySeries[1].cumulativeReturn).toBe(-0.5);
    expect(result.totalReturn).toBeCloseTo(-0.48750000000000004, 10);
  });

  it("Szenario 9: leere / einelementige Bewertungsserie → 0 ohne NaN", () => {
    expect(calculateTTWROR([], [])).toEqual({
      totalReturn: 0,
      annualizedReturn: 0,
      periodDays: 0,
      dailySeries: [],
    });
    expect(calculateTTWROR([{ date: D.mar03, marketValue: 1000 }], [])).toEqual({
      totalReturn: 0,
      annualizedReturn: 0,
      periodDays: 0,
      dailySeries: [{ date: D.mar03, cumulativeReturn: 0 }],
    });
  });

  it("Szenario 9: MVB = 0 (Division-durch-null-Pfade) → Tagesrendite 0, kein NaN", () => {
    const valuations = [
      { date: D.mar03, marketValue: 0 },
      { date: D.mar04, marketValue: 10000 },
      { date: D.mar05, marketValue: 10100 },
    ];

    // Variante A: Deposit am 04.03. → Nenner = 0 + 10'000, r = 0 (kein Guard nötig).
    const withFlow = calculateTTWROR(valuations, [{ date: D.mar04, amount: 10000, type: "deposit" }]);
    expect(withFlow.totalReturn).toBeCloseTo(0.010000000000000009, 10);
    expect(withFlow.dailySeries.every((p) => Number.isFinite(p.cumulativeReturn))).toBe(true);

    // Variante B: KEIN Flow gemeldet → Nenner = 0 → Guard (denominator <= 0)
    // überspringt den Tag mit Rendite 0 statt NaN/Infinity zu produzieren.
    const noFlow = calculateTTWROR(valuations, []);
    expect(noFlow.totalReturn).toBeCloseTo(0.010000000000000009, 10);
    expect(noFlow.dailySeries[1]).toEqual({ date: D.mar04, cumulativeReturn: 0 });
    expect(noFlow.dailySeries.every((p) => Number.isFinite(p.cumulativeReturn))).toBe(true);
  });
});
