/**
 * CT-16 — Charakterisierungstests für optimizeWeights + buildEfficientFrontier
 * (server/analytics/engine.ts, via öffentliche API optimizePortfolio —
 * beide Funktionen sind modulprivat)
 *
 * Pinnt das Verhalten NACH dem R-34-Fix (aufgeweitete Bounds, konsistente
 * Frontier) und NACH OPT-1 (Audit 2026-07): der Optimizer bezieht Renditen
 * jetzt über fetchReturnsWithDates (CHF-konvertiert) + alignReturnsByDate.
 * Erwartungswerte wurden durch AUSFÜHREN des aktuellen Codes ermittelt.
 *
 * Daten-Mocking: engine liest Kurse aus der historicalPrices-DB (getDb) und
 * Währungen über fxHelper.getStockCurrency. Beides ist hier gemockt: drei
 * synthetische CHF-Reihen mit identischen Handelstagen (Datums-Alignment ist
 * damit ein No-op; die gepinnten Zahlen prüfen die Optimierung selbst).
 *
 * Determinismus: Math.random ist mit einem geseedeten mulberry32-PRNG ersetzt
 * (Optimizer und Frontier ziehen eine feste Anzahl Zufallszahlen in fester
 * Reihenfolge); die Fixture-Daten sind rein deterministisch.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  rowsByTicker: {} as Record<string, Array<{ ticker: string; date: string; close: number; adj: number | null }>>,
}));

// Thenable-Fake für die Drizzle-Chain select().from().where().orderBy()/limit().
function fakeDb() {
  const allRows = () => Object.values(h.rowsByTicker).flat();
  const q: any = {
    from: () => q,
    where: () => q,
    orderBy: () => q,
    limit: () => q,
    then: (resolve: any, reject: any) => Promise.resolve(allRows()).then(resolve, reject),
  };
  return { select: () => q };
}

vi.mock("../db", () => ({
  getDb: async () => fakeDb(),
}));

vi.mock("../fxHelper", () => ({
  getStockCurrency: async () => "CHF", // keine FX-Umrechnung → deterministisch
  getFxRate: async () => 1,
}));

import { optimizePortfolio } from "../analytics/engine";

/**
 * Deterministische Kursreihen (61 Schlusskurse → 60 Tagesrenditen, alle µ > 0).
 * Handelstage jüngst genug für das lookback-Fenster (1.5 × 252 Tage) der Engine.
 */
function buildRows() {
  const dates = Array.from({ length: 61 }, (_, i) =>
    new Date(Date.UTC(2026, 3, 1 + i)).toISOString().slice(0, 10)
  );
  const series = (ticker: string, fn: (i: number) => number) =>
    dates.map((date, i) => ({ ticker, date, close: fn(i), adj: null }));
  return {
    T1: series("T1", (i) => 100 + 0.05 * i + 2 * Math.sin(i * 0.7)),
    T2: series("T2", (i) => 50 + 0.06 * i + 1.5 * Math.sin(i * 1.3 + 1)),
    T3: series("T3", (i) => 200 + 0.08 * i + 3 * Math.sin(i * 0.5 + 2)),
  };
}

/** mulberry32 — geseedeter Ersatz für Math.random. */
function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

