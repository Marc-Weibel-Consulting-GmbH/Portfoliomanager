/**
 * Portfolio Quality Score (0–100) — E1
 *
 * Deterministic, documented scoring of portfolio quality.
 * Pure function: same inputs → same score. No LLM, no randomness.
 *
 * 5 Components (v2):
 *   1. Risikoadjustierte Rendite (30%): Sharpe, Sortino, Max Drawdown
 *   2. Bewertung (25%): Ø PEG, Ø PE, PEG-Verteilung (Anteil PEG<1.5 minus PEG>3)
 *   3. Risiko (15%): Volatilität p.a., Ø Beta
 *   4. Ertrag (15%, profilabhängig): Ø Dividendenrendite brutto (gewichtet)
 *   5. Diversifikation (15%): Titel-HHI, Sektor-HHI, Fremdwährungsanteil, Positionsanzahl
 *
 * v2-Kalibrierung (KIMI-Feedback):
 *   - Konzentration gebündelt: Titel-HHI von «Risiko» nach «Diversifikation»
 *     verschoben (Doppelzählung aufgelöst); DIV 10→15%, RISK 20→15%.
 *   - Ertrag profilabhängig (applyGoalWeights): «growth» gewichtet Dividende
 *     schwach (Growth-Portfolios werden nicht mehr strukturell bestraft),
 *     «dividends» stärker; «balanced»/null = Basisgewichte.
 *   - Bewertung: negatives/nullwertiges PEG bzw. negatives PE werden explizit
 *     niedrig bewertet statt wegrenormalisiert (Verlust-/Nullwachstum-Titel).
 *
 * Missing data → renormalize remaining components + report dataCoveragePct.
 *
 * Thresholds are admin-configurable via appSettings (key: 'score_thresholds').
 * Use getScoreThresholds() to load from DB, or pass config directly.
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

// Anlageziel des Portfolios/Nutzers — steuert die Ertrags-Gewichtung.
export type ScoreGoal = "dividends" | "growth" | "balanced";

// ─── Configurable Thresholds ────────────────────────────────────────────────

export interface ScoreThresholdsConfig {
  // Component weights (must sum to 1.0)
  componentWeights: {
    riskAdjustedReturn: number;
    valuation: number;
    risk: number;
    income: number;
    diversification: number;
  };
  // Sub-component weights within each component
  subWeights: {
    sharpe: number;
    sortino: number;
    maxDrawdown: number;
    peg: number;
    pe: number;
    pegDistribution: number;
    volatility: number;
    beta: number;
    hhi: number;
    sectorHHI: number;
    foreignCurrency: number;
    positionCount: number;
  };
  // Threshold arrays: [inputValue, score][]
  thresholds: {
    sharpe: [number, number][];
    sortino: [number, number][];
    maxDrawdown: [number, number][];
    peg: [number, number][];
    pe: [number, number][];
    volatility: [number, number][];
    beta: [number, number][];
    hhi: [number, number][];
    dividendYield: [number, number][];
    sectorHHI: [number, number][];
    foreignCurrency: [number, number][];
    positionCount: [number, number][];
  };
}

// ─── Default Thresholds ─────────────────────────────────────────────────────

export const DEFAULT_SCORE_CONFIG: ScoreThresholdsConfig = {
  componentWeights: {
    riskAdjustedReturn: 0.30,
    valuation: 0.25,
    risk: 0.15,
    income: 0.15,
    diversification: 0.15,
  },
  subWeights: {
    sharpe: 0.45,
    sortino: 0.30,
    maxDrawdown: 0.25,
    peg: 0.40,
    pe: 0.30,
    pegDistribution: 0.30,
    // Risiko (v2): nur noch Volatilität + Beta — Titel-HHI ist nach
    // «Diversifikation» gewandert, um Konzentration nicht doppelt zu zählen.
    volatility: 0.55,
    beta: 0.45,
    // Diversifikation (v2): Titel-HHI (hhi) + Sektor-HHI bündeln die
    // Konzentration; Positionsanzahl + Fremdwährung ergänzen die Streuung.
    hhi: 0.30,
    sectorHHI: 0.30,
    positionCount: 0.20,
    foreignCurrency: 0.20,
  },
  thresholds: {
    sharpe: [[-0.5, 0], [0, 15], [0.5, 40], [1.0, 70], [1.5, 100]],
    sortino: [[-0.5, 0], [0, 15], [0.5, 35], [1.0, 60], [2.0, 100]],
    // MaxDD «0 → 100» ist praxisfern (jedes reale Portfolio hat etwas
    // Drawdown); realistischer Deckel bei ~95 ab ≤ −2 %.
    maxDrawdown: [[-0.40, 0], [-0.20, 30], [-0.10, 60], [-0.05, 80], [-0.02, 95], [0, 95]],
    peg: [[0, 50], [0.5, 90], [1.0, 80], [1.5, 70], [2.5, 50], [3.0, 30], [5.0, 10]],
    pe: [[5, 85], [10, 80], [15, 70], [20, 55], [25, 40], [30, 30], [40, 20]],
    volatility: [[0.05, 100], [0.08, 85], [0.12, 70], [0.18, 50], [0.25, 30], [0.35, 10]],
    beta: [[0.3, 95], [0.5, 90], [0.8, 75], [1.0, 60], [1.2, 45], [1.5, 30], [2.0, 10]],
    hhi: [[0.03, 95], [0.05, 85], [0.10, 70], [0.15, 55], [0.20, 40], [0.30, 20], [0.50, 5]],
    dividendYield: [[0, 20], [0.01, 40], [0.02, 60], [0.03, 75], [0.04, 85], [0.05, 95], [0.08, 100]],
    sectorHHI: [[0.05, 95], [0.10, 80], [0.20, 60], [0.35, 40], [0.50, 20], [0.80, 5]],
    foreignCurrency: [[0, 50], [0.15, 65], [0.30, 80], [0.50, 85], [0.70, 70], [0.90, 55], [1.0, 45]],
    positionCount: [[3, 20], [5, 40], [8, 60], [12, 75], [20, 90], [30, 95], [50, 80], [80, 65]],
  },
};

// ─── DB-backed Config Loader (with in-memory cache) ─────────────────────────

let _cachedConfig: ScoreThresholdsConfig | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Load score thresholds from appSettings DB. Falls back to defaults. */
export async function getScoreThresholds(): Promise<ScoreThresholdsConfig> {
  const now = Date.now();
  if (_cachedConfig && (now - _cacheTimestamp) < CACHE_TTL_MS) {
    return _cachedConfig;
  }

  try {
    const { getDb } = await import("../db");
    const { appSettings } = await import("../../drizzle/schema");
    const db = await getDb();
    if (!db) return DEFAULT_SCORE_CONFIG;

    const rows = await db.select().from(appSettings);
    const row = rows.find((r: any) => r.key === "score_thresholds");
    if (!row?.value) {
      _cachedConfig = DEFAULT_SCORE_CONFIG;
      _cacheTimestamp = now;
      return DEFAULT_SCORE_CONFIG;
    }

    // Merge with defaults to ensure all fields exist
    const stored = row.value as Partial<ScoreThresholdsConfig>;
    _cachedConfig = {
      componentWeights: { ...DEFAULT_SCORE_CONFIG.componentWeights, ...stored.componentWeights },
      subWeights: { ...DEFAULT_SCORE_CONFIG.subWeights, ...stored.subWeights },
      thresholds: { ...DEFAULT_SCORE_CONFIG.thresholds, ...stored.thresholds },
    };
    _cacheTimestamp = now;
    return _cachedConfig;
  } catch (e) {
    console.warn("[scoreThresholds] Laden fehlgeschlagen:", (e as Error).message);
    return DEFAULT_SCORE_CONFIG;
  }
}

