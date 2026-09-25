import { describe, expect, it } from "vitest";
import { getRiskHeaderPresentation } from "./riskHeaderPresentation";

describe("getRiskHeaderPresentation", () => {
  it("marks an unfinished risk query as loading instead of a missing metric", () => {
    expect(getRiskHeaderPresentation(undefined, { isLoading: true })).toEqual({
      status: "loading",
      canRetry: false,
      sharpe: { value: "Wird berechnet…", sub: "5J-Risikoanalyse lädt" },
      maxDrawdown: { value: "Wird berechnet…", sub: "5J-Fenster wird geprüft" },
    });
  });

  it("marks a failed query as unavailable instead of inventing a five-year data gap", () => {
    expect(getRiskHeaderPresentation(undefined, { isLoading: false, isError: true })).toEqual({
      status: "error",
      canRetry: true,
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
      sharpe: { value: "—", sub: "Keine qualifizierte Risikoreihe" },
      maxDrawdown: { value: "—", sub: "Risikodaten nicht verfügbar" },
    });
  });

  it("distinguishes a genuine five-year coverage gate from loading", () => {
    expect(getRiskHeaderPresentation({ riskWindowStatus: "insufficient_history" }, { isLoading: false })).toEqual({
      status: "gate",
      canRetry: false,
      sharpe: { value: "—", sub: "5J-Historie unvollständig" },
      maxDrawdown: { value: "—", sub: "5J-Gate nicht erfüllt" },
    });
  });

  it("formats calculated values and their benchmark values", () => {
    expect(getRiskHeaderPresentation({
      dataAvailable: true,
      sharpeRatio: -0.11,
      sharpeBenchmark: 0.1,
      maxDrawdown: -25.6,
      drawdownBenchmark: -29.3,
      riskWindowStatus: "five_year_with_stress",
    }, { isLoading: false })).toEqual({
      status: "ready",
      canRetry: false,
      sharpe: { value: "-0.11", sub: "Bench 0.10" },
      maxDrawdown: { value: "-25.6%", sub: "Bench -29.3%" },
    });
  });
});
