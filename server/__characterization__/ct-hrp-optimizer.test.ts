/**
 * Characterization tests for HRP (Hierarchical Risk Parity) optimizer.
 * Tests the pure TypeScript implementation in hrpOptimizer.ts.
 */

import { describe, it, expect } from "vitest";
import { runHRP } from "../analytics/hrpOptimizer";

// ─── Synthetic return data ───────────────────────────────────────────────────
// 252 days of returns for 4 assets with known correlation structure:
// AAAA & BBBB are positively correlated (0.8)
// CCCC & DDDD are negatively correlated with AAAA/BBBB (-0.3)
function syntheticReturns(n = 252): Record<string, number[]> {
  const seed = (x: number) => Math.sin(x * 1234.567) * 0.5 + 0.5; // deterministic "random"
  const base = Array.from({ length: n }, (_, i) => (seed(i) - 0.5) * 0.02);

  return {
    AAAA: base.map((r, i) => r + (seed(i * 2) - 0.5) * 0.005),
    BBBB: base.map((r, i) => r * 0.9 + (seed(i * 3) - 0.5) * 0.008), // correlated with AAAA
    CCCC: base.map((r, i) => -r * 0.3 + (seed(i * 5) - 0.5) * 0.015), // anti-correlated
    DDDD: base.map((r, i) => -r * 0.25 + (seed(i * 7) - 0.5) * 0.012), // anti-correlated
  };
}

describe("HRP Optimizer — Core Properties", () => {
  const returnsMap = syntheticReturns();
  const tickers = ["AAAA", "BBBB", "CCCC", "DDDD"];

  it("weights sum to 1.0 (within floating point tolerance)", () => {
    const result = runHRP({ tickers, returnsMap });
    const sum = Object.values(result.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 3);
  });

  it("all weights are non-negative", () => {
    const result = runHRP({ tickers, returnsMap });
    for (const w of Object.values(result.weights)) {
      expect(w).toBeGreaterThanOrEqual(0);
    }
  });

  it("respects minPositionWeight constraint", () => {
    const result = runHRP({ tickers, returnsMap, minPositionWeight: 0.05 });
    for (const w of Object.values(result.weights)) {
      if (w > 0) expect(w).toBeGreaterThanOrEqual(0.049); // allow tiny float rounding
    }
  });

  it("respects maxPositionWeight constraint", () => {
    const result = runHRP({ tickers, returnsMap, maxPositionWeight: 0.30 });
    for (const w of Object.values(result.weights)) {
      expect(w).toBeLessThanOrEqual(0.301);
    }
  });

  it("returns weights for all input tickers", () => {
    const result = runHRP({ tickers, returnsMap });
    for (const t of tickers) {
      expect(result.weights).toHaveProperty(t);
    }
  });

  it("sortedTickers contains all input tickers", () => {
    const result = runHRP({ tickers, returnsMap });
    expect(result.sortedTickers.sort()).toEqual([...tickers].sort());
  });

  it("riskContributions sum to approximately 1.0", () => {
    const result = runHRP({ tickers, returnsMap });
    const sum = Object.values(result.riskContributions).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it("diversificationRatio is >= 1 (HRP should be at least as diversified as individual assets)", () => {
    const result = runHRP({ tickers, returnsMap });
    expect(result.portfolioStats.diversificationRatio).toBeGreaterThanOrEqual(0.99);
  });

  it("correlated assets (AAAA & BBBB) are adjacent in sortedTickers", () => {
    const result = runHRP({ tickers, returnsMap });
    const idxA = result.sortedTickers.indexOf("AAAA");
    const idxB = result.sortedTickers.indexOf("BBBB");
    // They should be neighbors (|idxA - idxB| == 1)
    expect(Math.abs(idxA - idxB)).toBe(1);
  });

  it("throws for fewer than 2 tickers", () => {
    expect(() => runHRP({ tickers: ["AAAA"], returnsMap })).toThrow();
  });

  it("portfolioStats.volatility is a positive number", () => {
    const result = runHRP({ tickers, returnsMap });
    expect(result.portfolioStats.volatility).toBeGreaterThan(0);
  });

  it("HRP with equal-variance assets produces roughly equal weights", () => {
    // All assets have identical variance → HRP should give equal weights
    const equalVarReturns: Record<string, number[]> = {};
    const n = 200;
    const seed = (x: number) => Math.sin(x * 999.1) * 0.01;
    for (const t of ["A", "B", "C", "D"]) {
      equalVarReturns[t] = Array.from({ length: n }, (_, i) => seed(i + t.charCodeAt(0)));
    }
    const result = runHRP({ tickers: ["A", "B", "C", "D"], returnsMap: equalVarReturns });
    const weights = Object.values(result.weights);
    const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
    for (const w of weights) {
      // Each weight should be within ±10% of equal weight (0.25)
      expect(Math.abs(w - avg)).toBeLessThan(0.10);
    }
  });
});

describe("HRP Optimizer — Edge Cases", () => {
  it("handles 2 tickers", () => {
    const returnsMap = syntheticReturns();
    const result = runHRP({ tickers: ["AAAA", "CCCC"], returnsMap });
    const sum = Object.values(result.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 3);
  });

  it("handles 10 tickers", () => {
    const n = 252;
    const seed = (x: number) => Math.sin(x * 777.3) * 0.01;
    const tickers10 = Array.from({ length: 10 }, (_, i) => `T${i}`);
    const returnsMap10: Record<string, number[]> = {};
    for (const t of tickers10) {
      returnsMap10[t] = Array.from({ length: n }, (_, i) => seed(i + t.charCodeAt(1)));
    }
    const result = runHRP({ tickers: tickers10, returnsMap: returnsMap10 });
    const sum = Object.values(result.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 3);
    expect(result.sortedTickers).toHaveLength(10);
  });
});
