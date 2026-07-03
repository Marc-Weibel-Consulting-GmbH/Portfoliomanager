/**
 * CT-8 — Charakterisierungstests für getRealTwrSeriesFromTransactions + stitchSeries
 * (server/performanceHypothetical.ts)
 *
 * vorher (R-08): pinnte das stille «Glätten» der Chart-TWR — Tagesrenditen
 * > ±15 % wurden gekappt, Preissprünge > 50 % verworfen und forward-gefüllt.
 * Nach dem R-08-Fix werden Renditen NIE mutiert: der Crash-Tag −20 % passiert
 * ungekappt (Szenario 13), der Split-Sprung −51 % wird vertraut (Szenario 11).
 * Mit adjustedClose-Daten (R-11, Szenario 11_ADJ) ist der Split-Sprung in der
 * Serie bereits bereinigt. Erwartungswerte durch AUSFÜHREN des Codes ermittelt.
 *
 * DB-Mocking: nur die Daten-Loader — getDb() liefert ein Double, das für
 * `stocks` die Fixture-Stammdaten und für `historicalPrices` die Fixture-Kurse
 * zurückgibt (Unterscheidung über die an .from() übergebene Schema-Tabelle).
 * FX wird nicht angefasst (CHF-Titel → convertToCHF wird nie aufgerufen).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { S11, S11_ADJ, S13_TWR, D } from "./fixtures";

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
  it("Szenario 13: Crash-Tag −20 % passiert ungekappt (R-08-Fix)", async () => {
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
    // vorher (R-08): Tagesrendite −20 % > MAX_DAILY_CHANGE (15 %) → die Rendite
    // wurde stillschweigend auf −15 % gekappt (series[1] = −0.15, series[2] =
    // −0.12875). Jetzt stimmt die Rendite mit der Bewertung überein:
    expect(series[1].portfolioReturn).toBeCloseTo(-0.20, 12);
    // Folgetag +2.5 % auf die ECHTE Serie aufgezinst: 0.8 · 1.025 − 1 = −0.18.
    expect(series[2].portfolioReturn).toBeCloseTo(-0.18, 12);
  });

  it("Szenario 11: Split-Sprung −51 % wird vertraut, nicht mehr verworfen (R-08-Fix)", async () => {
    h.stockRow = S11.stockRow;
    h.priceRows = S11.priceRows;

    const series = await getRealTwrSeriesFromTransactions(
      D.mar03, D.mar05, [], S11.initialHoldings, S11.initialCash
    );

    // vorher (R-08): Kurs 100 → 49 (−51 %) überschritt den 50-%-Preisfilter →
    // der neue Kurs wurde verworfen und mit 100 forward-gefüllt; Wert und
    // Rendite bewegten sich nie ([10000, 10000, 10000] / [0, 0, 0]).
    // Jetzt wird der Sprung übernommen: bei ROHEN close-Daten (ohne
    // adjustedClose) zeigt die Serie den Split als echten −51-%-Verlust —
    // die Korrektur dafür ist adjustedClose (R-11, s. Szenario 11_ADJ).
    expect(series.map((p) => p.portfolioValueCHF)).toEqual([10000, 4900, 4950]);
    expect(series[0].portfolioReturn).toBe(0);
    expect(series[1].portfolioReturn).toBeCloseTo(-0.51, 12);
    // Tag 3: (1 − 0.51) · (4950/4900) − 1 = −0.505
    expect(series[2].portfolioReturn).toBeCloseTo(-0.505, 12);
  });

  it("Szenario 11_ADJ: mit adjustedClose ist der Split-Sprung bereinigt (R-11)", async () => {
    h.stockRow = S11_ADJ.stockRow;
    h.priceRows = S11_ADJ.priceRows;

    const series = await getRealTwrSeriesFromTransactions(
      D.mar03, D.mar05, [], S11_ADJ.initialHoldings, S11_ADJ.initialCash
    );

    // R-11: die Serie liest adjustedClose ?? close — der rohe close (100) am
    // Vor-Split-Tag wird ignoriert, bewertet wird mit 50/49/49.5. Der Split
    // erscheint als reale −2-%-Bewegung statt als −51-%-Crash.
    // Dokumentierter Tradeoff: portfolioValueCHF basiert damit ebenfalls auf
    // adjustierten Kursen (Serien-Konsistenz vor Punkt-Bewertung, solange
    // keine Splits-Tabelle existiert).
    expect(series.map((p) => p.portfolioValueCHF)).toEqual([5000, 4900, 4950]);
    expect(series[0].portfolioReturn).toBe(0);
    expect(series[1].portfolioReturn).toBeCloseTo(-0.02, 12);
    expect(series[2].portfolioReturn).toBeCloseTo(-0.01, 12);
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

    // vorher (R-08): endete die Hypo-Serie auf einem GEKAPPTEN Wert (z. B.
    // −15 % statt −20 %), wurde das falsche Niveau hier auf die gesamte
    // Real-Serie weiterverkettet. Seit dem R-08-Fix liefern die Serien
    // unmutierte Renditen — die Verkettung selbst ist unverändert.
  });
});
