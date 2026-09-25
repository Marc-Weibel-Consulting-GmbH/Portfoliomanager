import { describe, expect, it } from "vitest";
import {
  buildPortfolioDrawdownAnalysis,
  calculateDailyReturns,
} from "./portfolioDrawdown";

describe("buildPortfolioDrawdownAnalysis", () => {
  it("derives the running peak and maximum drawdown transparently", () => {
    const analysis = buildPortfolioDrawdownAnalysis([
      { date: "2026-01-02", portfolioValueCHF: 100_000 },
      { date: "2026-01-03", portfolioValueCHF: 110_000 },
      { date: "2026-01-04", portfolioValueCHF: 102_740 },
      { date: "2026-01-05", portfolioValueCHF: 114_000 },
    ]);

    expect(analysis.points).toMatchObject([
      { date: "2026-01-02", portfolioValueCHF: 100_000, runningPeakCHF: 100_000, drawdownPct: 0 },
      { date: "2026-01-03", portfolioValueCHF: 110_000, runningPeakCHF: 110_000, drawdownPct: 0 },
      { date: "2026-01-04", portfolioValueCHF: 102_740, runningPeakCHF: 110_000 },
      { date: "2026-01-05", portfolioValueCHF: 114_000, runningPeakCHF: 114_000, drawdownPct: 0 },
    ]);
    expect(analysis.points[2].drawdownPct).toBeCloseTo(-6.6, 10);
    expect(analysis.maxDrawdownPct).toBeCloseTo(-6.6, 10);
    expect(analysis.peakDate).toBe("2026-01-03");
    expect(analysis.troughDate).toBe("2026-01-04");
  });

  it("does not fabricate data from invalid valuation points", () => {
    const analysis = buildPortfolioDrawdownAnalysis([
      { date: "2026-01-02", portfolioValueCHF: 100 },
      { date: "2026-01-03", portfolioValueCHF: 0 },
      { date: "2026-01-04", portfolioValueCHF: 95 },
    ]);

    expect(analysis.points).toHaveLength(2);
    expect(analysis.maxDrawdownPct).toBe(-5);
  });
});

describe("calculateDailyReturns", () => {
  it("uses consecutive values without a fabricated return for the first observation", () => {
    expect(calculateDailyReturns([100, 102, 99])).toEqual([0.02, -0.029411764705882353]);
  });
});
