import { describe, expect, it } from "vitest";
import { resolveHistoricalEntryPrice } from "./entryPriceLookup";

describe("resolveHistoricalEntryPrice", () => {
  const rows = [
    { ticker: "PST.MI", date: "2026-09-07", close: "25.000000", adjustedClose: "25.120000", currency: "EUR" },
    { ticker: "PST.MI", date: "2026-09-08", close: "25.400000", adjustedClose: "25.510000", currency: "EUR" },
  ];

  it("verwendet den splitbereinigten Schlusskurs des gewählten Handelstags und rechnet ihn nach CHF um", () => {
    expect(resolveHistoricalEntryPrice({
      rows,
      requestedDate: "2026-09-08",
      nativeCurrency: "EUR",
      historicalPriceCurrency: "EUR",
      fxRateToChf: 0.938,
    })).toEqual({
      status: "available",
      requestedDate: "2026-09-08",
      effectiveDate: "2026-09-08",
      priceLocal: 25.51,
      priceCurrency: "EUR",
      fxRateToChf: 0.938,
      priceChf: 23.92838,
    });
  });

  it("verwendet bei Wochenende oder Feiertag nur den letzten vorhergehenden Handelstag", () => {
    const result = resolveHistoricalEntryPrice({
      rows,
      requestedDate: "2026-09-12",
      nativeCurrency: "EUR",
      historicalPriceCurrency: "EUR",
      fxRateToChf: 0.94,
    });

    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.effectiveDate).toBe("2026-09-08");
    }
  });

  it("weist eine abweichende ADR- oder Proxywährung als Datenlücke aus", () => {
    expect(resolveHistoricalEntryPrice({
      rows,
      requestedDate: "2026-09-08",
      nativeCurrency: "SGD",
      historicalPriceCurrency: "USD",
      fxRateToChf: 0.9,
    })).toMatchObject({ status: "incompatible_price_basis" });
  });

  it("erfindet bei fehlendem FX-Kurs keinen CHF-Einstand", () => {
    expect(resolveHistoricalEntryPrice({
      rows,
      requestedDate: "2026-09-08",
      nativeCurrency: "EUR",
      historicalPriceCurrency: "EUR",
      fxRateToChf: null,
    })).toMatchObject({ status: "fx_missing" });
  });
});
