import { describe, it, expect } from "vitest";
import { optimizerParamsForProfile } from "./profileOptimizerParams";

const rules = { maxPositionPercent: 10, minPositionPercent: 1, minPositionAmountCHF: 3000 };

describe("optimizerParamsForProfile", () => {
  it("konservativ → Min. Varianz, others → Max. Sharpe", () => {
    expect(optimizerParamsForProfile({ riskProfile: "konservativ", maxDrawdownTolerancePct: 20, investmentHorizonYears: 10 }, rules).method).toBe("min_variance");
    expect(optimizerParamsForProfile({ riskProfile: "ausgewogen", maxDrawdownTolerancePct: 20, investmentHorizonYears: 10 }, rules).method).toBe("max_sharpe");
    expect(optimizerParamsForProfile({ riskProfile: "aggressiv", maxDrawdownTolerancePct: 40, investmentHorizonYears: 10 }, rules).method).toBe("max_sharpe");
  });

  it("normal drawdown tolerance leaves the admin cap unchanged", () => {
    const p = optimizerParamsForProfile({ riskProfile: "ausgewogen", maxDrawdownTolerancePct: 20, investmentHorizonYears: 10 }, rules);
    expect(p.maxPositionWeight).toBeCloseTo(0.10, 6); // factor = 1 at tol=20
    expect(p.minPositionWeight).toBeCloseTo(0.01, 6);
    expect(p.minPositionChf).toBe(3000);
  });

  it("low drawdown tolerance tightens the position cap (never loosens beyond admin)", () => {
    const cautious = optimizerParamsForProfile({ riskProfile: "konservativ", maxDrawdownTolerancePct: 5, investmentHorizonYears: 10 }, rules);
    expect(cautious.maxPositionWeight).toBeLessThan(0.10);
    // high tolerance never exceeds the admin cap
    const bold = optimizerParamsForProfile({ riskProfile: "aggressiv", maxDrawdownTolerancePct: 80, investmentHorizonYears: 10 }, rules);
    expect(bold.maxPositionWeight).toBeLessThanOrEqual(0.10 + 1e-9);
  });

  it("horizon shifts momentum vs quality weight (sum stays 0.8)", () => {
    const short = optimizerParamsForProfile({ riskProfile: "ausgewogen", maxDrawdownTolerancePct: 20, investmentHorizonYears: 3 }, rules);
    expect(short.momentumWeight).toBeGreaterThan(short.qualityWeight);
    expect(short.momentumWeight + short.qualityWeight).toBeCloseTo(0.8, 6);

    const long = optimizerParamsForProfile({ riskProfile: "ausgewogen", maxDrawdownTolerancePct: 20, investmentHorizonYears: 20 }, rules);
    expect(long.qualityWeight).toBeGreaterThan(long.momentumWeight);
    expect(long.momentumWeight + long.qualityWeight).toBeCloseTo(0.8, 6);

    const mid = optimizerParamsForProfile({ riskProfile: "ausgewogen", maxDrawdownTolerancePct: 20, investmentHorizonYears: 10 }, rules);
    expect(mid.momentumWeight).toBeCloseTo(0.4, 6);
    expect(mid.qualityWeight).toBeCloseTo(0.4, 6);
  });
});
