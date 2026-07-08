import { describe, it, expect } from "vitest";
import { invertMatrix, blackLitterman, blPosteriorFromHistoricalMeans } from "./blackLitterman";

/** A·A⁻¹ soll ≈ I sein. */
function isIdentity(A: number[][], tol = 1e-9): boolean {
  const n = A.length;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) if (Math.abs(A[i][j] - (i === j ? 1 : 0)) > tol) return false;
  return true;
}

function matMul(A: number[][], B: number[][]): number[][] {
  return A.map((row) => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));
}

describe("invertMatrix", () => {
  it("invertiert eine 2×2-Matrix korrekt (A·A⁻¹ = I)", () => {
    const A = [
      [4, 3],
      [6, 3],
    ];
    expect(isIdentity(matMul(A, invertMatrix(A)))).toBe(true);
  });

  it("invertiert eine 3×3-Matrix mit Pivoting (führende Null)", () => {
    const A = [
      [0, 2, 1],
      [1, 0, 0],
      [3, 1, 2],
    ];
    expect(isIdentity(matMul(A, invertMatrix(A)))).toBe(true);
  });

  it("wirft bei singulärer Matrix", () => {
    const A = [
      [1, 2],
      [2, 4],
    ];
    expect(() => invertMatrix(A)).toThrow(/singulär/);
  });
});

describe("blackLitterman", () => {
  const Sigma = [
    [0.04, 0.006, 0.0],
    [0.006, 0.09, 0.0],
    [0.0, 0.0, 0.0625],
  ];
  const w = [1 / 3, 1 / 3, 1 / 3];

  it("ohne Views ist die Posterior gleich dem Gleichgewichts-Prior Π = δ Σ w", () => {
    const delta = 2.5;
    const mu = blackLitterman(Sigma, w, { delta });
    const pi = Sigma.map((row) => (delta * row.reduce((s, v, j) => s + v * w[j], 0)));
    expect(mu.length).toBe(3);
    mu.forEach((v, i) => expect(v).toBeCloseTo(pi[i], 12));
  });

  it("eine sehr sichere absolute View zieht die Posterior nahe an die View heran", () => {
    // View: Titel 0 hat Rendite 0.30, mit winziger Unsicherheit → Posterior[0] ≈ 0.30.
    const views = {
      P: [[1, 0, 0]],
      Q: [0.3],
      omega: [[1e-8]],
    };
    const mu = blackLitterman(Sigma, w, { views });
    expect(mu[0]).toBeCloseTo(0.3, 3);
  });

  it("liefert endliche, symmetrisch behandelte Werte für alle Titel", () => {
    const views = {
      P: [
        [1, 0, 0],
        [0, 1, -1],
      ],
      Q: [0.1, 0.02],
      omega: [
        [0.001, 0],
        [0, 0.001],
      ],
    };
    const mu = blackLitterman(Sigma, w, { views });
    expect(mu.length).toBe(3);
    mu.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });
});

describe("blPosteriorFromHistoricalMeans", () => {
  const Sigma = [
    [0.04, 0.006],
    [0.006, 0.09],
  ];
  const w = [0.5, 0.5];

  it("schrumpft das verrauschte historische μ Richtung Gleichgewichts-Prior (liegt dazwischen)", () => {
    const hist = [0.5, -0.2]; // extreme historische Mittel
    const delta = 2.5;
    const pi = Sigma.map((row) => delta * row.reduce((s, v, j) => s + v * w[j], 0));
    const mu = blPosteriorFromHistoricalMeans(Sigma, w, hist, { delta });
    // Posterior liegt je Titel zwischen Prior und View (Konvexkombination).
    for (let i = 0; i < 2; i++) {
      const lo = Math.min(pi[i], hist[i]);
      const hi = Math.max(pi[i], hist[i]);
      expect(mu[i]).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(mu[i]).toBeLessThanOrEqual(hi + 1e-9);
    }
  });

  it("ist deterministisch (gleiche Eingaben → gleiche Ausgabe)", () => {
    const hist = [0.12, 0.08];
    const a = blPosteriorFromHistoricalMeans(Sigma, w, hist);
    const b = blPosteriorFromHistoricalMeans(Sigma, w, hist);
    expect(a).toEqual(b);
  });
});
