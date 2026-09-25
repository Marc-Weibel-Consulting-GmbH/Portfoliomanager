import { describe, expect, it } from "vitest";
import { calculateFiveYearAnnualizedVolatility } from "./fiveYearVolatility";

function dailySeries(start: string, end: string) {
  const points: Array<{ date: string; close: number; adjustedClose: number }> = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  let adjustedClose = 100;
  let index = 0;

  while (cursor <= last) {
    // Deterministische kleine Tagesschwankungen, damit eine positive, aber
    // realistische Standardabweichung entsteht.
    adjustedClose *= 1 + (index % 2 === 0 ? 0.002 : -0.001);
    points.push({
      date: cursor.toISOString().slice(0, 10),
      close: adjustedClose,
      adjustedClose,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    index += 1;
  }

  return points;
}

describe("calculateFiveYearAnnualizedVolatility", () => {
  const asOf = new Date("2025-09-23T00:00:00.000Z");

  it("returns annualized five-year volatility for a complete price series", () => {
    const result = calculateFiveYearAnnualizedVolatility(
      dailySeries("2020-09-20", "2025-09-23"),
      asOf,
    );

    expect(result).toMatchObject({
      status: "available_adjusted_total_return",
      basis: "adjusted_close_total_return",
      observations: expect.any(Number),
    });
    expect(result.observations).toBeGreaterThanOrEqual(1_000);
    expect(result.annualizedVolatilityPct).toBeGreaterThan(0);
  });

  it("returns an honest data gap when the series does not cover five calendar years", () => {
    const result = calculateFiveYearAnnualizedVolatility(
      dailySeries("2021-03-01", "2025-09-23"),
      asOf,
    );

    expect(result).toMatchObject({
      status: "insufficient_history",
      annualizedVolatilityPct: null,
      observations: expect.any(Number),
      basis: null,
      possibleSplitDate: null,
    });
  });

  it("uses adjusted closes when present, preventing a raw split from distorting volatility", () => {
    const prices = dailySeries("2020-09-20", "2025-09-23").map((point, index) => ({
      ...point,
      close: index < 900 ? point.adjustedClose! * 10 : point.adjustedClose!,
    }));

    const result = calculateFiveYearAnnualizedVolatility(prices, asOf);

    expect(result.status).toBe("available_adjusted_total_return");
    expect(result.basis).toBe("adjusted_close_total_return");
    expect(result.annualizedVolatilityPct).toBeLessThan(10);
  });

  it("shows a data gap instead of joining partial adjusted prices to a raw split series", () => {
    const prices = dailySeries("2020-09-20", "2025-09-23").map((point, index) => ({
      ...point,
      close: index < 900 ? point.adjustedClose! * 10 : point.adjustedClose!,
      adjustedClose: index < 900 ? point.adjustedClose : null,
    }));

    const result = calculateFiveYearAnnualizedVolatility(prices, asOf);

    expect(result).toMatchObject({
      status: "possible_unadjusted_split",
      annualizedVolatilityPct: null,
      basis: null,
      possibleSplitDate: expect.any(String),
    });
  });
});
