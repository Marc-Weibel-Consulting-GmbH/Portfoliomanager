import { describe, expect, it } from "vitest";
import { calculateEquivalentValueSwap, selectComparableAlternatives, type AlternativeStock } from "./portfolioAlternatives";

const candidate = (ticker: string, patch: Partial<AlternativeStock> = {}): AlternativeStock => ({
  ticker,
  companyName: ticker,
  sector: "Financial Services",
  industry: "Banks",
  category: "Value",
  currency: "CHF",
  currentPrice: 100,
  dividendYield: 3,
  sharpeRatio: 1,
  beta: 0.5,
  quality: 60,
  valuation: 60,
  timing: 60,
  signalScore: 60,
  signalLabel: "HOLD",
  dataQualityStatus: "verified",
  isActive: true,
  ...patch,
});

describe("selectComparableAlternatives", () => {
  it("selects at most five priced, same-sector and same-currency alternatives", () => {
    const result = selectComparableAlternatives({
      source: { ticker: "LUKN.SW", sector: "Financial Services", industry: "Banks", category: "Value", currency: "CHF" },
      heldTickers: ["LUKN.SW", "HELD.SW"],
      candidates: [
        candidate("HELD.SW", { signalScore: 99 }),
        candidate("SGKN.SW", { signalScore: 70 }),
        candidate("VATN.SW", { signalScore: 65 }),
        candidate("VONN.SW", { signalScore: 55, industry: "Capital Markets" }),
        candidate("CMBN.SW", { signalScore: 75 }),
        candidate("A.SW", { signalScore: 50 }),
        candidate("B.SW", { signalScore: 45 }),
        candidate("USD.BANK", { currency: "USD", signalScore: 99 }),
        candidate("TECH.SW", { sector: "Technology", signalScore: 99 }),
        candidate("GAP.SW", { dataQualityStatus: "data_gap", signalScore: 99 }),
      ],
    });

    expect(result).toHaveLength(5);
    expect(result.map((item) => item.ticker)).toEqual(["CMBN.SW", "SGKN.SW", "VATN.SW", "A.SW", "B.SW"]);
    expect(result.every((item) => item.currency === "CHF" && item.sector === "Financial Services")).toBe(true);
  });

  it("never substitutes an ETF, a held stock, or a candidate with no usable price", () => {
    const result = selectComparableAlternatives({
      source: { ticker: "LUKN.SW", sector: "Financial Services", industry: null, category: "Value", currency: "CHF" },
      heldTickers: [],
      candidates: [
        candidate("ETF.SW", { category: "ETF" }),
        candidate("NOPRICE.SW", { currentPrice: null }),
        candidate("VALID.SW"),
      ],
    });
    expect(result.map((item) => item.ticker)).toEqual(["VALID.SW"]);
  });
});

describe("calculateEquivalentValueSwap", () => {
  it("preserves the source CHF value to share precision and reports the residual", () => {
    const result = calculateEquivalentValueSwap({
      sourceShares: 84.91,
      sourcePriceLocal: 118.6,
      sourceExchangeRateToChf: 1,
      targetPriceLocal: 691,
      targetExchangeRateToChf: 1,
    });
    expect(result.sourceValueChf).toBeCloseTo(10_070.326, 6);
    expect(result.targetShares).toBe(14.573554);
    expect(result.targetValueChf + result.cashResidualChf).toBeCloseTo(result.sourceValueChf, 6);
    expect(Math.abs(result.cashResidualChf)).toBeLessThan(0.01);
  });

  it("rejects a missing or invalid quote instead of estimating a target quantity", () => {
    expect(() => calculateEquivalentValueSwap({
      sourceShares: 10,
      sourcePriceLocal: 100,
      sourceExchangeRateToChf: 1,
      targetPriceLocal: 0,
      targetExchangeRateToChf: 1,
    })).toThrow("gültige Stück");
  });
});
