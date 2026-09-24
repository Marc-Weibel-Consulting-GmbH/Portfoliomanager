import { describe, expect, it } from "vitest";
import { calculateAlternativePeriodReturn, toAlternativeDetailChartPoints } from "./alternativeDetailPresentation";

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
});
