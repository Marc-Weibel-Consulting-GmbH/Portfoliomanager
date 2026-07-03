/**
 * F-13/F-15 unit tests: ISIN→Ticker resolution, Wikifolio search result
 * mapping, and the /aktien listType fallback decision.
 */
import { describe, it, expect, vi } from "vitest";
import { pickTickerFromQuotes, resolveIsinToTicker } from "../lib/isinResolver";
import { universeListType } from "../lib/watchlistUniverse";
import { mapWikifolioSearchResults } from "../lib/wikifolioService";

describe("isinResolver", () => {
  it("picks the first equity quote symbol", () => {
    expect(
      pickTickerFromQuotes([
        { symbol: "AAPL24.DE", quoteType: "OPTION" },
        { symbol: "AAPL", quoteType: "EQUITY" },
        { symbol: "APC.DE", quoteType: "EQUITY" },
      ])
    ).toBe("AAPL");
  });

  it("accepts ETFs", () => {
    expect(pickTickerFromQuotes([{ symbol: "VWRL.AS", quoteType: "ETF" }])).toBe("VWRL.AS");
  });

  it("returns null when no equity/ETF quote exists", () => {
    expect(pickTickerFromQuotes([{ symbol: "EURUSD=X", quoteType: "CURRENCY" }])).toBeNull();
    expect(pickTickerFromQuotes([])).toBeNull();
    expect(pickTickerFromQuotes(undefined)).toBeNull();
  });

  it("ignores quotes without a symbol", () => {
    expect(pickTickerFromQuotes([{ quoteType: "EQUITY" }, { symbol: "NESN.SW", quoteType: "EQUITY" }])).toBe("NESN.SW");
  });

  it("resolveIsinToTicker queries the injected search fn with the ISIN", async () => {
    const search = vi.fn().mockResolvedValue({ quotes: [{ symbol: "NOVN.SW", quoteType: "EQUITY" }] });
    await expect(resolveIsinToTicker(search, "CH0012005267")).resolves.toBe("NOVN.SW");
    expect(search).toHaveBeenCalledWith("CH0012005267");
  });

  it("resolveIsinToTicker returns null on empty ISIN, empty result, or search failure", async () => {
    await expect(resolveIsinToTicker(vi.fn(), "")).resolves.toBeNull();
    await expect(resolveIsinToTicker(vi.fn().mockResolvedValue({ quotes: [] }), "XX123")).resolves.toBeNull();
    await expect(resolveIsinToTicker(vi.fn().mockRejectedValue(new Error("boom")), "XX123")).resolves.toBeNull();
  });
});

describe("universeListType (F-13 graceful transition)", () => {
  it("filters to 'empfehlung' as soon as at least one active Empfehlung exists", () => {
    expect(universeListType(1)).toBe("empfehlung");
    expect(universeListType(42)).toBe("empfehlung");
  });

  it("falls back to no filter (all active rows) while nothing is marked yet", () => {
    expect(universeListType(0)).toBeNull();
  });
});

describe("mapWikifolioSearchResults", () => {
  it("maps class-instance-like results to plain serializable objects", () => {
    const result = mapWikifolioSearchResults([
      {
        symbol: "wfglobalnt",
        title: "Global New Trends",
        user: { name: "Max Muster" } as any,
        rank: 34.2,
        perfannually: 12.5,
        perfever: 210.4,
        maxdraw: -25.1,
        capital: 1_500_000,
        isin: "DE000LS9ABC1",
        wikifolioUrl: "https://www.wikifolio.com/de/de/w/wfglobalnt",
      } as any,
    ]);

    expect(result).toEqual([
      {
        symbol: "wfglobalnt",
        title: "Global New Trends",
        traderName: "Max Muster",
        rankValue: 34.2,
        perfAnnually: 12.5,
        perfEver: 210.4,
        maxDrawdown: -25.1,
        capital: 1_500_000,
        isin: "DE000LS9ABC1",
        wikifolioUrl: "https://www.wikifolio.com/de/de/w/wfglobalnt",
      },
    ]);
  });

  it("drops entries without symbol and nulls NaN/missing metrics", () => {
    const result = mapWikifolioSearchResults([
      {} as any,
      { symbol: "wfx", rank: NaN, perfannually: undefined } as any,
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      symbol: "wfx",
      title: "wfx",
      traderName: "",
      rankValue: null,
      perfAnnually: null,
      perfEver: null,
      maxDrawdown: null,
      capital: null,
      isin: null,
      wikifolioUrl: null,
    });
  });
});