/** Invalidate the in-memory cache (call after admin update). */
export function invalidateScoreConfigCache(): void {
  _cachedConfig = null;
  _cacheTimestamp = 0;
}

// ─── Scoring Logic ──────────────────────────────────────────────────────────

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

// ─── Component Scoring Functions ─────────────────────────────────────────────

function scoreRiskAdjustedReturn(input: QualityScoreInput, config: ScoreThresholdsConfig): ComponentResult {
  const inputs: Record<string, number | string | null> = {};
  const scores: number[] = [];
  const weights: number[] = [];

  if (input.sharpe != null && isFinite(input.sharpe)) {
    const s = interpolate(input.sharpe, config.thresholds.sharpe);
    scores.push(s);
    weights.push(config.subWeights.sharpe);
    inputs.sharpe = input.sharpe;
  }
  if (input.sortino != null && isFinite(input.sortino)) {
    const s = interpolate(input.sortino, config.thresholds.sortino);
    scores.push(s);
    weights.push(config.subWeights.sortino);
    inputs.sortino = input.sortino;
  }
  if (input.maxDrawdown != null && isFinite(input.maxDrawdown)) {
    const s = interpolate(input.maxDrawdown, config.thresholds.maxDrawdown);
    scores.push(s);
    weights.push(config.subWeights.maxDrawdown);
    inputs.maxDrawdown = input.maxDrawdown;
  }

  if (scores.length === 0) {
    return { name: "Risikoadjustierte Rendite", weight: config.componentWeights.riskAdjustedReturn, score: 0, available: false, inputs };
  }

  const totalW = weights.reduce((a, b) => a + b, 0);
  const score = scores.reduce((sum, s, i) => sum + s * weights[i], 0) / totalW;

  return { name: "Risikoadjustierte Rendite", weight: config.componentWeights.riskAdjustedReturn, score: Math.round(score), available: true, inputs };
}

