import { describe, expect, it } from "vitest";
import { getPortfolioPdfKpiKeys } from "./portfolioPdfKpis";

describe("getPortfolioPdfKpiKeys", () => {
  it("enthält die gewünschten Ertrags-, Performance- und Risikokennzahlen", () => {
    expect(getPortfolioPdfKpiKeys()).toEqual([
      "current_value",
      "absolute_gain",
      "ttwror",
      "dividend_yield",
      "sharpe",
      "volatility",
      "max_drawdown",
    ]);
  });
});
