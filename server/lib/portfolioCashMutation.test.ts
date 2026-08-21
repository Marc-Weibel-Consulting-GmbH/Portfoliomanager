import { describe, expect, it } from "vitest";
import { getPortfolioCashMutation } from "./portfolioCashMutation";

describe("getPortfolioCashMutation", () => {
  it("erhöht Cash und Einstand bei einer manuellen Einzahlung", () => {
    expect(getPortfolioCashMutation({ transactionType: "deposit", totalAmountCHF: "1.00", fees: "0", notes: "Visual Audit" }))
      .toEqual({ cashDelta: 1, investmentDelta: 1 });
  });

  it("bildet Kauf und Verkauf inklusive Gebühren als Cashbewegungen ab", () => {
    expect(getPortfolioCashMutation({ transactionType: "buy", totalAmountCHF: "100", fees: "2", notes: null }))
      .toEqual({ cashDelta: -102, investmentDelta: 0 });
    expect(getPortfolioCashMutation({ transactionType: "sell", totalAmountCHF: "100", fees: "2", notes: null }))
      .toEqual({ cashDelta: 98, investmentDelta: 0 });
  });

  it("verändert den Einstand für Aktivierungs-Einzahlungen nicht erneut", () => {
    expect(getPortfolioCashMutation({
      transactionType: "deposit",
      totalAmountCHF: "10000",
      fees: "0",
      notes: "Startkapital für Portfolio-Aktivierung",
    })).toEqual({ cashDelta: 10000, investmentDelta: 0 });
  });
});
