import { describe, expect, it, vi } from "vitest";

vi.mock("./eodhdDividendYield", () => ({
  fetchEodhdTrailingDividendYield: vi.fn(async () => ({
    status: "no_qualifying_events",
    basis: null,
    dividendYieldPct: null,
    annualDividendPerShare: null,
    currency: "GBX",
    eventCount: 0,
    excludedSpecialEventCount: 0,
    asOfDate: "2026-10-22",
    source: "EODHD /api/div",
  })),
}));

describe("Dividend yield enrichment", () => {
  it("labels a GBX London forward rate as GBP cash rather than pence", async () => {
    const { resolveDividendYieldEnrichment } = await import("./dividendYieldEnrichment");
    const result = await resolveDividendYieldEnrichment({
      ticker: "BATS.L",
      currentPrice: 4445,
      currency: "GBX",
      fundamentals: {
        dividendYieldBasis: "forward_indicated",
        dividendYield: 5.59,
        forwardAnnualDividendRate: 2.45,
      } as any,
      asOfDate: "2026-10-22",
    });

    expect(result).toMatchObject({
      dividendYield: 5.59,
      dividendYieldBasis: "forward_indicated",
      dividendAnnualAmount: 2.45,
      dividendCurrency: "GBP",
    });
  });
});
