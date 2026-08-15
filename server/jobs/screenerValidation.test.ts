import { describe, expect, it } from "vitest";
import { buildComparison, buildYahooChartQuery, isFreshForWeeklyValidation, isoWeekKey, selectDeterministicSample, SOURCE_VERSION } from "./screenerValidation";

const internal = {
  currentPrice: 100,
  peRatio: 20,
  pegRatio: 1.5,
  dividendYield: 2,
  computedAt: "2026-08-14T08:00:00.000Z",
};

const external = {
  yahoo: { price: 101, currency: "USD", retrievedAt: "2026-08-14T08:30:00.000Z" },
  eodhd: { peRatio: 21, pegRatio: 1.6, dividendYield: 2.3, retrievedAt: "2026-08-14T08:30:00.000Z" },
};

describe("screener validation", () => {
  it("serializes all Yahoo query parameters as strings for the data proxy", () => {
    expect(buildYahooChartQuery("TD").includeAdjustedClose).toBe("true");
  });

  it("keeps the persisted source version within the current database column limit", () => {
    expect(SOURCE_VERSION.length).toBeLessThanOrEqual(64);
  });

  it("uses the ISO week containing the Thursday as deterministic run key", () => {
    expect(isoWeekKey(new Date("2026-01-01T12:00:00.000Z"))).toBe("2026-W01");
    expect(isoWeekKey(new Date("2025-12-31T12:00:00.000Z"))).toBe("2026-W01");
  });

  it("keeps the latest Friday cache eligible for the configured Monday 08:30 UTC audit", () => {
    expect(isFreshForWeeklyValidation(
      new Date("2026-08-14T22:51:00.000Z"),
      new Date("2026-08-17T08:30:00.000Z")
    )).toBe(true);
  });

  it("selects the same sample for the same seed regardless of input order", () => {
    const rows = [{ ticker: "BBB" }, { ticker: "AAA" }, { ticker: "CCC" }];
    expect(selectDeterministicSample(rows, "2026-W33", 2).map(row => row.ticker))
      .toEqual(selectDeterministicSample([...rows].reverse(), "2026-W33", 2).map(row => row.ticker));
  });

  it("flags only deviations above the documented thresholds as material", () => {
    const comparison = buildComparison(internal, external);
    expect(comparison.price.status).toBe("within_tolerance");
    expect(comparison.peRatio.status).toBe("within_tolerance");
    expect(comparison.pegRatio.status).toBe("within_tolerance");
    expect(comparison.dividendYield.status).toBe("within_tolerance");

    const material = buildComparison(internal, {
      ...external,
      yahoo: { ...external.yahoo, price: 97 },
      eodhd: { ...external.eodhd, peRatio: 25, pegRatio: 2, dividendYield: 3 },
    });
    expect(material.price.status).toBe("material");
    expect(material.peRatio.status).toBe("material");
    expect(material.pegRatio.status).toBe("material");
    expect(material.dividendYield.status).toBe("material");
  });

  it("classifies null versus an explicit zero dividend as semantic availability", () => {
    const comparison = buildComparison({ ...internal, dividendYield: null }, external);
    expect(comparison.dividendYield.status).toBe("unavailable");
    const zero = buildComparison({ ...internal, dividendYield: null }, {
      ...external,
      eodhd: { ...external.eodhd, dividendYield: 0 },
    });
    expect(zero.dividendYield.status).toBe("semantic_unavailable");
  });
});
