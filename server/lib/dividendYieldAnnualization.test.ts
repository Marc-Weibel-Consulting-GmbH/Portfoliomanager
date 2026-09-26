import { describe, expect, it } from "vitest";
import { calculateTrailingTwelveMonthDividendYield } from "./dividendYieldAnnualization";

describe("TTM-Brutto-Dividendenrendite", () => {
  it("summiert vier quartalsweise NOK-Ausschüttungen statt nur eine Zahlung zu zeigen", () => {
    const result = calculateTrailingTwelveMonthDividendYield({
      asOfDate: "2026-09-26",
      currentPrice: 348.6,
      tradingCurrency: "NOK",
      events: [
        { exDate: "2025-10-27", amount: 6.33194, currency: "NOK", period: "Quarterly" },
        { exDate: "2026-02-16", amount: 6.29417, currency: "NOK", period: "Quarterly" },
        { exDate: "2026-05-12", amount: 6.12853, currency: "NOK", period: "Quarterly" },
        { exDate: "2026-07-20", amount: 6.42588, currency: "NOK", period: "Quarterly" },
      ],
    });

    expect(result).toMatchObject({
      status: "available",
      basis: "ttm_gross",
      annualDividendPerShare: 25.18052,
      currency: "NOK",
      eventCount: 4,
    });
    expect(result.dividendYieldPct).toBeCloseTo(7.223327596, 9);
  });

  it("akzeptiert jährliche und halbjährliche Reihen ohne einen Quartalsmultiplikator", () => {
    expect(calculateTrailingTwelveMonthDividendYield({
      asOfDate: "2026-09-26",
      currentPrice: 100,
      tradingCurrency: "CHF",
      events: [{ exDate: "2026-04-15", amount: 4.2, currency: "CHF", period: "Annual" }],
    }).dividendYieldPct).toBeCloseTo(4.2, 10);

    expect(calculateTrailingTwelveMonthDividendYield({
      asOfDate: "2026-09-26",
      currentPrice: 100,
      tradingCurrency: "EUR",
      events: [
        { exDate: "2025-12-01", amount: 1.5, currency: "EUR", period: "Semi-Annual" },
        { exDate: "2026-06-01", amount: 1.7, currency: "EUR", period: "Semi-Annual" },
      ],
    }).dividendYieldPct).toBeCloseTo(3.2, 10);
  });

  it("schliesst als Sonderdividende markierte Ereignisse aus der regulären TTM-Kennzahl aus", () => {
    const result = calculateTrailingTwelveMonthDividendYield({
      asOfDate: "2026-09-26",
      currentPrice: 100,
      tradingCurrency: "CHF",
      events: [
        { exDate: "2025-12-10", amount: 3, currency: "CHF", period: "Annual" },
        { exDate: "2026-05-12", amount: 20, currency: "CHF", period: "Special" },
      ],
    });

    expect(result.dividendYieldPct).toBeCloseTo(3, 10);
    expect(result.excludedSpecialEventCount).toBe(1);
  });

  it("weist eine Datenlücke aus, statt USD je Aktie gegen einen NOK-Kurs zu teilen", () => {
    expect(calculateTrailingTwelveMonthDividendYield({
      asOfDate: "2026-09-26",
      currentPrice: 348.6,
      tradingCurrency: "NOK",
      events: [{ exDate: "2026-07-20", amount: 0.6615, currency: "USD", period: "Quarterly" }],
    })).toMatchObject({
      status: "currency_mismatch",
      dividendYieldPct: null,
      annualDividendPerShare: null,
    });
  });
});
