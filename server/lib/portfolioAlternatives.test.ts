import { describe, expect, it } from "vitest";
import { calculateEquivalentValueSwap, comparableIndustrySearchTerms, selectComparableAlternatives, type AlternativeStock } from "./portfolioAlternatives";

const candidate = (ticker: string, patch: Partial<AlternativeStock> = {}): AlternativeStock => ({
  ticker,
  companyName: ticker,
  sector: "Financial Services",
  industry: "Banks - Regional",
  category: "Value",
  currency: "CHF",
  currentPrice: 100,
  dividendYield: 2.31,
  sharpeRatio: 1,
  beta: 0.5,
  quality: 60,
  valuation: 60,
  timing: 60,
  signalScore: 60,
  signalLabel: "HOLD",
  dataQualityStatus: "verified",
  isActive: true,
  isCantonalBank: false,
  ...patch,
});

const lukn = {
  ticker: "LUKN.SW",
  sector: "Financial Services",
  industry: "Banks - Regional",
  category: "Value",
  currency: "CHF",
  dividendYield: 2.31,
  isCantonalBank: true,
};

describe("selectComparableAlternatives", () => {
  it("expands only the verified insurer sub-industry family", () => {
    expect(comparableIndustrySearchTerms("Insurance - Diversified")).toEqual([
      "Insurance - Diversified",
      "Insurance - Life",
      "Insurance - Reinsurance",
    ]);
    expect(comparableIndustrySearchTerms("Integrated Freight & Logistics")).toEqual([
      "Integrated Freight & Logistics",
    ]);
  });

  it("selects at most five priced, exact-industry and dividend-similar alternatives", () => {
    const result = selectComparableAlternatives({
      source: lukn,
      heldTickers: ["LUKN.SW", "HELD.SW"],
      candidates: [
        candidate("HELD.SW", { signalScore: 99 }),
        candidate("SGKN.SW", { companyName: "St Galler Kantonalbank", dividendYield: 2.95, isCantonalBank: true, signalScore: 55 }),
        candidate("TKBP.SW", { companyName: "Thurgauer Kantonalbank", dividendYield: 2.25, isCantonalBank: true, signalScore: 50 }),
        candidate("BLKB.SW", { companyName: "Basellandschaftliche Kantonalbank", dividendYield: 3.59, isCantonalBank: true, signalScore: 99 }),
        candidate("OTHER.SW", { dividendYield: 2.8, signalScore: 75 }),
        candidate("TOO_HIGH.SW", { dividendYield: 3.32, signalScore: 99 }),
        candidate("TOO_LOW.SW", { dividendYield: 1.3, signalScore: 99 }),
        candidate("USD.BANK", { currency: "USD", dividendYield: 2.3, signalScore: 99 }),
        candidate("TECH.SW", { sector: "Technology", dividendYield: 2.3, signalScore: 99 }),
        candidate("GAP.SW", { dataQualityStatus: "data_gap", dividendYield: 2.3, signalScore: 99 }),
      ],
    });

    // Schweizer CHF-Peers stehen vor einem ansonsten höher gerankten USD-Peer.
    expect(result.map((item) => item.ticker)).toEqual(["SGKN.SW", "TKBP.SW", "OTHER.SW", "USD.BANK"]);
    expect(result.every((item) => item.industry === "Banks - Regional" && item.sector === "Financial Services")).toBe(true);
    expect(result.every((item) => Math.abs((item.dividendYield ?? 0) - 2.31) <= 1)).toBe(true);
  });

  it("prioritizes cantonal-bank peers when the selected company is a cantonal bank", () => {
    const result = selectComparableAlternatives({
      source: lukn,
      heldTickers: [],
      candidates: [
        candidate("BAER.SW", { industry: "Capital Markets", dividendYield: 2.2, signalScore: 99 }),
        candidate("SGKN.SW", { companyName: "St Galler Kantonalbank", dividendYield: 2.4, isCantonalBank: true, signalScore: 1 }),
        candidate("TKBP.SW", { companyName: "Thurgauer Kantonalbank", dividendYield: 2.5, isCantonalBank: true, signalScore: 1 }),
      ],
    });
    expect(result.map((item) => item.ticker)).toEqual(["SGKN.SW", "TKBP.SW"]);
    expect(result.slice(0, 2).every((item) => item.isCantonalBank)).toBe(true);
  });

  it("never falls back from an exact logistics industry to unrelated sector peers", () => {
    const result = selectComparableAlternatives({
      source: {
        ticker: "KNIN.SW",
        sector: "Industrials",
        industry: "Integrated Freight & Logistics",
        category: "Value",
        currency: "CHF",
        dividendYield: 2.6,
        isCantonalBank: false,
      },
      heldTickers: ["KNIN.SW"],
      candidates: [
        candidate("GEBN.SW", { sector: "Industrials", industry: "Building Products", currency: "CHF", dividendYield: 2.35 }),
        candidate("GF.SW", { sector: "Industrials", industry: "Specialty Industrial Machinery", currency: "CHF", dividendYield: 2.31 }),
        candidate("DHL.DE", { sector: "Industrials", industry: "Integrated Freight & Logistics", currency: "EUR", dividendYield: 3.24 }),
      ],
    });

    expect(result.map((item) => item.ticker)).toEqual(["DHL.DE"]);
    expect(result.every((item) => item.industry === "Integrated Freight & Logistics")).toBe(true);
  });

  it("never substitutes an ETF, a held stock, or a ticker alias of a held stock", () => {
    const result = selectComparableAlternatives({
      source: { ...lukn, ticker: "LUKN.SW" },
      heldTickers: ["ABB.SW", "NVDA"],
      candidates: [
        candidate("ETF.SW", { category: "ETF" }),
        candidate("NOPRICE.SW", { currentPrice: null }),
        candidate("ABBN.SW", { dividendYield: 2.3 }),
        candidate("NVDA.US", { dividendYield: 2.3 }),
        candidate("VALID.SW", { dividendYield: 2.3 }),
      ],
    });
    expect(result.map((item) => item.ticker)).toEqual(["VALID.SW"]);
  });

  it("excludes a Roche participation line when the Roche bearer share is already held", () => {
    const source = {
      ticker: "RO.SW",
      companyName: "Roche Holding AG",
      sector: "Healthcare",
      industry: "Drug Manufacturers - General",
      category: "Value",
      currency: "CHF",
      dividendYield: 2.5,
      isCantonalBank: false,
    };
    const result = selectComparableAlternatives({
      source,
      heldTickers: ["RO.SW"],
      heldCompanyNames: ["Roche Holding AG"],
      candidates: [
        candidate("RHHVF", {
          companyName: "Roche Holding AG Participation",
          sector: source.sector,
          industry: source.industry,
          dividendYield: 2.2,
          currency: "USD",
        }),
        candidate("RHHBY", {
          companyName: "Roche Holding Ltd Participation Certificate",
          sector: source.sector,
          industry: source.industry,
          dividendYield: 2.2,
          currency: "USD",
        }),
        candidate("NOVN.SW", {
          companyName: "Novartis AG",
          sector: source.sector,
          industry: source.industry,
          dividendYield: 3.1,
          currency: "CHF",
        }),
      ],
    });

    expect(result.map((item) => item.ticker)).toEqual(["NOVN.SW"]);
  });

  it("excludes a Zurich cross-listing and retains Swiss insurance peers", () => {
    const source = {
      ticker: "ZURN.SW",
      companyName: "Zurich Insurance G",
      sector: "Financial Services",
      industry: "Insurance - Diversified",
      category: "Dividendenaktien",
      currency: "CHF",
      dividendYield: 5.14,
      isCantonalBank: false,
    };
    const result = selectComparableAlternatives({
      source,
      heldTickers: ["ZURN.SW"],
      heldCompanyNames: ["Zurich Insurance G"],
      candidates: [
        candidate("ZFIN.DE", {
          companyName: "Zurich Insurance Group AG",
          industry: "Insurance - Diversified",
          dividendYield: 5.9,
          currency: "EUR",
        }),
        candidate("SREN.SW", {
          companyName: "Swiss Re AG",
          industry: "Insurance - Reinsurance",
          dividendYield: 4.47,
          currency: "CHF",
        }),
        candidate("SLHN.SW", {
          companyName: "Swiss Life Holding",
          industry: "Insurance - Life",
          dividendYield: 4.2,
          currency: "CHF",
        }),
        candidate("UBSG.SW", {
          companyName: "UBS Group AG",
          industry: "Capital Markets",
          dividendYield: 5.1,
          currency: "CHF",
        }),
      ],
    });

    expect(result.map((item) => item.ticker)).toEqual(expect.arrayContaining(["SREN.SW", "SLHN.SW"]));
    expect(result.every((item) => item.similarity === "insurance_family")).toBe(true);
  });

  it("keeps one preferred listing per issuer and excludes an issuer already held under another listing", () => {
    const source = {
      ticker: "SREN.SW",
      sector: "Financial Services",
      industry: "Insurance - Diversified",
      category: "Value",
      currency: "CHF",
      dividendYield: 4.8,
      isCantonalBank: false,
    };
    const result = selectComparableAlternatives({
      source,
      heldTickers: ["SREN.SW"],
      heldCompanyNames: ["Swiss Re AG"],
      candidates: [
        candidate("MUV2.DE", { companyName: "Münchener Rück", industry: source.industry, dividendYield: 4.8, currency: "EUR", origin: "local" }),
        candidate("MUV2.DE", { companyName: "Münchener Rück", industry: source.industry, dividendYield: 4.8, currency: "EUR", origin: "global" }),
        candidate("MURGY", { companyName: "Muenchener Rueckver Ges", industry: source.industry, dividendYield: 4.8, currency: "USD", origin: "global" }),
        candidate("HNR1.DE", { companyName: "Hannover Rück SE", industry: source.industry, dividendYield: 4.9, currency: "EUR", origin: "local" }),
        candidate("HVRRY", { companyName: "Hannover Re", industry: source.industry, dividendYield: 5.1, currency: "USD", origin: "global" }),
        candidate("SREN.US", { companyName: "Swiss Reinsurance Company", industry: source.industry, dividendYield: 4.7, currency: "USD", origin: "global" }),
        candidate("SZCRF", { companyName: "SCOR SE", industry: source.industry, dividendYield: 5, currency: "USD", origin: "global" }),
        candidate("SCRYY", { companyName: "SCOR PK", industry: source.industry, dividendYield: 5, currency: "USD", origin: "global" }),
      ],
    });

    expect(result.map((item) => item.ticker)).toEqual(["HNR1.DE", "MUV2.DE", "SCRYY"]);
  });

  it("returns no candidate if the source dividend yield is not verified", () => {
    const result = selectComparableAlternatives({
      source: { ...lukn, dividendYield: null },
      heldTickers: [],
      candidates: [candidate("VALID.SW")],
    });
    expect(result).toEqual([]);
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

  it("preserves CHF value for a foreign-currency peer using its verified FX rate", () => {
    const result = calculateEquivalentValueSwap({
      sourceShares: 21.722957,
      sourcePriceLocal: 231.5,
      sourceExchangeRateToChf: 1,
      targetPriceLocal: 67.25,
      targetExchangeRateToChf: 0.8273,
    });
    expect(result.targetValueChf + result.cashResidualChf).toBeCloseTo(result.sourceValueChf, 6);
    expect(result.targetShares).toBeGreaterThan(0);
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
