import { describe, expect, it } from "vitest";
import { buildPortfolioActivationLedger } from "./portfolioActivationLedger";

describe("buildPortfolioActivationLedger", () => {
  it("bewahrt eine bestehende Liquiditätsreserve beim Wechsel zu Live", () => {
    const result = buildPortfolioActivationLedger({
      existingCashBalanceCHF: 25_000,
      positions: [
        { ticker: "AAA", shares: 100, pricePerShare: 100, currency: "CHF", fxRate: 1 },
        { ticker: "BBB", shares: 125, pricePerShare: 1_000, currency: "CHF", fxRate: 1 },
      ],
    });

    expect(result.preservedCashBalanceCHF).toBe(25_000);
    expect(result.totalPositionValueCHF).toBe(135_000);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions).toEqual([
      expect.objectContaining({ ticker: "AAA", transactionType: "entry", totalAmountCHF: "10000.00" }),
      expect.objectContaining({ ticker: "BBB", transactionType: "entry", totalAmountCHF: "125000.00" }),
    ]);
    expect(result.transactions).not.toContainEqual(expect.objectContaining({ transactionType: "deposit" }));
  });

  it("erhöht weder Cash noch Einstand durch die Eintrittsbuchungen", () => {
    const result = buildPortfolioActivationLedger({
      existingCashBalanceCHF: 0,
      positions: [{ ticker: "AAA", shares: 10, pricePerShare: 100, currency: "CHF", fxRate: 1 }],
    });

    expect(result.preservedCashBalanceCHF).toBe(0);
    expect(result.transactions[0]).toMatchObject({
      transactionType: "entry",
      totalAmount: "1000.00",
      totalAmountCHF: "1000.00",
    });
  });

  it("ignoriert ungültige Eintrittspositionen statt eine Null- oder Negativbuchung zu erzeugen", () => {
    const result = buildPortfolioActivationLedger({
      existingCashBalanceCHF: 10,
      positions: [
        { ticker: "AAA", shares: 0, pricePerShare: 100, currency: "CHF", fxRate: 1 },
        { ticker: "BBB", shares: 1, pricePerShare: 0, currency: "CHF", fxRate: 1 },
      ],
    });

    expect(result.transactions).toEqual([]);
    expect(result.totalPositionValueCHF).toBe(0);
    expect(result.preservedCashBalanceCHF).toBe(10);
  });
});
