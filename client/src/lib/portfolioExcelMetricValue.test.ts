import { describe, expect, it } from "vitest";
import { getPortfolioExcelMetricValue } from "./portfolioExcelMetricValue";

describe("getPortfolioExcelMetricValue", () => {
  it("wandelt Prozentpunkte für das native Excel-Prozentformat genau einmal in Dezimalwerte um", () => {
    expect(getPortfolioExcelMetricValue({ value: 9.827, unit: "percent" })).toBeCloseTo(0.09827, 8);
    expect(getPortfolioExcelMetricValue({ value: -11.2, unit: "percent" })).toBeCloseTo(-0.112, 8);
  });

  it("belässt CHF- und Ratio-Werte unverändert", () => {
    expect(getPortfolioExcelMetricValue({ value: 499_117, unit: "CHF" })).toBe(499_117);
    expect(getPortfolioExcelMetricValue({ value: -0.09, unit: "ratio" })).toBe(-0.09);
  });
});