function scoreValuation(input: QualityScoreInput, config: ScoreThresholdsConfig): ComponentResult {
  const inputs: Record<string, number | string | null> = {};
  const scores: number[] = [];
  const weights: number[] = [];

  if (input.avgPEG != null && isFinite(input.avgPEG)) {
    // PEG ≤ 0 bedeutet nicht-positives Gewinnwachstum (oder negatives PE) —
    // methodisch schlecht. Explizit niedrig bewerten statt wegrenormalisieren.
    const s = input.avgPEG > 0 ? interpolate(input.avgPEG, config.thresholds.peg) : 20;
    scores.push(s);
    weights.push(config.subWeights.peg);
    inputs.avgPEG = input.avgPEG;
  }
  if (input.avgPE != null && isFinite(input.avgPE)) {
    // Negatives PE = Verlustsituation. Explizit sehr niedrig statt ignorieren.
    const s = input.avgPE > 0 ? interpolate(input.avgPE, config.thresholds.pe) : 5;
    scores.push(s);
    weights.push(config.subWeights.pe);
    inputs.avgPE = input.avgPE;
  }
  if (input.pegDistribution && input.pegDistribution.total > 0) {
    const cheapPct = input.pegDistribution.below15 / input.pegDistribution.total;
    const expensivePct = input.pegDistribution.above3 / input.pegDistribution.total;
    const distScore = Math.min(100, Math.max(0, cheapPct * 100 - expensivePct * 60 + 50));
    scores.push(distScore);
    weights.push(config.subWeights.pegDistribution);
    inputs.pegBelow15 = input.pegDistribution.below15;
    inputs.pegAbove3 = input.pegDistribution.above3;
    inputs.pegTotal = input.pegDistribution.total;
  }

  if (scores.length === 0) {
    return { name: "Bewertung", weight: config.componentWeights.valuation, score: 0, available: false, inputs };
  }

  const totalW = weights.reduce((a, b) => a + b, 0);
  const score = scores.reduce((sum, s, i) => sum + s * weights[i], 0) / totalW;

  return { name: "Bewertung", weight: config.componentWeights.valuation, score: Math.round(score), available: true, inputs };
}

function scoreRisk(input: QualityScoreInput, config: ScoreThresholdsConfig): ComponentResult {
  const inputs: Record<string, number | string | null> = {};
  const scores: number[] = [];
  const weights: number[] = [];

  if (input.volatility != null && isFinite(input.volatility)) {
    const s = interpolate(input.volatility, config.thresholds.volatility);
    scores.push(s);
    weights.push(config.subWeights.volatility);
    inputs.volatility = input.volatility;
  }
  if (input.avgBeta != null && isFinite(input.avgBeta)) {
    const s = interpolate(input.avgBeta, config.thresholds.beta);
    scores.push(s);
    weights.push(config.subWeights.beta);
    inputs.avgBeta = input.avgBeta;
  }

  if (scores.length === 0) {
    return { name: "Risiko", weight: config.componentWeights.risk, score: 0, available: false, inputs };
  }

  const totalW = weights.reduce((a, b) => a + b, 0);
  const score = scores.reduce((sum, s, i) => sum + s * weights[i], 0) / totalW;

  return { name: "Risiko", weight: config.componentWeights.risk, score: Math.round(score), available: true, inputs };
}

function scoreIncome(input: QualityScoreInput, config: ScoreThresholdsConfig): ComponentResult {
  const inputs: Record<string, number | string | null> = {};

  if (input.avgDividendYield == null || !isFinite(input.avgDividendYield)) {
    return { name: "Ertrag", weight: config.componentWeights.income, score: 0, available: false, inputs };
  }

  const score = interpolate(input.avgDividendYield, config.thresholds.dividendYield);
  inputs.avgDividendYield = input.avgDividendYield;

  return { name: "Ertrag", weight: config.componentWeights.income, score: Math.round(score), available: true, inputs };
}

