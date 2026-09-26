import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

describe("EODHD annual dividend yield normalization", () => {
  it("prefers explicit ForwardAnnualDividendYield over an inconsistent Highlights.DividendYield", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      General: { Name: "Aker BP ASA", CurrencyCode: "NOK" },
      Highlights: { DividendYield: 0.0072 },
      SplitsDividends: {
        ForwardAnnualDividendRate: 25.7,
        ForwardAnnualDividendYield: 0.0713,
      },
    }), { status: 200 }));

    const { fetchEODHDFundamentals } = await import("./eodhdApi");
    const result = await fetchEODHDFundamentals("AKRBP.FORWARD-TEST");

    expect(result.dividendYield).toBeCloseTo(7.13, 10);
    expect(result.dividendYieldBasis).toBe("forward_indicated");
    expect(result.forwardAnnualDividendRate).toBeCloseTo(25.7, 10);
    expect(result.forwardAnnualDividendYield).toBeCloseTo(7.13, 10);
  });
});
