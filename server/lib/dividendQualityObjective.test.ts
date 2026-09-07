import { describe, expect, it } from "vitest";
import {
  DIVIDEND_QUALITY_10Y_DEFAULT_ENABLED,
  DIVIDEND_QUALITY_10Y_LOOKBACK_DAYS,
  resolveDividendQualityObjective,
  hasTenYearPriceHistory,
  historicalPriceKeyForDividendQuality,
} from "./dividendQualityObjective";

describe("dividend quality objective", () => {
  it("keeps the advanced dividend-quality mode disabled by default", () => {
    expect(DIVIDEND_QUALITY_10Y_DEFAULT_ENABLED).toBe(false);
  });

  it("combines dividend quality, Sharpe and historic drawdown only when explicitly selected", () => {
    const objective = resolveDividendQualityObjective({
      investmentGoal: "dividends",
      selection: "dividend_quality_10y",
    });

    expect(objective).toMatchObject({
      id: "dividend_quality_10y",
      method: "max_sharpe",
      lookbackDays: DIVIDEND_QUALITY_10Y_LOOKBACK_DAYS,
      requiresTenYearHistory: true,
      userConstraints: {
        minDividendYield: 0.025,
        minSharpe: 0.5,
        maxDrawdown: 0.25,
      },
    });
  });

  it("does not apply the advanced objective to non-dividend goals", () => {
    expect(resolveDividendQualityObjective({
      investmentGoal: "growth",
      selection: "dividend_quality_10y",
    }).id).toBe("standard");
  });

  it("requires a price observation on or before the exact ten-year cutoff", () => {
    const asOf = new Date("2026-09-07T12:00:00.000Z");

    expect(hasTenYearPriceHistory("2016-09-07", asOf)).toBe(true);
    expect(hasTenYearPriceHistory("2016-09-08", asOf)).toBe(false);
    expect(hasTenYearPriceHistory(null, asOf)).toBe(false);
  });

  it("uses the canonical historical-price key for the ten-year gate", () => {
    expect(historicalPriceKeyForDividendQuality("AAPL")).toBe("AAPL.US");
    expect(historicalPriceKeyForDividendQuality("MSFT.US")).toBe("MSFT.US");
    expect(historicalPriceKeyForDividendQuality("ENEL.MI")).toBe("ENEL.MI");
  });
});
