import { describe, expect, it } from "vitest";
import { calculateAlternativePeriodReturn, getAlternativeDetailPeriodStart, toAlternativeDetailChartFromCandidateRows, toAlternativeDetailChartFromStoredRows, toAlternativeDetailChartPoints } from "./alternativeDetailPresentation";

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

  it("selects one current historical alias before charting so duplicate trading days cannot crash the chart", () => {
    expect(toAlternativeDetailChartFromCandidateRows("JNJ", [
      { ticker: "JNJ.US", date: "2026-09-23", adjustedClose: "148.7425", close: "160.26" },
      { ticker: "JNJ", date: "2026-09-23", adjustedClose: null, close: "269.17" },
      { ticker: "JNJ.US", date: "2026-09-24", adjustedClose: "149.30", close: "160.86" },
      { ticker: "JNJ", date: "2026-09-24", adjustedClose: null, close: "270.68" },
    ])).toEqual([
      { date: "2026-09-23", value: 269.17 },
      { date: "2026-09-24", value: 270.68 },
    ]);
  });

  it("maps the shared dialog periods to calendar-consistent stored-history starts", () => {
    const asOfDate = "2026-09-25";

    expect(getAlternativeDetailPeriodStart("YTD", asOfDate)).toBe("2025-12-25");
    expect(getAlternativeDetailPeriodStart("1Y", asOfDate)).toBe("2025-09-25");
    expect(getAlternativeDetailPeriodStart("3Y", asOfDate)).toBe("2023-09-25");
    expect(getAlternativeDetailPeriodStart("5Y", asOfDate)).toBe("2021-09-25");
    expect(getAlternativeDetailPeriodStart("Max", asOfDate)).toBeNull();
  });
});
