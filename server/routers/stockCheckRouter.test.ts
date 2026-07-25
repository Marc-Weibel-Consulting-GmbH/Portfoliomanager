import { describe, expect, it } from "vitest";
import {
  buildStockCheck,
  gradeEpsGrowth,
  gradePe,
  gradePs,
  gradeRevenueGrowth,
  overallGrade,
} from "./stockCheckRouter";

describe("stock check grading", () => {
  it("grades EPS growth on the documented thresholds", () => {
    expect(gradeEpsGrowth(46)).toBe("A");
    expect(gradeEpsGrowth(20)).toBe("B");
    expect(gradeEpsGrowth(7)).toBe("C");
    expect(gradeEpsGrowth(0)).toBe("D");
    expect(gradeEpsGrowth(-3)).toBe("F");
    expect(gradeEpsGrowth(null)).toBeNull();
  });

  it("grades revenue growth on the documented thresholds", () => {
    expect(gradeRevenueGrowth(17.5)).toBe("B");
    expect(gradeRevenueGrowth(25)).toBe("A");
    expect(gradeRevenueGrowth(-1)).toBe("F");
  });

  it("grades valuation ratios and rejects non-positive values", () => {
    expect(gradePe(26.8)).toBe("C");
    expect(gradePe(12)).toBe("A");
    expect(gradePe(-5)).toBeNull();
    expect(gradePs(10.2)).toBe("D");
    expect(gradePs(1.5)).toBe("A");
    expect(gradePs(0)).toBeNull();
  });

  it("averages present grades into an overall grade, ignoring nulls", () => {
    // A(4) + B(3) + C(2) + D(1) = 10/4 = 2.5 -> rundet auf B
    expect(overallGrade(["A", "B", "C", "D"])).toBe("B");
    expect(overallGrade(["A", null, null, null])).toBe("A");
    expect(overallGrade([null, null, null, null])).toBeNull();
  });
});

describe("buildStockCheck", () => {
  const metric = {
    metric: {
      peTTM: 26.4,
      psTTM: 10.0,
      epsGrowthTTMYoy: 46,
      revenueGrowthTTMYoy: 17.5,
      marketCapitalization: 4_221_230, // Millionen
      "52WeekHigh": 408.61,
      "52WeekLow": 187.46,
    },
  };

  it("assembles a full result from Finnhub payloads", () => {
    const result = buildStockCheck("GOOGL", {
      quote: { c: 349.01, dp: -0.85 },
      metric,
      earnings: [
        { period: "2026-03-31", actual: 5.11, estimate: 2.66, surprisePercent: 92 },
        { period: "2025-12-31", actual: 2.1, estimate: 2.2, surprisePercent: -4.5 },
      ],
      calendar: {
        earningsCalendar: [
          { date: "2026-10-22", hour: "amc", epsEstimate: 3.1, revenueEstimate: null },
          { date: "2026-07-22", hour: "amc", epsEstimate: 2.87, revenueEstimate: 113_600_000_000 },
        ],
      },
      recommendations: [
        { period: "2026-07-01", strongBuy: 20, buy: 30, hold: 10, sell: 1, strongSell: 0 },
      ],
    });

    expect(result.quote.price).toBe(349.01);
    expect(result.valuation.marketCap).toBe(4_221_230_000_000);
    expect(result.score).toEqual({
      epsGrowth: "A",
      revenueGrowth: "B",
      pe: "C",
      ps: "D",
      overall: "B", // (4+3+2+1)/4 = 2.5, Math.round -> 3 -> B
    });
    // Frühester Termin gewinnt, unabhängig von der Reihenfolge im Payload
    expect(result.nextEarnings?.date).toBe("2026-07-22");
    expect(result.earningsHistory[0]).toMatchObject({ beat: true });
    expect(result.earningsHistory[1]).toMatchObject({ beat: false });
    expect(result.analystTrend?.strongBuy).toBe(20);
  });

  it("survives completely missing sections", () => {
    const result = buildStockCheck("GOOGL", {
      quote: null,
      metric: null,
      earnings: null,
      calendar: null,
      recommendations: null,
    });
    expect(result.quote.price).toBeNull();
    expect(result.score.overall).toBeNull();
    expect(result.earningsHistory).toEqual([]);
    expect(result.nextEarnings).toBeNull();
    expect(result.analystTrend).toBeNull();
  });
});
