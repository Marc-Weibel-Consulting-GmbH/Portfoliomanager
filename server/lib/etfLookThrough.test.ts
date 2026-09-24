import { describe, expect, it } from "vitest";
import { aggregateConstituentScores } from "./etfLookThrough";

describe("aggregateConstituentScores", () => {
  it("aggregates verified constituent scores by current fund weight", () => {
    const result = aggregateConstituentScores("CHDVD.SW", "2026-09-23", 20, [
      { ticker: "A.SW", weightPct: 60, quality: 80, valuation: 70, timing: 40 },
      { ticker: "B.SW", weightPct: 38.83, quality: 50, valuation: 40, timing: 70 },
    ]);

    expect(result).toMatchObject({
      method: "constituent_weighted",
      fundTicker: "CHDVD.SW",
      holdingCount: 20,
      weightsTotalPct: 98.83,
      quality: { score: 68.2, coveragePct: 100 },
      valuation: { score: 58.2, coveragePct: 100 },
      timing: { score: 51.8, coveragePct: 100 },
    });
  });

  it("shows a data gap rather than extrapolating a score below 90% component coverage", () => {
    const result = aggregateConstituentScores("CHDVD.SW", "2026-09-23", 20, [
      { ticker: "A.SW", weightPct: 80, quality: 70, valuation: 60, timing: 50 },
      { ticker: "B.SW", weightPct: 18.83, quality: null, valuation: null, timing: null },
    ]);

    expect(result?.quality).toEqual({ score: null, coveragePct: 80.9 });
    expect(result?.valuation).toEqual({ score: null, coveragePct: 80.9 });
    expect(result?.timing).toEqual({ score: null, coveragePct: 80.9 });
  });

  it("keeps components independent when only one component has incomplete coverage", () => {
    const result = aggregateConstituentScores("CHDVD.SW", "2026-09-23", 20, [
      { ticker: "A.SW", weightPct: 90, quality: 70, valuation: 60, timing: 50 },
      { ticker: "B.SW", weightPct: 8.83, quality: 90, valuation: null, timing: 70 },
    ]);

    expect(result?.quality).toEqual({ score: 71.8, coveragePct: 100 });
    expect(result?.valuation).toEqual({ score: 60, coveragePct: 91.1 });
    expect(result?.timing).toEqual({ score: 51.8, coveragePct: 100 });
  });

  it("rejects a malformed holdings snapshot instead of publishing an average", () => {
    expect(aggregateConstituentScores("CHDVD.SW", "2026-09-23", 20, [
      { ticker: "A.SW", weightPct: 70, quality: 70, valuation: 60, timing: 50 },
    ])).toBeNull();
  });
});