function scoreDiversification(input: QualityScoreInput, config: ScoreThresholdsConfig): ComponentResult {
  const inputs: Record<string, number | string | null> = {};
  const scores: number[] = [];
  const weights: number[] = [];

  // Titel-HHI (Einzeltitel-Konzentration) — v2 hier gebündelt statt in «Risiko».
  if (input.hhi != null && isFinite(input.hhi)) {
    const s = interpolate(input.hhi, config.thresholds.hhi);
    scores.push(s);
    weights.push(config.subWeights.hhi);
    inputs.hhi = input.hhi;
  }
  if (input.sectorHHI != null && isFinite(input.sectorHHI)) {
    const s = interpolate(input.sectorHHI, config.thresholds.sectorHHI);
    scores.push(s);
    weights.push(config.subWeights.sectorHHI);
    inputs.sectorHHI = input.sectorHHI;
  }
  if (input.foreignCurrencyPct != null && isFinite(input.foreignCurrencyPct)) {
    const s = interpolate(input.foreignCurrencyPct, config.thresholds.foreignCurrency);
    scores.push(s);
    weights.push(config.subWeights.foreignCurrency);
    inputs.foreignCurrencyPct = input.foreignCurrencyPct;
  }
  if (input.positionCount != null && isFinite(input.positionCount)) {
    const s = interpolate(input.positionCount, config.thresholds.positionCount);
    scores.push(s);
    weights.push(config.subWeights.positionCount);
    inputs.positionCount = input.positionCount;
  }

  if (scores.length === 0) {
    return { name: "Diversifikation", weight: config.componentWeights.diversification, score: 0, available: false, inputs };
  }

  const totalW = weights.reduce((a, b) => a + b, 0);
  const score = scores.reduce((sum, s, i) => sum + s * weights[i], 0) / totalW;

  return { name: "Diversifikation", weight: config.componentWeights.diversification, score: Math.round(score), available: true, inputs };
}

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * Ertrags-Gewichtung nach Anlageziel anpassen (v2).
 *
 * Die Dividendenrendite ist für Wachstums-Anleger zweitrangig — ohne Anpassung
 * würde ein Growth-Portfolio (≈0 % Dividende → 20/100) strukturell abgewertet.
 * «growth» senkt das Ertrags-Gewicht und verteilt es auf risikoadjustierte
 * Rendite + Bewertung; «dividends» erhöht es (zulasten der Bewertung).
 * Die Summe bleibt 1.0.
 */
export function applyGoalWeights(
  w: ScoreThresholdsConfig["componentWeights"],
  goal?: ScoreGoal | null
): ScoreThresholdsConfig["componentWeights"] {
  if (goal === "growth") {
    const freed = Math.max(0, w.income - 0.05);
    return {
      ...w,
      income: w.income - freed,
      riskAdjustedReturn: w.riskAdjustedReturn + freed * 0.6,
      valuation: w.valuation + freed * 0.4,
    };
  }
  if (goal === "dividends") {
    const add = Math.min(0.05, w.valuation);
    return {
      ...w,
      income: w.income + add,
      valuation: w.valuation - add,
    };
  }
  return w;
}

/**
 * Calculate the Portfolio Quality Score (0–100).
 *
 * Missing components are renormalized (their weight is redistributed).
 * dataCoveragePct indicates how much of the total weight was available.
 *
 * @param input - Portfolio metrics
 * @param config - Optional threshold config (defaults to DEFAULT_SCORE_CONFIG)
 * @param goal - Optional Anlageziel; passt die Ertrags-Gewichtung an (v2)
 */
export function calculatePortfolioQualityScore(
  input: QualityScoreInput,
  config: ScoreThresholdsConfig = DEFAULT_SCORE_CONFIG,
  goal?: ScoreGoal | null
): QualityScoreResult {
  // Effektive Gewichte nach Anlageziel (balanced/null → unverändert).
  const effectiveConfig: ScoreThresholdsConfig =
    goal && goal !== "balanced"
      ? { ...config, componentWeights: applyGoalWeights(config.componentWeights, goal) }
      : config;

  const components = [
    scoreRiskAdjustedReturn(input, effectiveConfig),
    scoreValuation(input, effectiveConfig),
    scoreRisk(input, effectiveConfig),
    scoreIncome(input, effectiveConfig),
    scoreDiversification(input, effectiveConfig),
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

// ─── Score-Bänder (0–100 → Label) ────────────────────────────────────────────
// Einheitliche Einordnung für UI-Badges und Interpretationstexte.

export interface ScoreBand {
  min: number;
  label: string;
  color: string; // Tailwind-freundlicher Hex
}

export const SCORE_BANDS: ScoreBand[] = [
  { min: 80, label: "Exzellent", color: "#00CFC1" },
  { min: 60, label: "Solide", color: "#4ade80" },
  { min: 40, label: "Ausbaufähig", color: "#fbbf24" },
  { min: 0, label: "Kritisch", color: "#f87171" },
];

/** Ordnet einen Score (0–100) einem Band mit Label + Farbe zu. */
export function getScoreBand(score: number): ScoreBand {
  return SCORE_BANDS.find((b) => score >= b.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1];
}
