import { describe, expect, it } from "vitest";
import { assessRawPriceSeriesIntegrity } from "./priceSeriesIntegrity";

describe("assessRawPriceSeriesIntegrity", () => {
  it("accepts an ordinary raw close series", () => {
    expect(assessRawPriceSeriesIntegrity([
      { date: "2026-01-01", close: 100 },
      { date: "2026-01-02", close: 103 },
      { date: "2026-01-05", close: 98 },
    ])).toEqual({ valid: true });
  });

  it("blocks an unresolved split-like fall instead of inventing a timing return", () => {
    const result = assessRawPriceSeriesIntegrity([
      { date: "2026-01-01", close: 100 },
      { date: "2026-01-02", close: 25 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Corporate-Action-Reihe");
  });

  it("blocks an unresolved reverse-split-like rise", () => {
    const result = assessRawPriceSeriesIntegrity([
      { date: "2026-01-01", close: 10 },
      { date: "2026-01-02", close: 25 },
    ]);
    expect(result.valid).toBe(false);
  });
});
