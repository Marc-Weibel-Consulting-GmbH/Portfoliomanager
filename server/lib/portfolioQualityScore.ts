/**
 * Portfolio Quality Score (0–100) — E1
 *
 * Deterministic, documented scoring of portfolio quality.
 * Pure function: same inputs → same score. No LLM, no randomness.
 *
 * 5 Components (v1):
 *   1. Risikoadjustierte Rendite (30%): Sharpe, Sortino, Max Drawdown
 *   2. Bewertung (25%): Ø PEG, Ø PE, Anteil PEG < 1.5, Anteil PEG > 3
 *   3. Risiko (20%): Volatilität p.a., Ø Beta, Konzentration (HHI)
 *   4. Ertrag (15%): Ø Dividendenrendite brutto (gewichtet)
 *   5. Diversifikation (10%): Sektor-HHI, Fremdwährungsanteil, Positionsanzahl
 *
 * Missing data → renormalize remaining components + report dataCoveragePct.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QualityScoreInput {
  // Component 1: Risikoadjustierte Rendite
  sharpe?: number | null;
  sortino?: number | null;
  maxDrawdown?: number | null; // negative value, e.g. -0.08

  // Component 2: Bewertung
  avgPEG?: number | null;
  avgPE?: number | null;
  pegDistribution?: { below15: number; above3: number; total: number } | null;

  // Component 3: Risiko
  volatility?: number | null; // annualized, e.g. 0.12 = 12%
  avgBeta?: number | null;
  hhi?: number | null; // Herfindahl-Hirschman Index of position weights (0–1)

  // Component 4: Ertrag
  avgDividendYield?: number | null; // e.g. 0.03 = 3%

  // Component 5: Diversifikation
  sectorHHI?: number | null; // HHI of sector weights (0–1)
  foreignCurrencyPct?: number | null; // 0–1
  positionCount?: number | null;
}

export interface ComponentResult {
  name: string;
  weight: number;
  score: number; // 0–100
  available: boolean;
  inputs: Record<string, number | string | null>;
}

export interface QualityScoreResult {
  totalScore: number; // 0–100
  components: ComponentResult[];
  dataCoveragePct: number; // 0–100
}

// ─── Scoring Thresholds (documented constants) ───────────────────────────────

/**
 * Linear interpolation between thresholds.
 * thresholds: [[inputValue, score], ...] sorted by inputValue ascending.
 */
