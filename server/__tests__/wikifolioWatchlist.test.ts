/**
 * F-13/F-15 unit tests: ISIN→Ticker resolution, Wikifolio search result
 * mapping, and the /aktien listType fallback decision.
 */
import { describe, it, expect, vi } from "vitest";
import { pickTickerFromQuotes, resolveIsinToTicker, isLikelyIsin } from "../lib/isinResolver";
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

  it("isLikelyIsin erkennt ISINs und weist Ticker ab (L-20)", () => {
    // echte ISINs (12 Zeichen: 2 Buchstaben + 9 alphanumerisch + Prüfziffer)
    expect(isLikelyIsin("US02079K1079")).toBe(true); // Alphabet
    expect(isLikelyIsin("CH0012005267")).toBe(true); // Novartis
    expect(isLikelyIsin("us0378331005")).toBe(true); // klein → normalisiert
    // Ticker sind keine ISINs
    expect(isLikelyIsin("AAPL")).toBe(false);
    expect(isLikelyIsin("ROG.SW")).toBe(false);
    expect(isLikelyIsin("BRK.B")).toBe(false);
    expect(isLikelyIsin("")).toBe(false);
    expect(isLikelyIsin(null)).toBe(false);
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
  it("maps search-api.wikifolio.com results to plain serializable objects", () => {
    // Neue öffentliche Such-API: title ← shortDescription, traderName ← trader.fullName/nickName,
    // wikifolioUrl wird aus dem Symbol abgeleitet; Ranking/Perf sind in der Basissuche nicht enthalten.
    const result = mapWikifolioSearchResults([
      {
        symbol: "wfglobalnt",
        shortDescription: "Global New Trends",
        trader: { fullName: "Max Muster" } as any,
        isin: "DE000LS9ABC1",
      } as any,
    ]);

    expect(result).toEqual([
      {
        symbol: "wfglobalnt",
        title: "Global New Trends",
        traderName: "Max Muster",
        rankValue: null,
        perfAnnually: null,
        perfEver: null,
        maxDrawdown: null,
        capital: null,
        isin: "DE000LS9ABC1",
        wikifolioUrl: "https://www.wikifolio.com/de/de/w/wfglobalnt",
      },
    ]);
  });

  it("drops entries without symbol and leaves optional fields empty/null", () => {
    const result = mapWikifolioSearchResults([
      {} as any,
      { symbol: "wfx" } as any,
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      symbol: "wfx",
      title: "wfx", // kein shortDescription → Fallback auf Symbol
      traderName: "",
      rankValue: null,
      perfAnnually: null,
      perfEver: null,
      maxDrawdown: null,
      capital: null,
      isin: null,
      // wikifolioUrl wird immer aus dem Symbol gebaut (nie null bei vorhandenem Symbol)
      wikifolioUrl: "https://www.wikifolio.com/de/de/w/wfx",
    });
  });
});
