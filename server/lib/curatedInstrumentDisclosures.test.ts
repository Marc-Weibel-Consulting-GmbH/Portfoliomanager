import { describe, expect, it } from "vitest";
import { getCuratedInstrumentDisclosure } from "./curatedInstrumentDisclosures";

describe("getCuratedInstrumentDisclosure", () => {
  it("liefert für CHDVD eine datierte, begrenzte Fonds-Durchschau ohne Bestandsgewichte", () => {
    expect(getCuratedInstrumentDisclosure("CHDVD.SW", { currency: "CHF" })).toMatchObject({
      identityStatus: "verified",
      isin: "CH0237935637",
      exchange: "SIX Swiss Exchange",
      mic: "XSWX",
      tradingCurrency: "CHF",
      fundTransparency: {
        kind: "limited_fund_disclosure",
        holdingsCount: 20,
        asOf: "2026-09-07",
        directWeightOnly: true,
      },
    });
    expect(getCuratedInstrumentDisclosure("CHDVD.SW", { currency: "CHF" }).fundTransparency?.constituents).toBeUndefined();
  });

  it("liefert für ABTC eine verifizierte Identität statt eine US-Basisticker-Inferenz", () => {
    expect(getCuratedInstrumentDisclosure("ABTC.SW", { currency: "CHF" })).toMatchObject({
      identityStatus: "verified",
      isin: "CH0454664001",
      exchange: "SIX Swiss Exchange",
      mic: "XSWX",
      tradingCurrency: "CHF",
      sourceUrl: "https://www.21shares.com/en-eu/product/abtc",
    });
  });

  it("kennzeichnet unbekannte Titel als unvollständig statt Metadaten zu erfinden", () => {
    expect(getCuratedInstrumentDisclosure("NOVN.SW", { currency: "CHF" })).toEqual({
      identityStatus: "incomplete",
      isin: null,
      exchange: null,
      mic: null,
      tradingCurrency: "CHF",
      sourceLabel: null,
      sourceUrl: null,
      asOf: null,
      fundTransparency: null,
    });
  });
});
