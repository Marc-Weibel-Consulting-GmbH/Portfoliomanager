/**
 * Portfolio-Backtest (runPortfolioBacktest) — verhaltensbasiert.
 *
 * Daten-Mocking analog CT-16: die Engine liest Kurse aus historicalPrices (getDb)
 * und Währungen über fxHelper; beides wird hier durch synthetische CHF-Reihen
 * ersetzt. riskFreeRate fällt mangels macroIndicators auf den 2-%-Default zurück.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  rowsByTicker: {} as Record<string, Array<{ ticker: string; date: string; close: number; adj: number | null }>>,
}));

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

vi.mock("../db", () => ({ getDb: async () => fakeDb() }));
vi.mock("../fxHelper", () => ({
  getStockCurrency: async () => "CHF",
  getFxRate: async () => 1,
}));

import { runPortfolioBacktest } from "./engine";

// Zwei stetig steigende Reihen mit leichtem Rauschen (≈ 130 Handelstage).
function buildRows() {
  const dates = Array.from({ length: 130 }, (_, i) =>
    new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10)
  );
  const series = (ticker: string, base: number, drift: number, amp: number, phase: number) =>
    dates.map((date, i) => ({ ticker, date, close: base + drift * i + amp * Math.sin(i * 0.3 + phase), adj: null }));
  return {
    A: series("A", 100, 0.2, 3, 0),
    B: series("B", 80, 0.15, 2, 1),
  };
}

beforeEach(() => {
  h.rowsByTicker = buildRows();
});

describe("runPortfolioBacktest", () => {
  it("liefert Kennzahlen + Equity-Kurve für eine Gleichgewichtung", async () => {
    const res = await runPortfolioBacktest({ tickers: ["A", "B"], weights: [0.5, 0.5], rebalance: "monthly" });

    expect(res.tickers).toEqual(["A", "B"]);
    expect(res.excludedTickers).toEqual([]);
    // Gewichte normalisiert (Summe ≈ 1).
    const wSum = Object.values(res.weights).reduce((s, w) => s + w, 0);
    expect(wSum).toBeCloseTo(1, 3);

    // Steigende Kurse → positive Gesamtrendite; Kennzahlen sind endliche Zahlen.
    expect(res.stats.totalReturnPct).toBeGreaterThan(0);
    expect(Number.isFinite(res.stats.cagrPct)).toBe(true);
    expect(Number.isFinite(res.stats.annualVolPct)).toBe(true);
    expect(Number.isFinite(res.stats.sharpe)).toBe(true);
    expect(res.stats.maxDrawdownPct).toBeLessThanOrEqual(0);

    // Equity-Kurve monatlich verdichtet: mehrere Punkte, startet nahe 1.0.
    expect(res.equityCurve.length).toBeGreaterThanOrEqual(3);
    expect(res.equityCurve[0].value).toBeGreaterThan(0);
    expect(res.fromDate < res.toDate).toBe(true);
  });

  it("normalisiert unnormierte Gewichte und schliesst Titel ohne Historie aus", async () => {
    // 'C' hat keine Kursreihe → wird ausgeschlossen, Gewicht auf A/B umverteilt.
    const res = await runPortfolioBacktest({ tickers: ["A", "B", "C"], weights: [2, 2, 5], rebalance: "none" });
    expect(res.tickers).toEqual(["A", "B"]);
    expect(res.excludedTickers).toEqual(["C"]);
    expect(res.weights.A).toBeCloseTo(0.5, 3);
    expect(res.weights.B).toBeCloseTo(0.5, 3);
  });

  it("wirft bei zu wenig gemeinsamer Historie", async () => {
    h.rowsByTicker = {
      A: [{ ticker: "A", date: "2025-01-01", close: 100, adj: null }],
    };
    await expect(runPortfolioBacktest({ tickers: ["A"], weights: [1] })).rejects.toThrow();
  });
});
