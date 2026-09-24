import { describe, expect, it } from "vitest";
import { rebalanceDemoCashReserve, rebalanceDemoCashReserveProportionally } from "./demoCashReserveRebalance";

describe("rebalanceDemoCashReserve", () => {
  it("skaliert eine transaktionslose Demo-Wertpapierbasis auf die neue Cash-Quote und erhält das Startkapital", () => {
    const result = rebalanceDemoCashReserve({
      investmentAmountChf: 100_000,
      targetCashReservePct: 20,
      positions: [
        { ticker: "CHF.SW", weightPct: 45, currentPrice: 100, currency: "CHF", exchangeRateToChf: 1 },
        { ticker: "USD.US", weightPct: 45, currentPrice: 50, currency: "USD", exchangeRateToChf: 1.25 },
      ],
    });

    expect(result.cashBalanceChf).toBeCloseTo(20_000, 2);
    expect(result.securitiesValueChf).toBeCloseTo(80_000, 2);
    expect(result.totalValueChf).toBeCloseTo(100_000, 2);
    expect(result.positions.map((position) => position.weightPct)).toEqual([40, 40]);
    expect(result.positions[0]?.shares).toBeCloseTo(400, 6);
    expect(result.positions[1]?.shares).toBeCloseTo(640, 6);
  });

  it("weist ungültige Ziele oder nicht bewertbare Positionen zurück", () => {
    expect(() => rebalanceDemoCashReserve({
      investmentAmountChf: 100_000,
      targetCashReservePct: 100,
      positions: [{ ticker: "CHF.SW", weightPct: 100, currentPrice: 100, currency: "CHF", exchangeRateToChf: 1 }],
    })).toThrow(/zwischen 0 und unter 100/i);
    expect(() => rebalanceDemoCashReserve({
      investmentAmountChf: 100_000,
      targetCashReservePct: 10,
      positions: [{ ticker: "BAD", weightPct: 100, currentPrice: 0, currency: "CHF", exchangeRateToChf: 1 }],
    })).toThrow(/bewertbar/i);
  });

  it("skaliert alle aktuellen Stückzahlen proportional und bildet Cash als Residuum", () => {
    const result = rebalanceDemoCashReserveProportionally({
      cashBalanceChf: 10_000,
      targetCashReservePct: 25,
      positions: [
        { ticker: "CHF.SW", shares: 100, currentPrice: 100, currency: "CHF", exchangeRateToChf: 1 },
        { ticker: "USD.US", shares: 50, currentPrice: 100, currency: "USD", exchangeRateToChf: 0.8 },
      ],
    });

    // Ausgang: Wertpapiere CHF 14'000 + Cash CHF 10'000 = CHF 24'000.
    // Ziel: 25 % Cash = CHF 6'000; alle Wertpapiere werden mit 18'000 / 14'000 skaliert.
    expect(result.totalValueChf).toBeCloseTo(24_000, 2);
    expect(result.targetCashBalanceChf).toBeCloseTo(6_000, 2);
    expect(result.scalingFactor).toBeCloseTo(18_000 / 14_000, 8);
    expect(result.positions[0]?.shares).toBeCloseTo(128.571429, 6);
    expect(result.positions[1]?.shares).toBeCloseTo(64.285714, 6);
    expect(result.securitiesValueChf).toBeCloseTo(18_000, 2);
    expect(result.cashBalanceChf).toBeCloseTo(6_000, 2);
  });

  it("weist nicht bewertbare aktuelle Positionen vor einer Cashanpassung zurück", () => {
    expect(() => rebalanceDemoCashReserveProportionally({
      cashBalanceChf: 1_000,
      targetCashReservePct: 10,
      positions: [{ ticker: "BAD", shares: 10, currentPrice: 0, currency: "CHF", exchangeRateToChf: 1 }],
    })).toThrow(/bewertbar/i);
  });
});