function interpolate(value: number, thresholds: [number, number][]): number {
  if (thresholds.length === 0) return 50;
  if (value <= thresholds[0][0]) return thresholds[0][1];
  if (value >= thresholds[thresholds.length - 1][0]) return thresholds[thresholds.length - 1][1];

  for (let i = 0; i < thresholds.length - 1; i++) {
    const [x0, y0] = thresholds[i];
    const [x1, y1] = thresholds[i + 1];
    if (value >= x0 && value <= x1) {
      const t = (value - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return thresholds[thresholds.length - 1][1];
}

// Sharpe: ≤0 → 0, 0.5 → 40, 1.0 → 70, ≥1.5 → 100
const SHARPE_THRESHOLDS: [number, number][] = [
  [-0.5, 0], [0, 15], [0.5, 40], [1.0, 70], [1.5, 100],
];

// Sortino: ≤0 → 0, 0.5 → 35, 1.0 → 60, ≥2.0 → 100
const SORTINO_THRESHOLDS: [number, number][] = [
  [-0.5, 0], [0, 15], [0.5, 35], [1.0, 60], [2.0, 100],
];

// Max Drawdown: 0% → 100, -5% → 80, -10% → 60, -20% → 30, ≤-40% → 0
const MDD_THRESHOLDS: [number, number][] = [
  [-0.40, 0], [-0.20, 30], [-0.10, 60], [-0.05, 80], [0, 100],
];

// PEG: <0.5 → 50 (too good to be true), 0.5–1.0 → 90, 1.0–1.5 → 70, 1.5–2.5 → 50, >3 → 20
const PEG_THRESHOLDS: [number, number][] = [
  [0, 50], [0.5, 90], [1.0, 80], [1.5, 70], [2.5, 50], [3.0, 30], [5.0, 10],
];

// PE: <10 → 85, 10–15 → 80, 15–20 → 65, 20–30 → 45, >40 → 20
const PE_THRESHOLDS: [number, number][] = [
  [5, 85], [10, 80], [15, 70], [20, 55], [25, 40], [30, 30], [40, 20],
];

// Volatility: <8% → 100, 8–12% → 80, 12–18% → 60, 18–25% → 40, >30% → 15
const VOL_THRESHOLDS: [number, number][] = [
  [0.05, 100], [0.08, 85], [0.12, 70], [0.18, 50], [0.25, 30], [0.35, 10],
];

// Beta: 0.5–0.8 → 90, 0.8–1.0 → 75, 1.0–1.2 → 60, >1.5 → 30
const BETA_THRESHOLDS: [number, number][] = [
  [0.3, 95], [0.5, 90], [0.8, 75], [1.0, 60], [1.2, 45], [1.5, 30], [2.0, 10],
];

// HHI (concentration): <0.05 → 90, 0.05–0.10 → 75, 0.10–0.20 → 55, >0.30 → 20
const HHI_THRESHOLDS: [number, number][] = [
  [0.03, 95], [0.05, 85], [0.10, 70], [0.15, 55], [0.20, 40], [0.30, 20], [0.50, 5],
];

// Dividend Yield: 0% → 20, 1% → 40, 2% → 60, 3% → 75, 4% → 85, ≥5% → 95
const DIV_THRESHOLDS: [number, number][] = [
  [0, 20], [0.01, 40], [0.02, 60], [0.03, 75], [0.04, 85], [0.05, 95], [0.08, 100],
];

// Sector HHI: <0.10 → 95, 0.10–0.20 → 75, 0.20–0.35 → 50, >0.50 → 15
const SECTOR_HHI_THRESHOLDS: [number, number][] = [
  [0.05, 95], [0.10, 80], [0.20, 60], [0.35, 40], [0.50, 20], [0.80, 5],
];

// Foreign Currency %: 0% → 50, 20% → 65, 40% → 80, 60% → 75, 80% → 60, 100% → 45
// (moderate diversification is best)
const FX_THRESHOLDS: [number, number][] = [
  [0, 50], [0.15, 65], [0.30, 80], [0.50, 85], [0.70, 70], [0.90, 55], [1.0, 45],
];

// Position count: <5 → 30, 8 → 55, 12 → 75, 20 → 90, 30 → 95, >50 → 80 (over-diversified)
const POS_COUNT_THRESHOLDS: [number, number][] = [
  [3, 20], [5, 40], [8, 60], [12, 75], [20, 90], [30, 95], [50, 80], [80, 65],
];

// ─── Component Scoring Functions ─────────────────────────────────────────────

function scoreRiskAdjustedReturn(input: QualityScoreInput): ComponentResult {
  const inputs: Record<string, number | string | null> = {};
  const scores: number[] = [];
  const weights: number[] = [];

  if (input.sharpe != null && isFinite(input.sharpe)) {
    const s = interpolate(input.sharpe, SHARPE_THRESHOLDS);
    scores.push(s);
    weights.push(0.45); // Sharpe is dominant
    inputs.sharpe = input.sharpe;
  }
  if (input.sortino != null && isFinite(input.sortino)) {
    const s = interpolate(input.sortino, SORTINO_THRESHOLDS);
    scores.push(s);
    weights.push(0.30);
    inputs.sortino = input.sortino;
  }
  if (input.maxDrawdown != null && isFinite(input.maxDrawdown)) {
    const s = interpolate(input.maxDrawdown, MDD_THRESHOLDS);
    scores.push(s);
    weights.push(0.25);
    inputs.maxDrawdown = input.maxDrawdown;
  }

  if (scores.length === 0) {
    return { name: "Risikoadjustierte Rendite", weight: 0.30, score: 0, available: false, inputs };
  }

  const totalW = weights.reduce((a, b) => a + b, 0);
  const score = scores.reduce((sum, s, i) => sum + s * weights[i], 0) / totalW;

  return { name: "Risikoadjustierte Rendite", weight: 0.30, score: Math.round(score), available: true, inputs };
}

function scoreValuation(input: QualityScoreInput): ComponentResult {
  const inputs: Record<string, number | string | null> = {};
  const scores: number[] = [];
  const weights: number[] = [];

  if (input.avgPEG != null && isFinite(input.avgPEG) && input.avgPEG > 0) {
    const s = interpolate(input.avgPEG, PEG_THRESHOLDS);
    scores.push(s);
    weights.push(0.40);
    inputs.avgPEG = input.avgPEG;
  }
  if (input.avgPE != null && isFinite(input.avgPE) && input.avgPE > 0) {
    const s = interpolate(input.avgPE, PE_THRESHOLDS);
    scores.push(s);
    weights.push(0.30);
    inputs.avgPE = input.avgPE;
  }
  if (input.pegDistribution && input.pegDistribution.total > 0) {
    // Bonus for many cheap titles, penalty for many expensive ones
    const cheapPct = input.pegDistribution.below15 / input.pegDistribution.total;
    const expensivePct = input.pegDistribution.above3 / input.pegDistribution.total;
    const distScore = Math.min(100, Math.max(0, cheapPct * 100 - expensivePct * 60 + 50));
    scores.push(distScore);
    weights.push(0.30);
    inputs.pegBelow15 = input.pegDistribution.below15;
    inputs.pegAbove3 = input.pegDistribution.above3;
    inputs.pegTotal = input.pegDistribution.total;
  }

  if (scores.length === 0) {
    return { name: "Bewertung", weight: 0.25, score: 0, available: false, inputs };
  }

  const totalW = weights.reduce((a, b) => a + b, 0);
  const score = scores.reduce((sum, s, i) => sum + s * weights[i], 0) / totalW;

  return { name: "Bewertung", weight: 0.25, score: Math.round(score), available: true, inputs };
}

function scoreRisk(input: QualityScoreInput): ComponentResult {
  const inputs: Record<string, number | string | null> = {};
  const scores: number[] = [];
  const weights: number[] = [];

  if (input.volatility != null && isFinite(input.volatility)) {
    const s = interpolate(input.volatility, VOL_THRESHOLDS);
    scores.push(s);
    weights.push(0.40);
    inputs.volatility = input.volatility;
  }
  if (input.avgBeta != null && isFinite(input.avgBeta)) {
    const s = interpolate(input.avgBeta, BETA_THRESHOLDS);
    scores.push(s);
    weights.push(0.30);
    inputs.avgBeta = input.avgBeta;
  }
  if (input.hhi != null && isFinite(input.hhi)) {
    const s = interpolate(input.hhi, HHI_THRESHOLDS);
    scores.push(s);
    weights.push(0.30);
    inputs.hhi = input.hhi;
  }

  if (scores.length === 0) {
    return { name: "Risiko", weight: 0.20, score: 0, available: false, inputs };
  }

  const totalW = weights.reduce((a, b) => a + b, 0);
  const score = scores.reduce((sum, s, i) => sum + s * weights[i], 0) / totalW;

  return { name: "Risiko", weight: 0.20, score: Math.round(score), available: true, inputs };
}

function scoreIncome(input: QualityScoreInput): ComponentResult {
  const inputs: Record<string, number | string | null> = {};

  if (input.avgDividendYield == null || !isFinite(input.avgDividendYield)) {
    return { name: "Ertrag", weight: 0.15, score: 0, available: false, inputs };
  }

  const score = interpolate(input.avgDividendYield, DIV_THRESHOLDS);
  inputs.avgDividendYield = input.avgDividendYield;

  return { name: "Ertrag", weight: 0.15, score: Math.round(score), available: true, inputs };
}

function scoreDiversification(input: QualityScoreInput): ComponentResult {
  const inputs: Record<string, number | string | null> = {};
  const scores: number[] = [];
  const weights: number[] = [];

  if (input.sectorHHI != null && isFinite(input.sectorHHI)) {
    const s = interpolate(input.sectorHHI, SECTOR_HHI_THRESHOLDS);
    scores.push(s);
    weights.push(0.40);
    inputs.sectorHHI = input.sectorHHI;
  }
  if (input.foreignCurrencyPct != null && isFinite(input.foreignCurrencyPct)) {
    const s = interpolate(input.foreignCurrencyPct, FX_THRESHOLDS);
    scores.push(s);
    weights.push(0.30);
    inputs.foreignCurrencyPct = input.foreignCurrencyPct;
  }
  if (input.positionCount != null && isFinite(input.positionCount)) {
    const s = interpolate(input.positionCount, POS_COUNT_THRESHOLDS);
    scores.push(s);
    weights.push(0.30);
    inputs.positionCount = input.positionCount;
  }

  if (scores.length === 0) {
    return { name: "Diversifikation", weight: 0.10, score: 0, available: false, inputs };
  }

  const totalW = weights.reduce((a, b) => a + b, 0);
  const score = scores.reduce((sum, s, i) => sum + s * weights[i], 0) / totalW;

  return { name: "Diversifikation", weight: 0.10, score: Math.round(score), available: true, inputs };
}

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * Calculate the Portfolio Quality Score (0–100).
 *
 * Missing components are renormalized (their weight is redistributed).
 * dataCoveragePct indicates how much of the total weight was available.
 */
export function calculatePortfolioQualityScore(input: QualityScoreInput): QualityScoreResult {
  const components = [
    scoreRiskAdjustedReturn(input),
    scoreValuation(input),
    scoreRisk(input),
    scoreIncome(input),
    scoreDiversification(input),
  ];

  // Renormalize: only available components contribute
  const availableComponents = components.filter((c) => c.available);
  const totalAvailableWeight = availableComponents.reduce((sum, c) => sum + c.weight, 0);

  // Data coverage = sum of available component weights / total weights (always 1.0)
  const dataCoveragePct = Math.round(totalAvailableWeight * 100);

  if (availableComponents.length === 0) {
    return { totalScore: 0, components, dataCoveragePct: 0 };
  }

  // Weighted average with renormalization
  const totalScore = availableComponents.reduce(
    (sum, c) => sum + c.score * (c.weight / totalAvailableWeight),
    0
  );

  return {
    totalScore: Math.round(Math.min(100, Math.max(0, totalScore))),
    components,
    dataCoveragePct,
  };
}

// ─── Helper: Calculate HHI from weights ──────────────────────────────────────

export function calculateHHI(weights: number[]): number {
  return weights.reduce((sum, w) => sum + w * w, 0);
}
