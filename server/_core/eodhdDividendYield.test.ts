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

  it("gleicht GBP-Cash-Ereignisse einer in GBp notierten Londoner Kurslinie ohne FX-Schätzung an", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([
      { date: "2026-04-10", value: 0.103, currency: "GBP", period: "Interim" },
      { date: "2026-09-10", value: 0.103, currency: "GBP", period: "Final" },
    ])));

    const { fetchEodhdTrailingDividendYield } = await import("./eodhdDividendYield");
    const result = await fetchEodhdTrailingDividendYield({
      ticker: "MNG.L",
      // EODHD LSE close: 312 GBp = GBP 3.12
      currentPrice: 312,
      tradingCurrency: "GBX",
      asOfDate: "2026-10-22",
    });

    expect(result).toMatchObject({
      status: "available",
      annualDividendPerShare: 0.206,
      currency: "GBP",
      eventCount: 2,
    });
    expect(result.dividendYieldPct).toBeCloseTo((0.206 / 3.12) * 100, 10);
  });

  it("teilt einen bereits in GBP gelieferten Londoner Kurs nicht nochmals durch 100", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([
      { date: "2025-12-18", value: 0.40758, currency: "GBP" },
      { date: "2026-03-19", value: 0.34257, currency: "GBP" },
      { date: "2026-06-18", value: 0.6833, currency: "GBP" },
      { date: "2026-09-17", value: 0.40694, currency: "GBP" },
    ])));

    const { fetchEodhdTrailingDividendYield } = await import("./eodhdDividendYield");
    const result = await fetchEodhdTrailingDividendYield({
      ticker: "VWRL.L",
      // EODHD reports this listing as GBP, not GBX.
      currentPrice: 137.31,
      tradingCurrency: "GBP",
      asOfDate: "2026-10-22",
    });

    expect(result).toMatchObject({ status: "available", currency: "GBP", eventCount: 4 });
    expect(result.dividendYieldPct).toBeCloseTo((1.84039 / 137.31) * 100, 10);
  });
});
