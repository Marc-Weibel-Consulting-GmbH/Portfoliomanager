import { describe, expect, it } from "vitest";
import {
  MIN_QUALIFIED_RISK_DAYS,
  assessPortfolioRiskWindow,
} from "./portfolioRiskWindow";

function calendarDays(from: string, count: number): string[] {
  const start = new Date(`${from}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const current = new Date(start);
    current.setUTCDate(current.getUTCDate() + index);
    return current.toISOString().slice(0, 10);
  });
}

const fiveYearDates = [
  "2021-09-24",
  ...calendarDays("2022-01-01", MIN_QUALIFIED_RISK_DAYS - 2),
  "2026-09-24",
];

const completeCoverage = [
  { key: "NESN.SW", kind: "price" as const, supportsWindowStart: true, supportsWindowEnd: true },
  { key: "USDCHF", kind: "fx" as const, supportsWindowStart: true, supportsWindowEnd: true },
];

describe("assessPortfolioRiskWindow", () => {
  it("qualifies only a five-calendar-year series that includes objective benchmark stress", () => {
    const assessment = assessPortfolioRiskWindow({
      asOfDate: "2026-09-24",
      qualifiedDates: fiveYearDates,
      coverage: completeCoverage,
      benchmark: {
        key: "SMI",
        points: [
          { date: "2021-09-24", close: 12_500 },
          { date: "2022-01-04", close: 13_000 },
          { date: "2022-10-03", close: 10_400 },
          { date: "2026-09-24", close: 14_000 },
        ],
      },
    });

    expect(assessment.status).toBe("five_year_with_stress");
    expect(assessment.canPublishMaxDrawdown).toBe(true);
    expect(assessment.targetStart).toBe("2021-09-24");
    expect(assessment.stressEvidence).toMatchObject({
      qualified: true,
      benchmark: "SMI",
      peakDate: "2022-01-04",
      troughDate: "2022-10-03",
    });
    expect(assessment.stressEvidence.observedDrawdownPct).toBeCloseTo(-20, 8);
  });

  it("does not publish a maximum drawdown when five years have no verified stress episode", () => {
    const assessment = assessPortfolioRiskWindow({
      asOfDate: "2026-09-24",
      qualifiedDates: fiveYearDates,
      coverage: completeCoverage,
      benchmark: {
        key: "SMI",
        points: [
          { date: "2021-09-24", close: 100 },
          { date: "2022-01-04", close: 110 },
          { date: "2022-10-03", close: 98 },
          { date: "2026-09-24", close: 120 },
        ],
      },
    });

    expect(assessment.status).toBe("five_year_without_stress");
    expect(assessment.canPublishMaxDrawdown).toBe(false);
    expect(assessment.stressEvidence.qualified).toBe(false);
  });

  it("rejects an apparently long series if a holding has no start-of-window price", () => {
    const assessment = assessPortfolioRiskWindow({
      asOfDate: "2026-09-24",
      qualifiedDates: fiveYearDates,
      coverage: [
        ...completeCoverage,
        { key: "NVDA", kind: "price", supportsWindowStart: false, supportsWindowEnd: true },
      ],
      benchmark: { key: "SMI", points: [] },
    });

    expect(assessment.status).toBe("insufficient_history");
    expect(assessment.canPublishMaxDrawdown).toBe(false);
    expect(assessment.coverageIssues).toContainEqual(expect.objectContaining({ key: "NVDA", kind: "price" }));
  });

  it("classifies an FX gap as incompatible rather than valuing foreign currency at par", () => {
    const assessment = assessPortfolioRiskWindow({
      asOfDate: "2026-09-24",
      qualifiedDates: fiveYearDates,
      coverage: [
        ...completeCoverage,
        { key: "SGDCHF", kind: "fx", supportsWindowStart: false, supportsWindowEnd: true },
      ],
      benchmark: { key: "SMI", points: [] },
    });

    expect(assessment.status).toBe("incompatible_history");
    expect(assessment.canPublishMaxDrawdown).toBe(false);
  });

  it("rejects a shortened observation count even when the endpoints span five calendar years", () => {
    const assessment = assessPortfolioRiskWindow({
      asOfDate: "2026-09-24",
      qualifiedDates: ["2021-09-24", "2026-09-24"],
      coverage: completeCoverage,
      benchmark: { key: "SMI", points: [] },
    });

    expect(assessment.status).toBe("insufficient_history");
    expect(assessment.historyObservationCount).toBe(2);
  });

  it("removes an isolated benchmark scale-break instead of accepting a false 99% crisis", () => {
    const assessment = assessPortfolioRiskWindow({
      asOfDate: "2026-09-24",
      qualifiedDates: fiveYearDates,
      coverage: completeCoverage,
      benchmark: {
        key: "SPI",
        points: [
          { date: "2021-09-24", close: 100 },
          { date: "2022-01-04", close: 120 },
          { date: "2022-10-03", close: 96 },
          // Isolated legacy index-scale row between ETF observations.
          { date: "2024-01-01", close: 11_500 },
          { date: "2024-01-02", close: 124 },
          { date: "2026-09-24", close: 140 },
        ],
      },
    });

    expect(assessment.status).toBe("five_year_with_stress");
    expect(assessment.stressEvidence.observedDrawdownPct).toBeCloseTo(-20, 8);
    expect(assessment.benchmarkOutlierCount).toBe(1);
    expect(assessment.benchmarkPoints).not.toContainEqual(expect.objectContaining({ date: "2024-01-01" }));
  });
});
