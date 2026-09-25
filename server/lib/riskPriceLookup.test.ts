import { describe, expect, it } from "vitest";
import { createRiskPriceLookup } from "./riskPriceLookup";

describe("createRiskPriceLookup", () => {
  it("finds the last observed price on or before a risk date without changing the staleness gate", () => {
    const lookup = createRiskPriceLookup(
      new Map([
        [
          "ABC",
          new Map([
            ["2026-01-02", 100],
            ["2026-01-05", 105],
          ]),
        ],
      ]),
      7,
    );

    expect(lookup("ABC", "2026-01-05")).toBe(105);
    expect(lookup("ABC", "2026-01-08")).toBe(105);
  });

  it("does not turn a stale, invalid or missing value into a price", () => {
    const lookup = createRiskPriceLookup(
      new Map([
        [
          "ABC",
          new Map([
            ["2026-01-02", 100],
            ["2026-01-20", Number.NaN],
          ]),
        ],
      ]),
      7,
    );

    expect(lookup("ABC", "2026-01-10")).toBeNull();
    expect(lookup("ABC", "2026-01-20")).toBeNull();
    expect(lookup("UNKNOWN", "2026-01-05")).toBeNull();
  });

  it("returns the same point values as a sequential five-year calendar scan", () => {
    const prices = new Map([
      [
        "AAA",
        new Map([
          ["2021-09-27", 10],
          ["2021-09-29", 11],
          ["2021-10-04", 12],
        ]),
      ],
    ]);
    const lookup = createRiskPriceLookup(prices, 7);

    expect([
      "2021-09-27",
      "2021-09-28",
      "2021-09-29",
      "2021-09-30",
      "2021-10-04",
    ].map((date) => lookup("AAA", date))).toEqual([10, 10, 11, 11, 12]);
  });
});
