import { describe, expect, it } from "vitest";
import {
  rebalanceManualDemoPortfolio,
  rebalanceManualDemoPortfolioWeights,
  type ManualDemoHolding,
} from "./manualDemoPortfolioRebalance";
import { calculateCashReservePct } from "../../shared/cashReservePct";

const nestle: ManualDemoHolding = {
  ticker: "NESN.SW",
  shares: 260,
  priceLocal: 80,
  currency: "CHF",
  exchangeRateToChf: 1,
};

const roche: ManualDemoHolding = {
  ticker: "RO.SW",
  shares: 100,
  priceLocal: 100,
  currency: "CHF",
  exchangeRateToChf: 1,
};

describe("rebalanceManualDemoPortfolio", () => {
  it("schreibt den CHF-Wert einer Stückzahlreduktion als Cash gut und erhält die Kapitalbasis", () => {
    const result = rebalanceManualDemoPortfolio({
      cashBalanceChf: 4_000,
      before: [nestle, roche],
      after: [{ ...nestle, shares: 200 }, roche],
    });

    expect(result.cashBalanceChf).toBe(8_800);
    expect(result.securitiesValueBeforeChf).toBe(30_800);
    expect(result.securitiesValueAfterChf).toBe(26_000);
    expect(result.totalValueBeforeChf).toBe(34_800);
    expect(result.totalValueAfterChf).toBe(34_800);
    expect(calculateCashReservePct({ cashBalanceChf: result.cashBalanceChf, capitalBaseChf: 34_800 })).toBeCloseTo(25.287356, 5);
  });

  it("schreibt den Wert einer gelöschten Position vollständig Cash gut", () => {
    const result = rebalanceManualDemoPortfolio({
      cashBalanceChf: 4_000,
      before: [nestle, roche],
      after: [roche],
    });

    expect(result.cashBalanceChf).toBe(24_800);
    expect(result.totalValueAfterChf).toBe(result.totalValueBeforeChf);
  });

  it("weist einen Zugang ab, der nicht durch die vorhandene Cash-Reserve gedeckt ist", () => {
    expect(() => rebalanceManualDemoPortfolio({
      cashBalanceChf: 4_000,
      before: [nestle, roche],
      after: [nestle, roche, { ticker: "NOVN.SW", shares: 100, priceLocal: 100, currency: "CHF", exchangeRateToChf: 1 }],
    })).toThrow("Cash-Reserve");
  });

  it("bewertet Fremdwährungspositionen mit dem CHF-Wert einer lokalen Einheit", () => {
    const usd: ManualDemoHolding = {
      ticker: "JNJ",
      shares: 10,
      priceLocal: 200,
      currency: "USD",
      exchangeRateToChf: 0.8,
    };
    const result = rebalanceManualDemoPortfolio({
      cashBalanceChf: 1_000,
      before: [usd],
      after: [{ ...usd, shares: 5 }],
    });

    expect(result.cashBalanceChf).toBe(1_800);
    expect(result.totalValueAfterChf).toBe(2_600);
  });

  it("hält beim Entfernen über den Gewichtungseditor den frei werdenden Betrag als Cash", () => {
    const result = rebalanceManualDemoPortfolioWeights({
      cashBalanceChf: 10_000,
      before: [nestle, roche],
      targetWeightsPct: [{ ticker: "NESN.SW", weightPct: 60 }],
    });

    expect(result.cashBalanceChf).toBe(16_320);
    expect(result.positions).toEqual([{ ticker: "NESN.SW", shares: 306, weightPct: 60 }]);
    expect(result.totalValueAfterChf).toBe(result.totalValueBeforeChf);
  });

  it("weist Gewichtungspläne über 100 Prozent vor jeder Cash-Belastung ab", () => {
    expect(() => rebalanceManualDemoPortfolioWeights({
      cashBalanceChf: 10_000,
      before: [nestle, roche],
      targetWeightsPct: [
        { ticker: "NESN.SW", weightPct: 60 },
        { ticker: "RO.SW", weightPct: 50 },
      ],
    })).toThrow("100");
  });
});
