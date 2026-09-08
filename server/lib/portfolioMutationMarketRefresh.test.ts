import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchEODHDRealTime: vi.fn(),
  importHistoricalPricesForTicker: vi.fn(),
  updateStock: vi.fn(),
}));

vi.mock("../_core/eodhdApi", () => ({ fetchEODHDRealTime: mocks.fetchEODHDRealTime }));
vi.mock("../jobs/importHistoricalPrices", () => ({ importHistoricalPricesForTicker: mocks.importHistoricalPricesForTicker }));
vi.mock("../db", () => ({ updateStock: mocks.updateStock }));

import { assessPortfolioMutationMarketRefresh, refreshPortfolioMutationMarketData } from "./portfolioMutationMarketRefresh";

describe("assessPortfolioMutationMarketRefresh", () => {
  beforeEach(() => vi.clearAllMocks());
  it("macht aus dem DBS-ADR-Konflikt eine Datenlücke statt einen unsicheren Preisrefresh", () => {
    expect(assessPortfolioMutationMarketRefresh("D05.SI", "SGD")).toEqual({
      ticker: "D05.SI",
      status: "data_gap",
      reason: "Historische USD-Proxyreihe ist ohne dokumentierte Ratio nicht mit dem nativen SGD-Instrument vergleichbar.",
    });
  });

  it("lässt einen Titel mit identischer nativer Preisreihenwährung für den punktuellen EODHD-Refresh zu", () => {
    expect(assessPortfolioMutationMarketRefresh("NESN.SW", "CHF")).toEqual({
      ticker: "NESN.SW",
      status: "eligible",
    });
  });

  it("ruft für DBS keinen ADR-Kurs ab und überschreibt den nativen Stammkurs nicht", async () => {
    mocks.updateStock.mockResolvedValue(undefined);

    await expect(refreshPortfolioMutationMarketData([{ ticker: "D05.SI", currency: "SGD" }])).resolves.toEqual([
      {
        ticker: "D05.SI",
        status: "data_gap",
        reason: "Historische USD-Proxyreihe ist ohne dokumentierte Ratio nicht mit dem nativen SGD-Instrument vergleichbar.",
      },
    ]);

    expect(mocks.fetchEODHDRealTime).not.toHaveBeenCalled();
    expect(mocks.importHistoricalPricesForTicker).not.toHaveBeenCalled();
    expect(mocks.updateStock).toHaveBeenCalledWith("D05.SI", expect.objectContaining({
      dataQualityStatus: "data_gap",
      dataQualityNotes: expect.stringContaining("USD-Proxyreihe"),
    }));
    expect(mocks.updateStock).not.toHaveBeenCalledWith("D05.SI", expect.objectContaining({ currentPrice: expect.anything() }));
  });
});
