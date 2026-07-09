import { describe, it, expect } from "vitest";
import {
  evaluateProfile,
  scoreToProfile,
  deriveActiveProfile,
  type ProfileAnswers,
} from "./investorProfileScoring";

const base: ProfileAnswers = {
  goal: "balanced",
  horizonYears: 10,
  purpose: "aufbau",
  wealthBand: "b250_1m",
  savingsRateBand: "mittel",
  liquidityReserveBand: "b6_12m",
  incomeStability: "hoch",
  drawdownReaction: "halten",
  lossComfortPct: 25,
  experienceWithLosses: "ja_ok",
  knowledgeLevel: "fortgeschritten",
  excludedSectors: [],
  esgOnly: false,
  targetReturnPct: 6,
  liquidityNeedPct: 0,
};

describe("scoreToProfile", () => {
  it("maps score bands to the four buckets", () => {
    expect(scoreToProfile(10)).toBe("konservativ");
    expect(scoreToProfile(45)).toBe("ausgewogen");
    expect(scoreToProfile(70)).toBe("wachstum");
    expect(scoreToProfile(90)).toBe("aggressiv");
  });
});

describe("evaluateProfile", () => {
  it("binding profile is the minimum of capacity and tolerance", () => {
    const r = evaluateProfile(base);
    expect(r.bindingScore).toBe(Math.min(r.capacityScore, r.toleranceScore));
    expect(r.bindingProfile).toBe(scoreToProfile(r.bindingScore));
  });

  it("high willingness but low capacity → capacity binds", () => {
    const r = evaluateProfile({
      ...base,
      // low capacity: little wealth, no savings, no reserve, unstable income, short horizon
      wealthBand: "u50",
      savingsRateBand: "keine",
      liquidityReserveBand: "u3m",
      incomeStability: "niedrig",
      horizonYears: 2,
      // high willingness
      drawdownReaction: "nachkaufen",
      lossComfortPct: 45,
      experienceWithLosses: "ja_ok",
    });
    expect(r.capacityScore).toBeLessThan(r.toleranceScore);
    expect(r.capacityBinds).toBe(true);
    expect(r.bindingScore).toBe(r.capacityScore);
    expect(r.bindingProfile).toBe("konservativ");
  });

  it("strong capacity + willingness → aggressive", () => {
    const r = evaluateProfile({
      ...base,
      wealthBand: "o1m",
      savingsRateBand: "hoch",
      liquidityReserveBand: "o12m",
      incomeStability: "hoch",
      horizonYears: 25,
      drawdownReaction: "nachkaufen",
      lossComfortPct: 50,
      experienceWithLosses: "ja_ok",
    });
    expect(r.bindingProfile).toBe("aggressiv");
    expect(r.strategicAllocation.equity).toBeGreaterThan(80);
  });

  it("flags a need conflict when target return exceeds capacity", () => {
    const r = evaluateProfile({
      ...base,
      wealthBand: "u50",
      savingsRateBand: "keine",
      liquidityReserveBand: "u3m",
      incomeStability: "niedrig",
      horizonYears: 2,
      targetReturnPct: 10,
    });
    expect(r.needConflict).toBe(true);
  });

  it("null target return yields null need score, no conflict", () => {
    const r = evaluateProfile({ ...base, targetReturnPct: null });
    expect(r.needScore).toBeNull();
    expect(r.needConflict).toBe(false);
  });
});

describe("deriveActiveProfile", () => {
  it("maps answers + result into the active profile fields", () => {
    const r = evaluateProfile(base);
    const active = deriveActiveProfile(base, r);
    expect(active.riskProfile).toBe(r.bindingProfile);
    expect(active.investmentHorizonYears).toBe(10);
    expect(active.maxDrawdownTolerancePct).toBe(25);
    expect(active.investmentGoal).toBe("balanced");
    expect(active.targetReturnPct).toBe(6);
  });

  it("clamps out-of-range inputs", () => {
    const r = evaluateProfile(base);
    const active = deriveActiveProfile({ ...base, horizonYears: 99, lossComfortPct: 200 }, r);
    expect(active.investmentHorizonYears).toBe(50);
    expect(active.maxDrawdownTolerancePct).toBe(80);
  });
});
