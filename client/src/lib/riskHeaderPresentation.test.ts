import { describe, expect, it } from "vitest";
import { getRiskHeaderPresentation } from "./riskHeaderPresentation";

describe("getRiskHeaderPresentation", () => {
  it("marks an unfinished risk query as loading instead of a missing metric", () => {
    expect(getRiskHeaderPresentation(undefined, true)).toEqual({
      sharpe: { value: "Wird berechnet…", sub: "5J-Risikoanalyse lädt" },
      maxDrawdown: { value: "Wird berechnet…", sub: "5J-Fenster wird geprüft" },
    });
  });

  it("distinguishes a genuine five-year coverage gate from loading", () => {
    expect(getRiskHeaderPresentation({ riskWindowStatus: "insufficient_history" }, false)).toEqual({
      sharpe: { value: "—", sub: "5J-Historie unvollständig" },
      maxDrawdown: { value: "—", sub: "5J-Gate nicht erfüllt" },
    });
  });

  it("formats calculated values and their benchmark values", () => {
    expect(getRiskHeaderPresentation({
      sharpeRatio: -0.11,
      sharpeBenchmark: 0.1,
      maxDrawdown: -25.6,
      drawdownBenchmark: -29.3,
      riskWindowStatus: "five_year_with_stress",
    }, false)).toEqual({
      sharpe: { value: "-0.11", sub: "Bench 0.10" },
      maxDrawdown: { value: "-25.6%", sub: "Bench -29.3%" },
    });
  });
});
