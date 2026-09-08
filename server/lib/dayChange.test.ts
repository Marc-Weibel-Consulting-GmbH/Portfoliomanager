import { describe, expect, it } from "vitest";
import { computeDayChange } from "./dayChange";

describe("computeDayChange: Instrument- und Währungsbasis", () => {
  it("schliesst eine USD-ADR-Historie für eine native DBS-SGD-Position symmetrisch aus", () => {
    const result = computeDayChange(
      [{ ticker: "D05.SI", shares: 100, currency: "SGD", historicalPriceCurrency: "USD" }],
      new Map([["D05.SI", [
        { date: "2026-09-02", close: 243.16 },
        { date: "2026-09-03", close: 247.69 },
      ]]]),
      new Map([["SGD", 0.6398]]),
    );

    expect(result).toEqual({ dayChangeCHF: 0, baseValueCHF: 0, dayChangePercent: 0 });
  });

  it("berechnet die Tagesrendite weiter für eine identische Instrument- und Währungsbasis", () => {
    const result = computeDayChange(
      [{ ticker: "NESN.SW", shares: 10, currency: "CHF", historicalPriceCurrency: "CHF" }],
      new Map([["NESN.SW", [
        { date: "2026-09-02", close: 79 },
        { date: "2026-09-03", close: 80 },
      ]]]),
      new Map(),
    );

    expect(result.dayChangeCHF).toBe(10);
    expect(result.baseValueCHF).toBe(790);
    expect(result.dayChangePercent).toBeCloseTo(10 / 790 * 100, 10);
  });
});
