import { describe, expect, it } from "vitest";
import { selectFiveYearPriceVolatilitySeries } from "./priceVolatilityBasis";

function point(date: string, close: number, adjustedClose?: number | null) {
  return { date, close, adjustedClose: adjustedClose ?? null };
}

describe("selectFiveYearPriceVolatilitySeries", () => {
  const asOf = new Date("2026-09-24T00:00:00.000Z");

  it("uses the complete raw close series rather than mixing a partial adjusted-close series", () => {
    const result = selectFiveYearPriceVolatilitySeries([
      point("2021-09-27", 100, 98),
      point("2021-09-28", 101, 99),
      point("2026-09-22", 125),
      point("2026-09-23", 126),
      point("2026-09-24", 127),
    ], asOf, { minimumObservations: 4 });

    expect(result).toEqual({
      status: "available_raw_price",
      basis: "raw_close_price_return",
      prices: [100, 101, 125, 126, 127],
      observations: 4,
      adjustedCoveragePct: 40,
      possibleSplitDate: null,
    });
  });

  it("uses adjusted closes only when the full eligible series is present", () => {
    const result = selectFiveYearPriceVolatilitySeries([
      point("2021-09-27", 100, 90),
      point("2021-09-28", 101, 91),
      point("2026-09-22", 125, 112),
      point("2026-09-23", 126, 113),
      point("2026-09-24", 127, 114),
    ], asOf, { minimumObservations: 4 });

    expect(result).toMatchObject({
      status: "available_adjusted_total_return",
      basis: "adjusted_close_total_return",
      prices: [90, 91, 112, 113, 114],
      adjustedCoveragePct: 100,
    });
  });

  it("refuses a raw price series when a split-like discontinuity is not fully adjusted", () => {
    const result = selectFiveYearPriceVolatilitySeries([
      point("2021-09-27", 900, 880),
      point("2021-09-28", 902, 882),
      point("2024-07-09", 900, 880),
      point("2024-07-10", 900, 880),
      point("2024-07-11", 90),
      point("2026-09-23", 95),
      point("2026-09-24", 96),
    ], asOf, { minimumObservations: 6 });

    expect(result).toEqual({
      status: "possible_unadjusted_split",
      basis: null,
      prices: [],
      observations: 6,
      adjustedCoveragePct: expect.any(Number),
      possibleSplitDate: "2024-07-11",
    });
  });

  it("returns an honest data gap when the five-year window has too few observations", () => {
    const result = selectFiveYearPriceVolatilitySeries([
      point("2024-01-01", 100),
      point("2026-09-23", 120),
      point("2026-09-24", 121),
    ], asOf, { minimumObservations: 4 });

    expect(result).toEqual({
      status: "insufficient_observations",
      basis: null,
      prices: [],
      observations: 2,
      adjustedCoveragePct: 0,
      possibleSplitDate: null,
    });
  });
});
