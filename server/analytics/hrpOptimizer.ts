/**
 * Hierarchical Risk Parity (HRP) Optimizer
 * ==========================================
 * Pure TypeScript implementation of the HRP algorithm by Marcos López de Prado (2016).
 * 
 * HRP builds a portfolio that:
 *  1. Clusters assets by correlation (hierarchical clustering via single-linkage)
 *  2. Allocates risk budgets recursively along the dendrogram (bisection)
 *  3. Weights each asset inversely proportional to its cluster's variance
 * 
 * Advantages over Mean-Variance Optimization:
 *  - No matrix inversion required (robust to near-singular covariance matrices)
 *  - No expected return estimates needed (avoids estimation error amplification)
 *  - Naturally diversified across correlation clusters
 *  - Stable weights even with few observations
 * 
 * Reference: López de Prado, M. (2016). Building Diversified Portfolios that Outperform
 *            Out-of-Sample. Journal of Portfolio Management, 42(4), 59–69.
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface HRPResult {
  weights: Record<string, number>;
  /** Cluster order of tickers (left to right in dendrogram) */
  sortedTickers: string[];
  /** Per-asset contribution to portfolio variance (0–1) */
  riskContributions: Record<string, number>;
  /** Portfolio-level stats */
  portfolioStats: {
    expectedReturn: number;
    volatility: number;
    sharpe: number;
    diversificationRatio: number;
  };
}

// ─────────────────────────────────────────────
// Step 1: Correlation & Covariance Matrix
// ─────────────────────────────────────────────

/** Compute correlation matrix from returns map */
function correlationMatrix(
  tickers: string[],
  returnsMap: Record<string, number[]>
): number[][] {
  const n = tickers.length;
  const corr: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    corr[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const ri = returnsMap[tickers[i]];
      const rj = returnsMap[tickers[j]];
      const len = Math.min(ri.length, rj.length);
      if (len < 5) {
        corr[i][j] = 0;
        corr[j][i] = 0;
        continue;
      }
      const meanI = ri.slice(-len).reduce((a, b) => a + b, 0) / len;
      const meanJ = rj.slice(-len).reduce((a, b) => a + b, 0) / len;
      let cov = 0, varI = 0, varJ = 0;
      for (let k = 0; k < len; k++) {
        const di = ri[ri.length - len + k] - meanI;
        const dj = rj[rj.length - len + k] - meanJ;
        cov += di * dj;
        varI += di * di;
        varJ += dj * dj;
      }
      const denom = Math.sqrt(varI * varJ);
      const r = denom > 0 ? cov / denom : 0;
      // Clamp to [-1, 1] to handle floating point edge cases
      corr[i][j] = Math.max(-1, Math.min(1, r));
      corr[j][i] = corr[i][j];
    }
  }
  return corr;
}

/** Compute covariance matrix from returns map */
function covarianceMatrix(
  tickers: string[],
  returnsMap: Record<string, number[]>,
  tradingDaysPerYear = 252
): number[][] {
  const n = tickers.length;
  const cov: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const ri = returnsMap[tickers[i]];
      const rj = returnsMap[tickers[j]];
      const len = Math.min(ri.length, rj.length);
      if (len < 5) continue;
      const meanI = ri.slice(-len).reduce((a, b) => a + b, 0) / len;
      const meanJ = rj.slice(-len).reduce((a, b) => a + b, 0) / len;
      let c = 0;
      for (let k = 0; k < len; k++) {
        c += (ri[ri.length - len + k] - meanI) * (rj[rj.length - len + k] - meanJ);
      }
      // Annualise
      const annualized = (c / (len - 1)) * tradingDaysPerYear;
      cov[i][j] = annualized;
      cov[j][i] = annualized;
    }
  }
  return cov;
}

// ─────────────────────────────────────────────
// Step 2: Hierarchical Clustering (Single-Linkage)
// ─────────────────────────────────────────────

/** Convert correlation matrix to distance matrix: d = sqrt(0.5 * (1 - rho)) */
function corrToDistance(corr: number[][]): number[][] {
  const n = corr.length;
  return corr.map((row, i) =>
    row.map((r, j) => (i === j ? 0 : Math.sqrt(Math.max(0, 0.5 * (1 - r)))))
  );
}

interface Cluster {
  members: number[]; // indices into original ticker array
  distance: number;
}

/**
 * Single-linkage hierarchical clustering.
 * Returns the merge order as a list of [clusterA, clusterB] index pairs,
 * where each index refers to the current cluster list at that step.
 */
