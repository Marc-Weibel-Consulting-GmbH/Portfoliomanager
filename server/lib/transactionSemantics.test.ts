/**
 * Unit tests for the async R-15 resolution path in transactionSemantics:
 * resolveGrossAmountCHF / withResolvedGrossAmountCHF (FX lookup at the
 * TRANSACTION DATE before the last-resort local-amount fallback).
 */

import { describe, it, expect, vi } from "vitest";
import {
  resolveGrossAmountCHF,
  withResolvedGrossAmountCHF,
  getGrossAmountCHF,
  type FxRateForDateLookup,
  type ResolvableTransactionFields,
} from "./transactionSemantics";

const noLookup: FxRateForDateLookup = async () => {
  throw new Error("lookup must not be called");
};

function usdBuy(overrides: Partial<ResolvableTransactionFields> = {}): ResolvableTransactionFields {
  return {
    transactionType: "buy",
    currency: "USD",
    totalAmount: "2000",
    totalAmountCHF: null,
    fxRate: null,
    transactionDate: new Date("2025-03-03T10:00:00Z"),
    ...overrides,
  };
}

describe("resolveGrossAmountCHF", () => {
  it("totalAmountCHF vorhanden → kein Lookup, Wert direkt", async () => {
    const result = await resolveGrossAmountCHF(usdBuy({ totalAmountCHF: "1760" }), noLookup);
    expect(result).toBe(1760);
  });

  it("gespeicherter fxRate → kein Lookup, totalAmount × fxRate", async () => {
    const result = await resolveGrossAmountCHF(usdBuy({ fxRate: "0.88" }), noLookup);
    expect(result).toBeCloseTo(1760, 10);
  });

  it("CHF-Zeile ohne totalAmountCHF → Lokalbetrag IST CHF, kein Lookup", async () => {
    const result = await resolveGrossAmountCHF(
      usdBuy({ currency: "CHF", totalAmount: "9500" }),
      noLookup
    );
    expect(result).toBe(9500);
  });

  it("Zeile ohne currency → kein Lookup möglich, Lokalbetrag als Fallback", async () => {
    const result = await resolveGrossAmountCHF(usdBuy({ currency: null }), noLookup);
    expect(result).toBe(2000);
  });

  it("Rate gefunden → totalAmount × Rate zum TRANSAKTIONSDATUM", async () => {
    const lookup = vi.fn(async (currency: string, date: string) =>
      currency === "USD" && date === "2025-03-03" ? 0.88 : null
    );
    const result = await resolveGrossAmountCHF(usdBuy(), lookup);
    expect(result).toBeCloseTo(2000 * 0.88, 10);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith("USD", "2025-03-03");
  });

  it("Datum als ISO-String → Lookup mit YYYY-MM-DD", async () => {
    const lookup = vi.fn(async () => 0.9);
    const result = await resolveGrossAmountCHF(
      usdBuy({ transactionDate: "2025-03-05T10:00:00Z" }),
      lookup
    );
    expect(result).toBeCloseTo(1800, 10);
    expect(lookup).toHaveBeenCalledWith("USD", "2025-03-05");
  });

  it("Rate NICHT gefunden → letzter Fallback: Lokalbetrag (wie sync-Pfad)", async () => {
    const result = await resolveGrossAmountCHF(usdBuy(), async () => null);
    expect(result).toBe(2000);
    // Konsistent mit dem sync-Fallback:
    expect(result).toBe(getGrossAmountCHF(usdBuy()));
  });

  it("Rate 0 aus dem Lookup zählt als fehlend → Lokalbetrag", async () => {
    const result = await resolveGrossAmountCHF(usdBuy(), async () => 0);
    expect(result).toBe(2000);
  });

  it("totalAmount fehlt → 0, kein Lookup", async () => {
    const result = await resolveGrossAmountCHF(
      usdBuy({ totalAmount: null }),
      noLookup
    );
    expect(result).toBe(0);
  });
});

describe("withResolvedGrossAmountCHF", () => {
  it("füllt fehlende totalAmountCHF, lässt vorhandene Zeilen unverändert (Identität)", async () => {
    const withChf = usdBuy({ totalAmountCHF: "1760" });
    const withoutChf = usdBuy();
    const lookup = vi.fn(async () => 0.88);

    const [a, b] = await withResolvedGrossAmountCHF([withChf, withoutChf], lookup);

    // Zeile mit totalAmountCHF: identische Referenz, kein Lookup dafür
    expect(a).toBe(withChf);
    // Zeile ohne: Kopie mit aufgelöstem CHF-Betrag
    expect(b).not.toBe(withoutChf);
    expect(b.totalAmountCHF).toBe(String(2000 * 0.88));
    expect(getGrossAmountCHF(b)).toBeCloseTo(1760, 10);
    // Original bleibt unangetastet
    expect(withoutChf.totalAmountCHF).toBeNull();
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("Lookup erfolglos → Lokalbetrag gestempelt (Verhalten wie sync-Fallback)", async () => {
    const [row] = await withResolvedGrossAmountCHF([usdBuy()], async () => null);
    expect(row.totalAmountCHF).toBe("2000");
  });
});
