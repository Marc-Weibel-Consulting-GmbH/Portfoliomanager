import { describe, expect, it } from "vitest";
import { canonicalCompanyIdentity, filterExactIndustryScreenerPeers } from "./globalIndustryPeerSearch";

const logistics = "Integrated Freight & Logistics";

const item = (patch: Partial<{
  code: string;
  exchange: string;
  name: string;
  sector: string | null;
  industry: string | null;
  currency: string | null;
  dividendYield: number | null;
  marketCap: number | null;
}> = {}) => ({
  code: "DHL",
  exchange: "XETRA",
  name: "Deutsche Post AG",
  sector: "Industrials",
  industry: logistics,
  currency: "EUR",
  dividendYield: 3.24,
  marketCap: 50_000_000_000,
  ...patch,
});

describe("filterExactIndustryScreenerPeers", () => {
  it("normalizes legal-form and ampersand variations for issuer exclusion", () => {
    expect(canonicalCompanyIdentity("Kuehne & Nagel")).toBe(canonicalCompanyIdentity("Kuehne + Nagel International AG"));
  });

  it("accepts an exact-industry primary listing", () => {
    const result = filterExactIndustryScreenerPeers({
      items: [item()],
      requestedExchange: "xetra",
      industry: logistics,
      knownTickerIdentities: ["KNIN.SW"],
      knownCompanyNames: ["Kuehne & Nagel"],
    });
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("DHL");
  });

  it("rejects a non-requested exchange, adjacent industrial sector peer, ADR and duplicate company", () => {
    const result = filterExactIndustryScreenerPeers({
      items: [
        item({ exchange: "US", code: "FDX", name: "FedEx Corporation" }),
        item({ industry: "Building Products", code: "GEBN", name: "Geberit AG" }),
        item({ name: "DEUTSCHE POST SPONS. ADR", code: "DPWA" }),
        item({ name: "Kuehne & Nagel", code: "KNIN" }),
      ],
      requestedExchange: "xetra",
      industry: logistics,
      knownTickerIdentities: ["KNIN.SW"],
      knownCompanyNames: ["Kuehne & Nagel"],
    });
    expect(result).toEqual([]);
  });

  it("rejects an Alphabet share class at the screener boundary before remote enrichment", () => {
    const result = filterExactIndustryScreenerPeers({
      items: [item({
        code: "GOOG",
        exchange: "US",
        name: "Alphabet C (Google)",
        sector: "Communication Services",
        industry: "Internet Content & Information",
        currency: "USD",
      })],
      requestedExchange: "us",
      industry: "Internet Content & Information",
      knownTickerIdentities: ["GOOGL"],
      knownCompanyNames: ["Alphabet Inc"],
    });

    expect(result).toEqual([]);
  });

  it("rejects missing dividend yield and insufficient market capitalization", () => {
    const result = filterExactIndustryScreenerPeers({
      items: [item({ dividendYield: null }), item({ marketCap: 999_999_999 })],
      requestedExchange: "xetra",
      industry: logistics,
      knownTickerIdentities: [],
    });
    expect(result).toEqual([]);
  });
});
