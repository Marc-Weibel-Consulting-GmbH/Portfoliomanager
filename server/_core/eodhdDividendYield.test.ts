import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("./env", () => ({
  getEodhdApiKey: vi.fn(async () => "test-token"),
}));

afterEach(() => {
  fetchMock.mockReset();
});

describe("EODHD TTM-Dividendenrendite", () => {
  it("verwendet die nach einem 1:10-Split bereinigte value statt der historischen unadjustedValue", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([
      {
        date: "2026-05-11",
        value: 0.74,
        unadjustedValue: 7.4,
        currency: "CHF",
        period: "Annual",
      },
    ])));

    const { fetchEodhdTrailingDividendYield } = await import("./eodhdDividendYield");
    const result = await fetchEodhdTrailingDividendYield({
      ticker: "SQN.SW-SPLIT-TEST",
      currentPrice: 34.84,
      tradingCurrency: "CHF",
      asOfDate: "2026-10-09",
    });

    expect(result).toMatchObject({
      status: "available",
      annualDividendPerShare: 0.74,
      eventCount: 1,
    });
    expect(result.dividendYieldPct).toBeCloseTo(2.123995407577497, 10);
  });
});
