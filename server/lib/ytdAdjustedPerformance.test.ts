import { describe, expect, it } from "vitest";
import { calculateAdjustedYtdPerformance } from "./ytdAdjustedPerformance";

describe("calculateAdjustedYtdPerformance", () => {
  it("vergleicht Swissquote vor und nach einem 1:10-Split ausschliesslich über adjustedClose", () => {
    const result = calculateAdjustedYtdPerformance([
      { date: "2026-01-02", close: "477.59", adjustedClose: "47.759" },
      { date: "2026-05-28", close: "43.40", adjustedClose: "43.40" },
    ], 2026);

    expect(result).toMatchObject({
      startDate: "2026-01-02",
      endDate: "2026-05-28",
      usedAdjustedClose: true,
    });
    expect(result?.performancePct).toBeCloseTo(-9.1271, 4);
  });

  it("verwendet Close nur, wenn die gesamte Reihe keine verwendbare adjusted-close-Basis hat", () => {
    const result = calculateAdjustedYtdPerformance([
      { date: "2026-01-02", close: "100", adjustedClose: null },
      { date: "2026-06-01", close: "110", adjustedClose: null },
    ], 2026);

    expect(result).toMatchObject({ startPrice: 100, endPrice: 110, usedAdjustedClose: false });
    expect(result?.performancePct).toBeCloseTo(10, 10);
  });

  it("erkennt einen plausiblen 1:10-Split auch bei fehlendem adjustedClose", () => {
    const result = calculateAdjustedYtdPerformance([
      { date: "2026-01-02", close: "477.59", adjustedClose: null },
      { date: "2026-05-27", close: "434.00", adjustedClose: null },
      { date: "2026-05-28", close: "43.40", adjustedClose: null },
      { date: "2026-09-07", close: "41.46", adjustedClose: null },
    ], 2026);

    expect(result).toMatchObject({
      startPrice: 47.759,
      endPrice: 41.46,
      usedAdjustedClose: false,
      usedInferredSplitAdjustment: true,
    });
    expect(result?.performancePct).toBeCloseTo(-13.1891, 4);
  });

  it("mischt keine veraltete adjusted-close-Basis mit später fehlenden Werten nach einem Split", () => {
    const result = calculateAdjustedYtdPerformance([
      { date: "2026-01-05", close: "497.40", adjustedClose: "487.7897" },
      { date: "2026-05-27", close: "434.00", adjustedClose: "425.00" },
      { date: "2026-05-28", close: "43.40", adjustedClose: null },
      { date: "2026-09-07", close: "41.46", adjustedClose: null },
    ], 2026);

    expect(result).toMatchObject({
      startPrice: 49.74,
      endPrice: 41.46,
      usedAdjustedClose: false,
      usedInferredSplitAdjustment: true,
    });
    expect(result?.performancePct).toBeCloseTo(-16.6466, 4);
  });
});
