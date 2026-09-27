import { describe, expect, it } from "vitest";
import { calculateAnnualizedAllocationReturn } from "./portfolioRiskAnalytics";

describe("calculateAnnualizedAllocationReturn", () => {
  it("calculates geometric 5Y return from the same daily allocation proxy as risk metrics", () => {
    expect(calculateAnnualizedAllocationReturn([
      { date: "2021-09-27", portfolioValueCHF: 100 },
      { date: "2026-09-27", portfolioValueCHF: 161.051 },
    // Die zentrale Konvention verwendet 365.25 Tage pro Jahr; über den
    // kalendarischen Fünfjahreszeitraum ergibt dies einen minimalen Day-count-
    // Unterschied zum gerundeten Nominalwert von genau 10.0000 %.
    ])).toBeCloseTo(0.1, 4);
  });

  it("returns null for an unusable or single-point allocation series", () => {
    expect(calculateAnnualizedAllocationReturn([])).toBeNull();
    expect(calculateAnnualizedAllocationReturn([{ date: "2021-09-27", portfolioValueCHF: 100 }])).toBeNull();
  });
});
