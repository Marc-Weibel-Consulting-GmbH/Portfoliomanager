import { describe, expect, it } from "vitest";
import { buildHistoricalPriceInsertRows } from "./importHistoricalPrices";

describe("buildHistoricalPriceInsertRows", () => {
  it("preserves EODHD adjusted close on first, additive history import", () => {
    expect(buildHistoricalPriceInsertRows("WM.US", [{
      date: "2021-09-27",
      close: 151.23,
      adjusted_close: 145.71,
    }])).toEqual([{
      ticker: "WM.US",
      date: "2021-09-27",
      close: "151.23",
      adjustedClose: "145.71",
      source: "eodhd",
    }]);
  });
});
