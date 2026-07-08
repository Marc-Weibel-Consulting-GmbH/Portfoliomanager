/**
 * Black-Litterman-Erwartungsrenditen.
 *
 * Die naive historische Durchschnittsrendite als μ ist extrem rauschanfällig — der
 * Mean-Variance-Optimizer reagiert darauf mit Extremgewichten. Black-Litterman kombiniert
 * einen markt-konsistenten Gleichgewichts-Prior (aus Reverse-Optimierung) mit "Views"
 * (hier: den historischen Mitteln, als unsichere Sichten) zu einer stabileren Posterior-μ.
 *
 * Rein & deterministisch (kleine, dichte Matrizen; Gauss-Elimination) → unit-testbar.
 */

// ─── Lineare Algebra (klein & dicht) ────────────────────────────────────────

function matVec(A: number[][], x: number[]): number[] {
  return A.map((row) => row.reduce((s, v, j) => s + v * x[j], 0));
}

function matMul(A: number[][], B: number[][]): number[][] {
  const n = A.length;
  const m = B[0].length;
  const k = B.length;
  const out = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let t = 0; t < k; t++) s += A[i][t] * B[t][j];
      out[i][j] = s;
    }
  return out;
}

function addMat(A: number[][], B: number[][]): number[][] {
  return A.map((row, i) => row.map((v, j) => v + B[i][j]));
}

function scaleMat(A: number[][], s: number): number[][] {
  return A.map((row) => row.map((v) => v * s));
}

/** Inverse via Gauss-Jordan mit Partial Pivoting. Wirft bei Singularität. */
export function invertMatrix(A: number[][]): number[][] {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    // Pivot suchen
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-14) throw new Error("Matrix nicht invertierbar (singulär)");
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    for (let j = 0; j < 2 * n; j++) M[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map((row) => row.slice(n));
}

// ─── Black-Litterman ─────────────────────────────────────────────────────────

export interface BLViews {
  /** K×N Pick-Matrix (welche Titel jede View betrifft). */
  P: number[][];
  /** K-Vektor der erwarteten View-Renditen. */
  Q: number[];
  /** K×K Unsicherheit der Views (diagonal, größer = unsicherer). */
  omega: number[][];
}

export interface BLOptions {
  /** Risikoaversion δ (Standard 2.5). */
  delta?: number;
  /** Skalierung der Prior-Unsicherheit τ (Standard 0.05). */
  tau?: number;
  views?: BLViews;
}

/**
 * @param Sigma   N×N (annualisierte) Kovarianz.
 * @param wPrior  N-Vektor der Prior-/Marktgewichte (Summe 1).
 * @returns Posterior-Erwartungsrenditen μ (N-Vektor).
 */
export function blackLitterman(Sigma: number[][], wPrior: number[], opts: BLOptions = {}): number[] {
  const n = Sigma.length;
  const delta = opts.delta ?? 2.5;
  const tau = opts.tau ?? 0.05;

  // Gleichgewichts-Prior Π = δ Σ w.
  const pi = matVec(Sigma, wPrior).map((v) => v * delta);
  if (!opts.views || opts.views.Q.length === 0) return pi;

  const { P, Q, omega } = opts.views;
  const tauSigmaInv = invertMatrix(scaleMat(Sigma, tau));
  const omegaInv = invertMatrix(omega);
  const Pt = P[0].map((_, j) => P.map((row) => row[j])); // transpose N×K

  // A = (τΣ)^-1 + Pᵀ Ω^-1 P
  const PtOmegaInv = matMul(Pt, omegaInv); // N×K
  const A = addMat(tauSigmaInv, matMul(PtOmegaInv, P)); // N×N
  // b = (τΣ)^-1 Π + Pᵀ Ω^-1 Q
  const b = matVec(tauSigmaInv, pi).map((v, i) => v + matVec(PtOmegaInv, Q)[i]);

  return matVec(invertMatrix(A), b);
}

/**
 * Bequemer Spezialfall: jede historische Mittelrendite ist eine ABSOLUTE View auf ihren Titel
 * (P = I, Q = histMeans), mit Unsicherheit Ω = diag(τ · diag(Σ)). So wird das verrauschte
 * historische μ Richtung des markt-konsistenten Priors geschrumpft.
 */
export function blPosteriorFromHistoricalMeans(
  Sigma: number[][],
  wPrior: number[],
  histMeans: number[],
  opts: { delta?: number; tau?: number } = {}
): number[] {
  const n = Sigma.length;
  const tau = opts.tau ?? 0.05;
  const P = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const omega = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? Math.max(tau * Sigma[i][i], 1e-8) : 0))
  );
  return blackLitterman(Sigma, wPrior, { delta: opts.delta, tau, views: { P, Q: histMeans, omega } });
}
