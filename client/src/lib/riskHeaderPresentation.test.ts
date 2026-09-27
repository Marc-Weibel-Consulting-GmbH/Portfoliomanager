import { describe, expect, it } from "vitest";
import { getRiskHeaderPresentation } from "./riskHeaderPresentation";

describe("getRiskHeaderPresentation", () => {
  it("marks an unfinished risk query as loading instead of a missing metric", () => {
    expect(getRiskHeaderPresentation(undefined, { isLoading: true })).toEqual({
      status: "loading",
      canRetry: false,
      priceReturn: { value: "Wird berechnet…", sub: "5J-Kursreihe lädt" },
      annualReturn: { value: "Wird berechnet…", sub: "5J-Allokationsproxy lädt" },
      volatility: { value: "Wird berechnet…", sub: "5J-Allokationsproxy lädt" },
      sharpe: { value: "Wird berechnet…", sub: "5J-Risikoanalyse lädt" },
      maxDrawdown: { value: "Wird berechnet…", sub: "5J-Fenster wird geprüft" },
    });
  });

  it("marks a failed query as unavailable instead of inventing a five-year data gap", () => {
    expect(getRiskHeaderPresentation(undefined, { isLoading: false, isError: true })).toEqual({
      status: "error",
      canRetry: true,
      priceReturn: { value: "—", sub: "Risikoanalyse vorübergehend nicht verfügbar" },
      annualReturn: { value: "—", sub: "Risikoanalyse vorübergehend nicht verfügbar" },
      volatility: { value: "—", sub: "Risikoanalyse vorübergehend nicht verfügbar" },
      sharpe: { value: "—", sub: "Risikoanalyse vorübergehend nicht verfügbar" },
      maxDrawdown: { value: "—", sub: "Abruf fehlgeschlagen – erneut versuchen" },
    });
  });

  it("does not format fallback zeroes when the server marks risk data unavailable", () => {
    expect(getRiskHeaderPresentation({
      dataAvailable: false,
      sharpeRatio: 0,
      maxDrawdown: 0,
    }, { isLoading: false })).toEqual({
      status: "unavailable",
      canRetry: true,
      priceReturn: { value: "—", sub: "Keine qualifizierte Risikoreihe" },
      annualReturn: { value: "—", sub: "Keine qualifizierte Risikoreihe" },
      volatility: { value: "—", sub: "Keine qualifizierte Risikoreihe" },
      sharpe: { value: "—", sub: "Keine qualifizierte Risikoreihe" },
      maxDrawdown: { value: "—", sub: "Risikodaten nicht verfügbar" },
    });
  });

  it("distinguishes a genuine five-year coverage gate from loading", () => {
    expect(getRiskHeaderPresentation({ riskWindowStatus: "insufficient_history" }, { isLoading: false })).toEqual({
      status: "gate",
      canRetry: false,
      priceReturn: { value: "—", sub: "5J-Historie unvollständig" },
      annualReturn: { value: "—", sub: "5J-Historie unvollständig" },
      volatility: { value: "—", sub: "5J-Historie unvollständig" },
      sharpe: { value: "—", sub: "5J-Historie unvollständig" },
      maxDrawdown: { value: "—", sub: "5J-Gate nicht erfüllt" },
    });
  });

  it("formats calculated values and their benchmark values", () => {
    expect(getRiskHeaderPresentation({
      dataAvailable: true,
      annualizedReturn: 7.4,
      annualizedPriceReturn: 5.8,
      volatility: 10.8,
      sharpeRatio: -0.11,
      sharpeBenchmark: 0.1,
      maxDrawdown: -25.6,
      drawdownBenchmark: -29.3,
      riskWindowStatus: "five_year_with_stress",
    }, { isLoading: false })).toEqual({
      status: "ready",
      canRetry: false,
      priceReturn: { value: "+5.8%", sub: "5J-Proxy · p.a. · ohne Div." },
      annualReturn: { value: "+7.4%", sub: "5J-Proxy · p.a. · inkl. Div." },
      volatility: { value: "10.8%", sub: "5J-Proxy · p.a." },
      sharpe: { value: "-0.11", sub: "Bench 0.10" },
      maxDrawdown: { value: "-25.6%", sub: "Bench -29.3%" },
    });
  });
});
