import { describe, expect, it } from "vitest";
import { toVerifiedDividendYieldUpdate } from "./dividendYieldPersistence";

describe("toVerifiedDividendYieldUpdate", () => {
  it("bewahrt eine ereignisbasiert verifizierte TTM-Rendite im Prozentformat statt einen Legacy-Anbieterwert zu übernehmen", () => {
    const update = toVerifiedDividendYieldUpdate({
      dividendYield: 6.506594315245478,
      dividendYieldBasis: "ttm_gross",
      dividendAnnualAmount: 25.18052,
      dividendCurrency: "NOK",
      dividendEventCount: 4,
      dividendAsOfDate: "2026-10-22",
      dividendYieldSource: "EODHD /api/div",
    });

    expect(update).toEqual({
      dividendYield: "6.5066",
      dividendYieldBasis: "ttm_gross",
      dividendAnnualAmount: "25.180520",
      dividendCurrency: "NOK",
      dividendEventCount: 4,
      dividendAsOfDate: "2026-10-22",
      dividendYieldSource: "EODHD /api/div",
    });
    expect(update.dividendYield).not.toBe("0.6800");
  });

  it("schreibt bei einer Datenlücke keinen ungeprüften Multi-Provider-Fallback in die Stammdaten", () => {
    expect(toVerifiedDividendYieldUpdate({
      dividendYield: null,
      dividendYieldBasis: null,
      dividendAnnualAmount: null,
      dividendCurrency: null,
      dividendEventCount: null,
      dividendAsOfDate: "2026-10-22",
      dividendYieldSource: null,
    })).toEqual({});
  });
});