beforeEach(() => {
  h.rowsByTicker = buildRows();
  vi.spyOn(Math, "random").mockImplementation(mulberry32(42));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CT-16 optimizeWeights via optimizePortfolio (R-34 gefixt)", () => {
  it("max_sharpe mit 3 Titeln: effektive Bounds [1 %, 40 %], Gewichte summieren auf 1", async () => {
    const res = await optimizePortfolio({ tickers: ["T1", "T2", "T3"], method: "max_sharpe" });

    // Effektiver Cap = max(0.10, 1.2/3) = 0.4 → Bounds erfüllbar, Summe = 1.
    // Werte aktualisiert nach Einführung der Black-Litterman-Erwartungsrenditen: die
    // rohen historischen Jahresmittel werden als unsichere Views gegen den Equal-Weight-
    // Gleichgewichts-Prior geschrumpft → die Renditeschätzer liegen enger beieinander,
    // die Gewichte sind weniger extrem (Ledoit-Wolf-Kovarianz-Shrinkage weiterhin aktiv).
    expect(res.weights).toEqual({ T1: 0.3266, T2: 0.2736, T3: 0.3999 });
    const sum = Object.values(res.weights).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 3);
    for (const w of Object.values(res.weights)) {
      expect(w).toBeGreaterThanOrEqual(0.01);
      expect(w).toBeLessThanOrEqual(0.4 + 1e-9);
    }
    expect(res.assets.map((a) => a.optimalWeight)).toEqual([32.7, 27.4, 40]);

    // Sharpe-Ratio des Optimums liegt ÜBER dem Equal-Weight-Portfolio:
    expect(res.optimalPortfolio.expectedReturn).toBe(0.0762);
    expect(res.optimalPortfolio.volatility).toBe(0.1225);
    expect(res.optimalPortfolio.sharpe).toBe(0.459);
    expect(res.optimalPortfolio.sharpe).toBeGreaterThan(res.currentPortfolio.sharpe);
  });

  it("min_variance liefert andere Gewichte als max_sharpe (Methode wirkt wieder)", async () => {
    const res = await optimizePortfolio({ tickers: ["T1", "T2", "T3"], method: "min_variance" });

    // vorher (R-34): identisch [0.1, 0.1, 0.1] mit max_sharpe, da jede
    // Kandidatenlösung auf den Cap geclippt wurde — Methode wirkungslos.
    // min_variance ignoriert μ → von der Black-Litterman-Umstellung unberührt.
    expect(res.weights).toEqual({ T1: 0.3997, T2: 0.2042, T3: 0.3962 });
    expect(res.optimalPortfolio.expectedReturn).toBe(0.0671);
  });

  it("equal_weight: 33.3 % liegt innerhalb der effektiven Bounds (Cap 40 % bei n = 3)", async () => {
    const res = await optimizePortfolio({ tickers: ["T1", "T2", "T3"], method: "equal_weight" });

    // equal_weight kehrt vor der Constraint-Logik zurück (x0 = 1/n); mit dem
    // aufgeweiteten Cap max(0.10, 1.2/n) ist 1/n jetzt immer bounds-konform.
    // vorher (R-34): 33.3 % verletzte den (unerfüllbaren) 10-%-Cap.
    expect(res.weights.T1).toBeCloseTo(0.3333, 4);
    expect(res.weights.T2).toBeCloseTo(0.3333, 4);
    expect(res.weights.T3).toBeCloseTo(0.3333, 4);
    const sum = Object.values(res.weights).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 3);
  });

  it("OPT-1: unter 30 gemeinsamen Handelstagen bricht die Optimierung ehrlich ab", async () => {
    // T3 handelt nur an 20 der gemeinsamen Tage → Schnittmenge < 30.
    h.rowsByTicker.T3 = h.rowsByTicker.T3.slice(0, 21);
    await expect(
      optimizePortfolio({ tickers: ["T1", "T2", "T3"], method: "max_sharpe" })
    ).rejects.toThrow(/gemeinsame Handelstage/);
  });
});

describe("CT-16 buildEfficientFrontier via optimizePortfolio (R-34 gefixt)", () => {
  it("Frontier respektiert dieselben Bounds und ist konsistent zum beschränkten Optimum", async () => {
    const res = await optimizePortfolio({ tickers: ["T1", "T2", "T3"], method: "max_sharpe" });
    const frontier = res.efficientFrontier;
    const rets = frontier.map((p) => p.expectedReturn);

    // Geseedeter Stand (mulberry32, Seed 42) — nach der Optimizer-Überarbeitung (u. a.
    // topWeights je Frontier-Punkt) neu gepinnt: 10 bounds-konforme Zielpunkte.
    expect(frontier).toHaveLength(10);
    for (let i = 1; i < frontier.length; i++) {
      expect(frontier[i].volatility).toBeGreaterThanOrEqual(frontier[i - 1].volatility);
    }
    // Kennzahlen der Endpunkte (toMatchObject — Punkte tragen zusätzlich topWeights).
    expect(frontier[0]).toMatchObject({ expectedReturn: 0.067, volatility: 0.105, sharpe: 0.447 });
    expect(frontier[frontier.length - 1]).toMatchObject({ expectedReturn: 0.0916, volatility: 0.1607, sharpe: 0.446 });

    // Der max_sharpe-Optimalpunkt liegt jetzt IM Inneren der Kurve (Rendite 0.0762
    // zwischen Min 0.067 und Max 0.0916) — nicht mehr am Min-Vol-Ende — und hat
    // die höchste Sharpe-Ratio aller Kurvenpunkte (das ist das Optimierungsziel).
    expect(Math.max(...rets)).toBeCloseTo(0.0916, 10);
    expect(Math.min(...rets)).toBeCloseTo(0.067, 10);
    expect(res.optimalPortfolio.expectedReturn).toBeGreaterThanOrEqual(Math.min(...rets) - 1e-9);
    expect(res.optimalPortfolio.expectedReturn).toBeLessThanOrEqual(Math.max(...rets) + 1e-9);
    expect(res.optimalPortfolio.sharpe).toBeGreaterThanOrEqual(Math.max(...frontier.map((p) => p.sharpe)) - 1e-9);
  });
});
