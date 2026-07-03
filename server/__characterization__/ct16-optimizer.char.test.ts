/**
 * CT-16 — Charakterisierungstests für optimizeWeights + buildEfficientFrontier
 * (server/analytics/engine.ts:334–466, via öffentliche API optimizePortfolio —
 * beide Funktionen sind modulprivat)
 *
 * Pinnt R-34: die Gewichts-Bounds (min 1 %, max 10 %) sind bei < 10 Titeln
 * unerfüllbar — normalizeWithConstraints konvergiert nicht, alle Gewichte enden
 * am Cap 10 % und summieren sich auf n·10 % statt 1. Die Effizienzgrenze wird
 * OHNE die Bounds gerechnet (500 Zufallsportfolios, Gewichte summieren auf 1)
 * und ist damit inkonsistent zum beschränkten «Optimum».
 * Erwartungswerte wurden durch AUSFÜHREN des aktuellen Codes ermittelt.
 *
 * Determinismus: yahoo-finance2.chart liefert synthetische Fixture-Kursreihen;
 * Math.random ist mit einem geseedeten mulberry32-PRNG ersetzt (Optimizer und
 * Frontier ziehen eine feste Anzahl Zufallszahlen in fester Reihenfolge).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  chartsByTicker: {} as Record<string, number[]>,
}));

vi.mock("yahoo-finance2", () => ({
  default: class {
    chart = async (ticker: string) => ({
      quotes: (h.chartsByTicker[ticker] ?? []).map((close, i) => ({
        close,
        date: new Date(Date.UTC(2025, 0, 1 + i)),
      })),
    });
    quoteSummary = async () => ({});
  },
}));

import { optimizePortfolio } from "../analytics/engine";

/** Deterministische Kursreihen (61 Schlusskurse → 60 Tagesrenditen, alle µ > 0). */
function buildCharts() {
  const closes = (fn: (i: number) => number) => Array.from({ length: 61 }, (_, i) => fn(i));
  return {
    T1: closes((i) => 100 + 0.05 * i + 2 * Math.sin(i * 0.7)),
    T2: closes((i) => 50 + 0.06 * i + 1.5 * Math.sin(i * 1.3 + 1)),
    T3: closes((i) => 200 + 0.08 * i + 3 * Math.sin(i * 0.5 + 2)),
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
  h.chartsByTicker = buildCharts();
  vi.spyOn(Math, "random").mockImplementation(mulberry32(42));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CT-16 optimizeWeights via optimizePortfolio (R-34)", () => {
  it("max_sharpe mit 3 Titeln: Bounds unerfüllbar → alle Gewichte 10 %, Summe 0.3", async () => {
    const res = await optimizePortfolio({ tickers: ["T1", "T2", "T3"], method: "max_sharpe" });

    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-34:
    // min 1 %/max 10 % ist bei n = 3 unerfüllbar (n·10 % = 30 % < 100 %).
    // normalizeWithConstraints konvergiert nicht und clippt alle Gewichte auf
    // den Cap — «optimale» Gewichte summieren sich auf 0.3 statt 1. Der Client
    // renormalisiert und schiebt sie wieder über 10 % (OptimierenTab.tsx).
    expect(res.weights).toEqual({ T1: 0.1, T2: 0.1, T3: 0.1 });
    const sum = Object.values(res.weights).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(0.3, 10);
    expect(sum).toBeLessThan(0.999);
    expect(res.assets.map((a) => a.optimalWeight)).toEqual([10, 10, 10]);

    // Kennzahlen des «Optimums» werden mit den unvollständigen Gewichten
    // gerechnet (0.1·Σµ) und liegen dadurch UNTER dem Equal-Weight-Portfolio:
    expect(res.optimalPortfolio.expectedReturn).toBe(0.0353);
    expect(res.optimalPortfolio.volatility).toBe(0.0429);
    expect(res.optimalPortfolio.sharpe).toBe(0.356);
    expect(res.currentPortfolio.expectedReturn).toBe(0.1175);
    expect(res.optimalPortfolio.expectedReturn).toBeLessThan(res.currentPortfolio.expectedReturn);
  });

  it("min_variance liefert dieselben Gewichte wie max_sharpe (Methode wirkungslos, R-34)", async () => {
    const res = await optimizePortfolio({ tickers: ["T1", "T2", "T3"], method: "min_variance" });

    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-34:
    // Da bei < 10 Titeln jede Kandidatenlösung auf [0.1, 0.1, 0.1] geclippt
    // wird, ist die Optimierungsmethode ohne jeden Einfluss auf das Ergebnis.
    expect(res.weights).toEqual({ T1: 0.1, T2: 0.1, T3: 0.1 });
    expect(res.optimalPortfolio.expectedReturn).toBe(0.0353);
  });

  it("equal_weight umgeht die Bounds komplett: 33.3 % > maxWeight 10 %", async () => {
    const res = await optimizePortfolio({ tickers: ["T1", "T2", "T3"], method: "equal_weight" });

    // equal_weight kehrt vor der Constraint-Logik zurück (x0 = 1/n) — als
    // einzige Methode summieren die Gewichte auf 1, verletzen dafür den Cap:
    expect(res.weights.T1).toBeCloseTo(0.3333, 4);
    expect(res.weights.T2).toBeCloseTo(0.3333, 4);
    expect(res.weights.T3).toBeCloseTo(0.3333, 4);
    const sum = Object.values(res.weights).reduce((s, w) => s + w, 0);
    expect(sum).toBeCloseTo(1, 3);
  });
});

describe("CT-16 buildEfficientFrontier via optimizePortfolio (R-34)", () => {
  it("Frontier ignoriert die Bounds und ist inkonsistent zum beschränkten Optimum", async () => {
    const res = await optimizePortfolio({ tickers: ["T1", "T2", "T3"], method: "max_sharpe" });
    const frontier = res.efficientFrontier;
    const rets = frontier.map((p) => p.expectedReturn);

    // Geseedeter Ist-Stand (mulberry32, Seed 42): 28 von 30 Zielpunkten finden
    // ein Zufallsportfolio; sortiert nach Volatilität.
    expect(frontier).toHaveLength(28);
    for (let i = 1; i < frontier.length; i++) {
      expect(frontier[i].volatility).toBeGreaterThanOrEqual(frontier[i - 1].volatility);
    }
    expect(frontier[0]).toEqual({ expectedReturn: 0.0813, volatility: 0.0728, sharpe: 0.842 });
    expect(frontier[frontier.length - 1]).toEqual({ expectedReturn: 0.1942, volatility: 0.3456, sharpe: 0.504 });

    // ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-34:
    // Die Frontier wird aus 500 Zufallsportfolios OHNE die 1–10-%-Bounds
    // gerechnet (Gewichte summieren auf 1). Ihr Maximum (~19.4 %) liegt nahe
    // max(µ) = 21.2 % — unter dem 10-%-Cap unerreichbar — und schon ihr
    // MINIMUM (6.42 %) liegt über dem «Optimum» (3.53 %): der beschränkte
    // Optimalpunkt liegt komplett unterhalb der angezeigten Kurve.
    expect(Math.max(...rets)).toBeCloseTo(0.1942, 10);
    expect(Math.min(...rets)).toBeCloseTo(0.0642, 10);
    expect(res.optimalPortfolio.expectedReturn).toBeLessThan(Math.min(...rets));
  });
});
