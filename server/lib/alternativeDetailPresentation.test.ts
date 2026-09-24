import { describe, expect, it } from "vitest";
import { calculateAlternativePeriodReturn, toAlternativeDetailChartFromStoredRows, toAlternativeDetailChartPoints } from "./alternativeDetailPresentation";

describe("alternative detail presentation", () => {
  it("keeps only genuine positive source prices in chronological chart order", () => {
    const points = toAlternativeDetailChartPoints({
      dates: ["2026-09-02", "", "2026-09-01", "2026-09-03"],
      prices: [104, 99, 100, 0],
    });

    expect(points).toEqual([
      { date: "2026-09-01", value: 100 },
      { date: "2026-09-02", value: 104 },
    ]);
  });

  it("calculates a period return only from observed endpoints", () => {
    expect(calculateAlternativePeriodReturn([
      { date: "2026-09-01", value: 100 },
      { date: "2026-09-02", value: 104 },
    ])).toBeCloseTo(4, 10);
    expect(calculateAlternativePeriodReturn([{ date: "2026-09-01", value: 100 }])).toBeNull();
  });

  it("builds a chart from stored adjusted closes without reaching an external provider", () => {
    expect(toAlternativeDetailChartFromStoredRows([
      { date: "2025-09-22", adjustedClose: "10.50", close: "10.00" },
      { date: "2025-09-23", adjustedClose: null, close: "10.75" },
      { date: "2025-09-24", adjustedClose: "invalid", close: "0" },
    ])).toEqual([
      { date: "2025-09-22", value: 10.5 },
      { date: "2025-09-23", value: 10.75 },
    ]);
  });
});
