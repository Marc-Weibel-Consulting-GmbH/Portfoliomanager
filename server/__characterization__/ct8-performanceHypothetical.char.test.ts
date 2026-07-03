/**
 * CT-8 — Charakterisierungstests für getRealTwrSeriesFromTransactions + stitchSeries
 * (server/performanceHypothetical.ts)
 *
 * Pinnt das stille «Glätten» der Chart-TWR (R-08):
 * - Tagesrenditen > ±15 % werden gekappt (Szenario 13, Crash-Tag −20 %),
 * - Preissprünge > 50 % werden verworfen und forward-gefüllt (Szenario 11,
 *   Split-artiger Sprung — ein 2:1-Split wird damit für immer falsch bewertet).
 * Erwartungswerte wurden durch AUSFÜHREN des aktuellen Codes ermittelt.
 *
 * DB-Mocking: nur die Daten-Loader — getDb() liefert ein Double, das für
 * `stocks` die Fixture-Stammdaten und für `historicalPrices` die Fixture-Kurse
 * zurückgibt (Unterscheidung über die an .from() übergebene Schema-Tabelle).
 * FX wird nicht angefasst (CHF-Titel → convertToCHF wird nie aufgerufen).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { S11, S13_TWR, D } from "./fixtures";

const h = vi.hoisted(() => ({
  stockRow: null as any,
  priceRows: [] as any[],
}));

vi.mock("../db", async () => {
  const { stocks } = await import("../../drizzle/schema");
  const db = {
    select: () => ({
      from: (table: any) => ({
        where: () =>
          table === stocks
            ? { limit: () => Promise.resolve(h.stockRow ? [h.stockRow] : []) }
            : { orderBy: () => Promise.resolve([...h.priceRows]) },
      }),
    }),
  };
  return { getDb: async () => db };
});

import {
  getRealTwrSeriesFromTransactions,
  stitchSeries,
  type PerformancePoint,
} from "../performanceHypothetical";

beforeEach(() => {
  h.stockRow = null;
  h.priceRows = [];
});

describe("CT-8 getRealTwrSeriesFromTransactions", () => {
  it("Szenario 13: Crash-Tag −20 % wird auf −15 % gekappt (R-08)", async () => {
    h.stockRow = S13_TWR.stockRow;
    h.priceRows = S13_TWR.priceRows;

    const series = await getRealTwrSeriesFromTransactions(
      D.mar03, D.mar05, [], S13_TWR.initialHoldings, S13_TWR.initialCash
    );

    expect(series.map((p) => p.date)).toEqual([D.mar03, D.mar04, D.mar05]);
    expect(series.map((p) => p.segment)).toEqual(["real", "real", "real"]);
    // Die BEWERTUNG bleibt korrekt (100 Aktien × Kurs):
    expect(series.map((p) => p.portfolioValueCHF)).toEqual([100000, 80000, 82000]);

    expect(series[0].portfolioReturn).toBe(0);
    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-08:
    // Tagesrendite −20 % > MAX_DAILY_CHANGE (15 %) → die ausgewiesene Rendite
    // wird stillschweigend auf −15 % gekappt, obwohl das Portfolio real −20 %
    // verlor (portfolioValueCHF 80'000 steht direkt daneben).
    expect(series[1].portfolioReturn).toBeCloseTo(-0.15, 12);
    // Folgetag +2.5 % wird auf die GEKAPPTE Serie aufgezinst:
    // (1 − 0.15) · 1.025 − 1 = −0.12875 (real wäre 0.8 · 1.025 − 1 = −0.18).
    expect(series[2].portfolioReturn).toBeCloseTo(-0.12875, 12);
  });

  it("Szenario 11: Split-Sprung −51 % wird verworfen und forward-gefüllt (R-08)", async () => {
    h.stockRow = S11.stockRow;
    h.priceRows = S11.priceRows;

    const series = await getRealTwrSeriesFromTransactions(
      D.mar03, D.mar05, [], S11.initialHoldings, S11.initialCash
    );

    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-08 (+ R-11):
    // Kurs 100 → 49 (−51 %) überschreitet den 50-%-Preisfilter → der neue Kurs
    // wird verworfen und mit 100 forward-gefüllt; auch 49.5 am Folgetag bleibt
    // > 50 % unter dem Forward-Fill. Ein 2:1-Split friert die Bewertung also
    // dauerhaft auf dem Vor-Split-Kurs ein — Rendite und Wert bewegen sich nie.
    expect(series.map((p) => p.portfolioValueCHF)).toEqual([10000, 10000, 10000]);
    expect(series.map((p) => p.portfolioReturn)).toEqual([0, 0, 0]);
  });
});

describe("CT-8 stitchSeries", () => {
  const hypo: PerformancePoint[] = [
    { date: D.mar03, portfolioReturn: 0, portfolioValueCHF: 10000, segment: "hypothetical" },
    { date: D.mar04, portfolioReturn: 0.1, portfolioValueCHF: 11000, segment: "hypothetical" },
  ];
  const real: PerformancePoint[] = [
    { date: D.mar05, portfolioReturn: 0, portfolioValueCHF: 10000, segment: "real" },
    { date: D.mar06, portfolioReturn: 0.05, portfolioValueCHF: 10500, segment: "real" },
  ];

  it("leere Hypo-Serie → Real-Serie unverändert (und umgekehrt)", () => {
    expect(stitchSeries([], real)).toEqual(real);
    expect(stitchSeries(hypo, [])).toEqual(hypo);
    expect(stitchSeries([], [])).toEqual([]);
  });

  it("verkettet Renditen multiplikativ und skaliert die Real-Werte", () => {
    const stitched = stitchSeries(hypo, real);

    expect(stitched).toHaveLength(4);
    expect(stitched.slice(0, 2)).toEqual(hypo); // Hypo-Teil unverändert

    // Real-Teil: (1 + 0.1) · (1 + r) − 1; Werte × (1 + 0.1).
    expect(stitched[2].portfolioReturn).toBeCloseTo(0.1, 12);
    expect(stitched[2].portfolioValueCHF).toBeCloseTo(11000, 10);
    expect(stitched[3].portfolioReturn).toBeCloseTo(0.155, 12);
    expect(stitched[3].portfolioValueCHF).toBeCloseTo(11550, 10);
    expect(stitched[2].segment).toBe("real");

    // Kontext R-08: endet die Hypo-Serie auf einem GEKAPPTEN Wert (z. B. −15 %
    // statt −20 %, s. o.), wird das falsche Niveau hier auf die gesamte
    // Real-Serie weiterverkettet — der Fehler bleibt im Chart dauerhaft sichtbar.
  });
});
