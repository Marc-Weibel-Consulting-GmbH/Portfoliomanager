import { describe, expect, it } from "vitest";
import { calculateHistoricalAnnualizedReturn } from "./historicalReturnEvidence";

describe("calculateHistoricalAnnualizedReturn", () => {
  it("berechnet eine geometrische annualisierte historische Rendite statt eines arithmetischen Tagesmittels", () => {
    const result = calculateHistoricalAnnualizedReturn({
      dailyReturns: [0.10, -0.10],
      tradingDaysPerYear: 2,
    });

    // (1.10 × 0.90)^(2 / 2) - 1 = -1 %, während das arithmetische Mittel 0 % wäre.
    expect(result).toBeCloseTo(-0.01, 10);
  });

  it("gibt keine langfristige Kennzahl für eine leere oder nicht endliche Reihe aus", () => {
    expect(calculateHistoricalAnnualizedReturn({ dailyReturns: [], tradingDaysPerYear: 252 })).toBeNull();
    expect(calculateHistoricalAnnualizedReturn({ dailyReturns: [0.01, Number.NaN], tradingDaysPerYear: 252 })).toBeNull();
  });
});
