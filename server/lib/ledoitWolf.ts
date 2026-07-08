/**
 * Ledoit-Wolf-Kovarianz-Shrinkage mit Constant-Correlation-Target (Ledoit & Wolf 2004,
 * "Honey, I Shrunk the Sample Covariance Matrix").
 *
 * Die naive Stichproben-Kovarianz ist bei wenigen Beobachtungen relativ zur Titelzahl stark
 * verrauscht — für Mean-Variance-Optimierung fatal (Extremgewichte auf Schätzfehler). LW
 * schrumpft sie analytisch optimal Richtung einer strukturierten Zielmatrix (alle Paare teilen
 * die durchschnittliche Korrelation), mit datengetriebener Intensität δ ∈ [0, 1].
 *
 * Rein & deterministisch → unit-testbar.
 */

export interface LedoitWolfResult {
  /** Geschrumpfte (tägliche) Kovarianzmatrix, N×N, symmetrisch. */
  cov: number[][];
  /** Shrinkage-Intensität δ ∈ [0, 1] (0 = reine Stichprobe, 1 = reines Target). */
  shrinkage: number;
}

/**
 * @param returns  N Reihen (Assets) × T Beobachtungen (tägliche Renditen), alle gleich lang.
 */
export function ledoitWolfConstantCorr(returns: number[][]): LedoitWolfResult {
  const N = returns.length;
  const T = N > 0 ? returns[0].length : 0;
  const zero = () => Array.from({ length: N }, () => new Array(N).fill(0));
  if (N === 0 || T < 2) return { cov: zero(), shrinkage: 0 };

  // Demean je Asset.
  const means = returns.map((r) => r.reduce((a, b) => a + b, 0) / T);
  const x = returns.map((r, i) => r.map((v) => v - means[i])); // N×T

  // Stichproben-Kovarianz S (1/T, wie im LW-Paper).
  const S = zero();
  for (let i = 0; i < N; i++) {
    for (let j = i; j < N; j++) {
      let s = 0;
      for (let t = 0; t < T; t++) s += x[i][t] * x[j][t];
      s /= T;
      S[i][j] = s;
      S[j][i] = s;
    }
  }
  const std = S.map((_, i) => Math.sqrt(Math.max(S[i][i], 1e-16)));

  // Durchschnittliche Stichproben-Korrelation r̄.
  let rsum = 0;
  let cnt = 0;
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      rsum += S[i][j] / (std[i] * std[j]);
      cnt++;
    }
  }
  const rbar = cnt > 0 ? rsum / cnt : 0;

  // Zielmatrix F: Diagonale = Stichprobenvarianzen, off-diagonal = r̄·σi·σj.
  const F = zero();
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) F[i][j] = i === j ? S[i][i] : rbar * std[i] * std[j];
  }

  // π̂ = Σ_ij (1/T) Σ_t (x_it x_jt − S_ij)²  (Varianz der Kovarianz-Schätzer).
  const piMat = zero();
  let piHat = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      let s = 0;
      for (let t = 0; t < T; t++) {
        const d = x[i][t] * x[j][t] - S[i][j];
        s += d * d;
      }
      s /= T;
      piMat[i][j] = s;
      piHat += s;
    }
  }

  // ρ̂: Diagonalanteil + Off-Diagonal-Kovarianzterm des Constant-Correlation-Targets.
  const theta = (k: number, i: number, j: number) => {
    let s = 0;
    for (let t = 0; t < T; t++) s += (x[k][t] * x[k][t] - S[k][k]) * (x[i][t] * x[j][t] - S[i][j]);
    return s / T;
  };
  let rhoHat = 0;
  for (let i = 0; i < N; i++) rhoHat += piMat[i][i];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      rhoHat += (rbar / 2) * ((std[j] / std[i]) * theta(i, i, j) + (std[i] / std[j]) * theta(j, i, j));
    }
  }

  // γ̂ = ||F − S||²_F.
  let gammaHat = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const d = F[i][j] - S[i][j];
      gammaHat += d * d;
    }
  }

  let delta = 0;
  if (gammaHat > 1e-16) {
    const kappa = (piHat - rhoHat) / gammaHat;
    delta = Math.max(0, Math.min(1, kappa / T));
  }

  const cov = zero();
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) cov[i][j] = delta * F[i][j] + (1 - delta) * S[i][j];
  }
  return { cov, shrinkage: delta };
}
