import { describe, expect, it } from "vitest";
import { computeFixedShareReturnSeries } from "./fixedShareReturnSeries";

describe("computeFixedShareReturnSeries", () => {
  it("uses fixed shares and a fixed cash reserve instead of retrospectively reweighting winners", () => {
    const series = computeFixedShareReturnSeries({
      startDate: "2021-09-27",
      cashCHF: 100,
      inputs: [
        { ticker: "WIN", shares: 1, prices: { "2021-09-27": 100, "2026-09-25": 300 } },
        { ticker: "FLAT", shares: 1, prices: { "2021-09-27": 100, "2026-09-25": 100 } },
      ],
      dates: ["2021-09-27", "2026-09-25"],
    });

    expect(series).toHaveLength(2);
    expect(series[0]).toEqual({ date: "2021-09-27", stocksReturnPct: 0, totalReturnPct: 0 });
    expect(series[1]?.date).toBe("2026-09-25");
    expect(series[1]?.stocksReturnPct).toBeCloseTo(100, 12);
    expect(series[1]?.totalReturnPct).toBeCloseTo(66.66666666666667, 12);
  });

  it("forward-fills a non-trading day but never invents a price before the first valid close", () => {
    const series = computeFixedShareReturnSeries({
      startDate: "2021-09-27",
      cashCHF: 0,
      inputs: [{ ticker: "ONE", shares: 2, prices: { "2021-09-27": 50, "2021-09-29": 55 } }],
      dates: ["2021-09-27", "2021-09-28", "2021-09-29"],
    });

    expect(series).toEqual([
      { date: "2021-09-27", stocksReturnPct: 0, totalReturnPct: 0 },
      { date: "2021-09-28", stocksReturnPct: 0, totalReturnPct: 0 },
      { date: "2021-09-29", stocksReturnPct: 10.000000000000009, totalReturnPct: 10.000000000000009 },
    ]);
  });
});
