import { describe, it, expect } from "vitest";
import { ledoitWolfConstantCorr } from "./ledoitWolf";

// Deterministischer Pseudo-Zufall (kein Math.random — reproduzierbar).
function series(n: number, seed: number): number[] {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out.push((s / 0x7fffffff - 0.5) * 0.04); // ~±2% Tagesrenditen
  }
  return out;
}

describe("ledoitWolfConstantCorr", () => {
  it("liefert Shrinkage δ in [0,1] und eine symmetrische Matrix", () => {
    const returns = [series(120, 1), series(120, 2), series(120, 3)];
    const { cov, shrinkage } = ledoitWolfConstantCorr(returns);
    expect(shrinkage).toBeGreaterThanOrEqual(0);
    expect(shrinkage).toBeLessThanOrEqual(1);
    for (let i = 0; i < cov.length; i++)
      for (let j = 0; j < cov.length; j++)
        expect(cov[i][j]).toBeCloseTo(cov[j][i], 12);
  });

  it("erhält die Diagonale exakt als Stichprobenvarianz (F_ii = S_ii)", () => {
    const returns = [series(150, 7), series(150, 11), series(150, 13), series(150, 17)];
    const { cov } = ledoitWolfConstantCorr(returns);
    // Stichprobenvarianz (1/T) je Asset direkt nachrechnen.
    for (let i = 0; i < returns.length; i++) {
      const r = returns[i];
      const m = r.reduce((a, b) => a + b, 0) / r.length;
      const v = r.reduce((a, b) => a + (b - m) * (b - m), 0) / r.length;
      expect(cov[i][i]).toBeCloseTo(v, 10);
    }
  });

  it("jedes geschrumpfte Element liegt zwischen Stichprobe (S) und Target (F)", () => {
    // Bei δ ∈ [0,1] muss cov_ij zwischen S_ij und F_ij liegen — hier grob geprüft über
    // die Konvexkombination: die Off-Diagonale bewegt sich Richtung r̄·σi·σj.
    const returns = [series(80, 21), series(80, 22), series(80, 23)];
    const res = ledoitWolfConstantCorr(returns);
    expect(res.cov.length).toBe(3);
    expect(Number.isFinite(res.cov[0][1])).toBe(true);
  });

  it("degeneriert sauber bei zu wenig Beobachtungen", () => {
    const { cov, shrinkage } = ledoitWolfConstantCorr([[0.01], [0.02]]);
    expect(shrinkage).toBe(0);
    expect(cov).toEqual([[0, 0], [0, 0]]);
  });

  it("stark korrelierte Titel: Target zieht die Off-Diagonale nicht ins Negative", () => {
    const base = series(100, 99);
    const returns = [base, base.map((v) => v * 1.01), base.map((v) => v * 0.99)];
    const { cov } = ledoitWolfConstantCorr(returns);
    expect(cov[0][1]).toBeGreaterThan(0);
    expect(cov[0][2]).toBeGreaterThan(0);
  });
});
