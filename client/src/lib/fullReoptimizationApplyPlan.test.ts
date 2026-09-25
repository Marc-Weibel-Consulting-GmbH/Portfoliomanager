import { describe, expect, it } from "vitest";
import { buildFullReoptimizationApplyPlan } from "./fullReoptimizationApplyPlan";

describe("buildFullReoptimizationApplyPlan", () => {
  const holdings = [
    { ticker: "CHF_SLEEVE", weight: "10" },
    { ticker: "AAA", weight: "20" },
    { ticker: "BBB", weight: "30" },
  ];
  const optimizedWeights = { CCC: 0.6, DDD: 0.4 };

  it("replaces only the equity sleeve in a full implementation while retaining fixed sleeves", () => {
    const plan = buildFullReoptimizationApplyPlan({
      holdings,
      optimizedWeights,
      isSleeve: (ticker) => ticker === "CHF_SLEEVE",
      scope: "all_equities",
    });

    expect(plan.targetWeightsPct).toEqual([
      { ticker: "CHF_SLEEVE", weightPct: 10 },
      { ticker: "CCC", weightPct: 30 },
      { ticker: "DDD", weightPct: 20 },
    ]);
    expect(plan.cashDeltaChfPct).toBe(0);
    expect(plan.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ ticker: "AAA", currentWeightPct: 20, targetWeightPct: 0 }),
      expect.objectContaining({ ticker: "BBB", currentWeightPct: 30, targetWeightPct: 0 }),
      expect.objectContaining({ ticker: "CCC", currentWeightPct: 0, targetWeightPct: 30 }),
      expect.objectContaining({ ticker: "DDD", currentWeightPct: 0, targetWeightPct: 20 }),
    ]));
  });

  it("changes just one selected title and reflects the cash effect", () => {
    const plan = buildFullReoptimizationApplyPlan({
      holdings,
      optimizedWeights,
      isSleeve: (ticker) => ticker === "CHF_SLEEVE",
      scope: "single_equity",
      ticker: "CCC",
    });

    expect(plan.targetWeightsPct).toEqual([
      { ticker: "CHF_SLEEVE", weightPct: 10 },
      { ticker: "AAA", weightPct: 20 },
      { ticker: "BBB", weightPct: 30 },
      { ticker: "CCC", weightPct: 30 },
    ]);
    expect(plan.changes).toEqual([
      { ticker: "CCC", currentWeightPct: 0, targetWeightPct: 30, deltaWeightPct: 30 },
    ]);
    expect(plan.cashDeltaChfPct).toBe(-30);
  });

  it("rejects a title that is not part of the validated optimisation output", () => {
    expect(() => buildFullReoptimizationApplyPlan({
      holdings,
      optimizedWeights,
      isSleeve: (ticker) => ticker === "CHF_SLEEVE",
      scope: "single_equity",
      ticker: "AAA",
    })).toThrow("nicht Teil der aktuellen Volloptimierung");
  });
});