function hierarchicalClustering(dist: number[][]): number[][] {
  const n = dist.length;
  // Each asset starts as its own cluster
  const clusters: number[][] = Array.from({ length: n }, (_, i) => [i]);
  const mergeOrder: number[][] = [];

  // Distance between two clusters: single linkage (minimum distance)
  function clusterDist(a: number[], b: number[]): number {
    let minD = Infinity;
    for (const i of a) {
      for (const j of b) {
        if (dist[i][j] < minD) minD = dist[i][j];
      }
    }
    return minD;
  }

  while (clusters.length > 1) {
    let minDist = Infinity;
    let mergeA = 0;
    let mergeB = 1;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const d = clusterDist(clusters[i], clusters[j]);
        if (d < minDist) {
          minDist = d;
          mergeA = i;
          mergeB = j;
        }
      }
    }

    // Record the merge
    mergeOrder.push([mergeA, mergeB]);

    // Merge clusters (remove B, extend A)
    const merged = [...clusters[mergeA], ...clusters[mergeB]];
    clusters.splice(mergeB, 1);
    clusters.splice(mergeA, 1);
    clusters.push(merged);
  }

  return mergeOrder;
}

/**
 * Quasi-diagonalise: reorder tickers so that correlated assets are adjacent.
 * This is the "seriation" step from López de Prado (2016).
 */
function quasiDiagonalize(
  mergeOrder: number[][],
  n: number
): number[] {
  // Reconstruct the dendrogram bottom-up to get leaf order
  // Each cluster is represented as an ordered list of leaf indices
  const clusters: number[][] = Array.from({ length: n }, (_, i) => [i]);

  for (const [a, b] of mergeOrder) {
    const ca = clusters[a];
    const cb = clusters[b];
    const merged = [...ca, ...cb];
    clusters.splice(b, 1);
    clusters.splice(a, 1);
    clusters.push(merged);
  }

  // The last cluster contains all indices in dendrogram order
  return clusters[clusters.length - 1] ?? Array.from({ length: n }, (_, i) => i);
}

// ─────────────────────────────────────────────
// Step 3: Recursive Bisection (HRP Weight Allocation)
// ─────────────────────────────────────────────

/** Variance of a sub-portfolio with equal weights within the cluster */
function clusterVariance(
  indices: number[],
  cov: number[][]
): number {
  const n = indices.length;
  if (n === 0) return 0;
  const w = 1 / n;
  let variance = 0;
  for (const i of indices) {
    for (const j of indices) {
      variance += w * w * cov[i][j];
    }
  }
  return Math.max(0, variance);
}

/**
 * Inverse-variance weighting within a cluster.
 * Each asset gets weight proportional to 1/variance(i).
 */
function inverseVarianceWeights(
  indices: number[],
  cov: number[][]
): number[] {
  const variances = indices.map(i => Math.max(1e-10, cov[i][i]));
  const invVars = variances.map(v => 1 / v);
  const sumInv = invVars.reduce((a, b) => a + b, 0);
  return invVars.map(iv => iv / sumInv);
}

/**
 * Recursive bisection: allocate weights by splitting the sorted cluster list
 * into two halves and distributing weight proportional to inverse cluster variance.
 */
function recursiveBisection(
  sortedIndices: number[],
  cov: number[][],
  weights: number[]
): void {
  if (sortedIndices.length <= 1) return;

  const mid = Math.floor(sortedIndices.length / 2);
  const left = sortedIndices.slice(0, mid);
  const right = sortedIndices.slice(mid);

  const varLeft = clusterVariance(left, cov);
  const varRight = clusterVariance(right, cov);

  // Allocate weight inversely proportional to cluster variance
  const totalVar = varLeft + varRight;
  const alphaLeft = totalVar > 0 ? 1 - varLeft / totalVar : 0.5;
  const alphaRight = 1 - alphaLeft;

  // Scale existing weights in each sub-cluster
  for (const idx of left) {
    weights[idx] *= alphaLeft;
  }
  for (const idx of right) {
    weights[idx] *= alphaRight;
  }

  // Recurse
  recursiveBisection(left, cov, weights);
  recursiveBisection(right, cov, weights);
}

// ─────────────────────────────────────────────
// Step 4: Apply Position Constraints
// ─────────────────────────────────────────────

/**
 * Clamp weights to [minWeight, maxWeight] and renormalize.
 * Iterative approach: clamp, renormalize, repeat until stable.
 */
function applyWeightConstraints(
  weights: number[],
  minWeight: number,
  maxWeight: number,
  maxIter = 50
): number[] {
  let w = [...weights];

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;

    // Clamp
    for (let i = 0; i < w.length; i++) {
      const clamped = Math.max(minWeight, Math.min(maxWeight, w[i]));
      if (Math.abs(clamped - w[i]) > 1e-8) changed = true;
      w[i] = clamped;
    }

    // Renormalize
    const sum = w.reduce((a, b) => a + b, 0);
    if (sum > 0) w = w.map(wi => wi / sum);

    if (!changed) break;
  }

  return w;
}

// ─────────────────────────────────────────────
// Step 5: Portfolio Statistics
// ─────────────────────────────────────────────

