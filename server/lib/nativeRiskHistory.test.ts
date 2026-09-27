import { describe, expect, it } from "vitest";
import {
  resolveVerifiedNativeRiskSource,
  selectRiskHistorySeries,
  type NativeRiskPriceRow,
} from "./nativeRiskHistory";

describe("resolveVerifiedNativeRiskSource", () => {
  it("allows a native Japanese line only with the matching JPY currency", () => {
    expect(resolveVerifiedNativeRiskSource({
      ticker: "6856.T",
      nativeCurrency: "JPY",
      isin: null,
    })).toMatchObject({
      source: "yahoo_native",
      sourceSymbol: "6856.T",
      sourceCurrency: "JPY",
      identity: "same_listing",
    });

    expect(resolveVerifiedNativeRiskSource({
      ticker: "6856.T",
      nativeCurrency: "EUR",
      isin: null,
    })).toBeNull();
  });

  it("allows the Bravida primary listing only for the documented ISIN and a 1:1 share basis", () => {
    expect(resolveVerifiedNativeRiskSource({
      ticker: "SE0007491303.SG",
      nativeCurrency: "EUR",
      isin: "SE0007491303",
    })).toMatchObject({
      source: "yahoo_primary_equivalent",
      sourceSymbol: "BRAV.ST",
      sourceCurrency: "SEK",
      expectedIsin: "SE0007491303",
      conversionRatio: 1,
      identity: "same_isin_primary_listing",
    });

    expect(resolveVerifiedNativeRiskSource({
      ticker: "SE0007491303.SG",
      nativeCurrency: "EUR",
      isin: "SE0000000000",
    })).toBeNull();
  });
});

describe("selectRiskHistorySeries", () => {
  const rows: NativeRiskPriceRow[] = [
    { date: "2021-09-20", close: 100 },
    { date: "2026-09-25", close: 120 },
  ];

  it("prefers a complete EODHD series in the native position currency", () => {
    expect(selectRiskHistorySeries({
      ticker: "NESN.SW",
      nativeCurrency: "CHF",
      isin: "CH0038863350",
      eodhdRows: rows,
      secondaryRows: [],
    })).toMatchObject({ source: "eodhd_primary", currency: "CHF", rows });
  });

  it("uses a native secondary series instead of an incompatible ADR proxy", () => {
    expect(selectRiskHistorySeries({
      ticker: "D05.SI",
      nativeCurrency: "SGD",
      isin: null,
      eodhdRows: rows,
      secondaryRows: rows,
    })).toMatchObject({ source: "yahoo_native", currency: "SGD", rows });
  });

  it("uses the verified Bravida primary-line proxy only when its ISIN is exact", () => {
    expect(selectRiskHistorySeries({
      ticker: "SE0007491303.SG",
      nativeCurrency: "EUR",
      isin: "SE0007491303",
      eodhdRows: rows,
      secondaryRows: rows,
    })).toMatchObject({
      source: "yahoo_primary_equivalent",
      currency: "SEK",
      conversionRatio: 1,
      rows,
    });
  });

  it("does not substitute an unverified primary line", () => {
    expect(selectRiskHistorySeries({
      ticker: "SE0007491303.SG",
      nativeCurrency: "EUR",
      isin: "SE0000000000",
      eodhdRows: rows,
      secondaryRows: rows,
    })).toMatchObject({ source: "unavailable", reason: "unverified_instrument_identity" });
  });
});
