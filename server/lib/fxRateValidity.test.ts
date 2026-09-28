import { describe, expect, it } from "vitest";
import { isPlausibleChfFxRate } from "./fxRateValidity";

describe("isPlausibleChfFxRate", () => {
  it("accepts realistic direct CHF rates", () => {
    expect(isPlausibleChfFxRate("NOKCHF", 0.084)).toBe(true);
    expect(isPlausibleChfFxRate("DKKCHF", 0.1234)).toBe(true);
    expect(isPlausibleChfFxRate("JPYCHF", 0.005)).toBe(true);
    expect(isPlausibleChfFxRate("USDCHF", 0.81)).toBe(true);
  });

  it("rejects factor-100 FX outliers instead of treating them as CHF conversion inputs", () => {
    expect(isPlausibleChfFxRate("NOKCHF", 0.000957)).toBe(false);
    expect(isPlausibleChfFxRate("DKKCHF", 12.34)).toBe(false);
    expect(isPlausibleChfFxRate("JPYCHF", 0.4983)).toBe(false);
  });

  it("rejects missing, non-finite and unknown-pair values", () => {
    expect(isPlausibleChfFxRate("USDCHF", 0)).toBe(false);
    expect(isPlausibleChfFxRate("USDCHF", Number.NaN)).toBe(false);
    expect(isPlausibleChfFxRate("UNKNOWNCHF", 0.8)).toBe(false);
  });
});