function computePortfolioStats(
  weights: number[],
  tickers: string[],
  returnsMap: Record<string, number[]>,
  cov: number[][],
  riskFreeRate: number
): { expectedReturn: number; volatility: number; sharpe: number; diversificationRatio: number } {
  const n = tickers.length;
  const tradingDays = 252;

  // Expected return: weighted average of annualised mean returns
  let expectedReturn = 0;
  for (let i = 0; i < n; i++) {
    const r = returnsMap[tickers[i]];
    const meanDaily = r.length > 0 ? r.reduce((a, b) => a + b, 0) / r.length : 0;
    expectedReturn += weights[i] * meanDaily * tradingDays;
  }

  // Portfolio variance: w' Σ w
  let variance = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      variance += weights[i] * weights[j] * cov[i][j];
    }
  }
  const volatility = Math.sqrt(Math.max(0, variance));

  // Sharpe ratio
  const sharpe = volatility > 0 ? (expectedReturn - riskFreeRate) / volatility : 0;

  // Diversification ratio: weighted avg individual vol / portfolio vol
  let weightedAvgVol = 0;
  for (let i = 0; i < n; i++) {
    weightedAvgVol += weights[i] * Math.sqrt(Math.max(0, cov[i][i]));
  }
  const diversificationRatio = volatility > 0 ? weightedAvgVol / volatility : 1;

  return {
    expectedReturn: Math.round(expectedReturn * 10000) / 10000,
    volatility: Math.round(volatility * 10000) / 10000,
    sharpe: Math.round(sharpe * 1000) / 1000,
    diversificationRatio: Math.round(diversificationRatio * 100) / 100,
  };
}

/** Risk contribution of each asset: w_i * (Σw)_i / portfolio_variance */
function computeRiskContributions(
  weights: number[],
  tickers: string[],
  cov: number[][]
): Record<string, number> {
  const n = tickers.length;
  let portfolioVariance = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      portfolioVariance += weights[i] * weights[j] * cov[i][j];
    }
  }

  const result: Record<string, number> = {};
  if (portfolioVariance <= 0) {
    tickers.forEach(t => { result[t] = 1 / n; });
    return result;
  }

  for (let i = 0; i < n; i++) {
    let marginalContrib = 0;
    for (let j = 0; j < n; j++) {
      marginalContrib += weights[j] * cov[i][j];
    }
    const riskContrib = weights[i] * marginalContrib / portfolioVariance;
    result[tickers[i]] = Math.round(Math.max(0, riskContrib) * 10000) / 10000;
  }

  return result;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

export interface HRPInput {
  tickers: string[];
  returnsMap: Record<string, number[]>;
  riskFreeRate?: number;
  minPositionWeight?: number;
  maxPositionWeight?: number;
}

/**
 * Run the full HRP algorithm:
 *  1. Build correlation & covariance matrices
 *  2. Hierarchical clustering (single-linkage on distance matrix)
 *  3. Quasi-diagonalise (seriation)
 *  4. Recursive bisection for weight allocation
 *  5. Apply position constraints
 *  6. Compute portfolio statistics
 */
export function runHRP(input: HRPInput): HRPResult {
  const {
    tickers,
    returnsMap,
    riskFreeRate = 0.01, // Swiss risk-free rate (SNB ~0.5–1%)
    minPositionWeight = 0.01,
    maxPositionWeight = 0.15,
  } = input;

  const n = tickers.length;

  if (n < 2) {
    throw new Error('HRP requires at least 2 tickers.');
  }

  // Step 1: Build matrices
  const corr = correlationMatrix(tickers, returnsMap);
  const cov = covarianceMatrix(tickers, returnsMap);

  // Step 2: Distance matrix & hierarchical clustering
  const dist = corrToDistance(corr);
  const mergeOrder = hierarchicalClustering(dist);

  // Step 3: Quasi-diagonalise (get sorted leaf order)
  const sortedIndices = quasiDiagonalize(mergeOrder, n);

  // Step 4: Recursive bisection
  const rawWeights = new Array(n).fill(1); // start with equal weights
  recursiveBisection(sortedIndices, cov, rawWeights);

  // Normalise
  const sumRaw = rawWeights.reduce((a, b) => a + b, 0);
  const normWeights = sumRaw > 0 ? rawWeights.map(w => w / sumRaw) : new Array(n).fill(1 / n);

  // Step 5: Apply position constraints
  const constrainedWeights = applyWeightConstraints(normWeights, minPositionWeight, maxPositionWeight);

  // Step 6: Build output
  const weightsMap: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    weightsMap[tickers[i]] = Math.round(constrainedWeights[i] * 10000) / 10000;
  }

  const sortedTickers = sortedIndices.map(i => tickers[i]);

  const stats = computePortfolioStats(constrainedWeights, tickers, returnsMap, cov, riskFreeRate);
  const riskContributions = computeRiskContributions(constrainedWeights, tickers, cov);

  return {
    weights: weightsMap,
    sortedTickers,
    riskContributions,
    portfolioStats: stats,
  };
}
