import { describe, expect, it } from "vitest";
import { reconcileSharesWithTransactions } from "./portfolioPositionReconciliation";

describe("reconcileSharesWithTransactions", () => {
  it("wendet nur spätere Kauf-/Verkaufsdeltas auf die in portfolioData gespeicherte Ausgangsposition an", () => {
    const shares = reconcileSharesWithTransactions(10, "NOVN.SW", [
      { ticker: "NOVN.SW", transactionType: "buy", shares: "10", notes: "Initial purchase for portfolio activation" },
      { ticker: "NOVN.SW", transactionType: "buy", shares: "2.5" },
      { ticker: "NOVN.SW", transactionType: "sell", shares: "1" },
      { ticker: "NESN.SW", transactionType: "buy", shares: "99" },
    ]);

    expect(shares).toBe(11.5);
  });

  it("verhindert negative sichtbare Stückzahlen nach Überverkäufen", () => {
    expect(reconcileSharesWithTransactions(2, "NOVN.SW", [
      { ticker: "NOVN.SW", transactionType: "sell", shares: "3" },
    ])).toBe(0);
  });
});
