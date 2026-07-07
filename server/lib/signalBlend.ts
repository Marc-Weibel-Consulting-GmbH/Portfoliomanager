/**
 * Regime-abhängige, konfigurierbare Mischung aus Qualitäts- und Trading-Signal
 * (Track A / P1, AI_ALPHA_ROADMAP.md).
 *
 * Zwei Achsen je Titel:
 *  - Qualität / Titelwahl  (0..100, höher = besseres Unternehmen zum Halten)
 *  - Trading-Signal / Timing (-100..100, positiv = Kauf-, negativ = Verkaufs-Timing)
 *
 * Das Verhältnis der beiden ist REGIME-ABHÄNGIG und im Admin editierbar: in der Krise
 * zählt Qualität mehr, im Bullenmarkt das Timing. Diese Datei ist REIN und testbar; die
 * Gewichte kommen als Konfiguration herein (später aus der DB / Admin-UI).
 */

export interface RegimeWeights {
  /** Gewicht der Qualitäts-/Titelwahl-Achse (>= 0). */
  quality: number;
  /** Gewicht der Trading-/Timing-Achse (>= 0). */
  trading: number;
}

/** Konfiguration je Regime; `default` greift, wenn ein Regime nicht hinterlegt ist. */
export type RegimeBlendConfig = Record<string, RegimeWeights> & { default: RegimeWeights };

/**
 * Sinnvolle Defaults. Krise/Bär → Qualität dominiert (defensiv), Bulle → Timing/Momentum
 * stärker, Seitwärts → ausgewogen. Regime-Schlüssel bewusst tolerant (siehe resolveWeights).
 */
export const DEFAULT_REGIME_BLEND: RegimeBlendConfig = {
  crisis: { quality: 0.75, trading: 0.25 },
  bear: { quality: 0.65, trading: 0.35 },
  recovery: { quality: 0.45, trading: 0.55 },
  bull: { quality: 0.35, trading: 0.65 },
  sideways_high_vol: { quality: 0.6, trading: 0.4 },
  sideways_low_vol: { quality: 0.5, trading: 0.5 },
  default: { quality: 0.5, trading: 0.5 },
};

export type Recommendation = "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";

export interface BlendInput {
  /** 0..100 (höher = bessere Titelqualität). */
  qualityScore: number;
  /** -100..100 (positiv = Kauf-Timing). */
  tradingScore: number;
  /** Regime-Schlüssel (z. B. aus regimeEngine). */
  regime: string;
}

export interface BlendResult {
  /** Kombinierter Score, -100..100. */
  score: number;
  recommendation: Recommendation;
  weights: RegimeWeights;
  /** Beiträge der beiden Achsen (nach Gewichtung), für Transparenz/Erklärung. */
  breakdown: { qualityContribution: number; tradingContribution: number };
}

/** Regime-Gewichte auflösen; unbekanntes Regime → `default`. Case-insensitiv, tolerant. */
export function resolveWeights(regime: string, config: RegimeBlendConfig): RegimeWeights {
  const key = (regime || "").toLowerCase().replace(/[\s-]+/g, "_");
  return config[key] ?? config.default;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function toRecommendation(score: number): Recommendation {
  if (score >= 50) return "strong_buy";
  if (score >= 15) return "buy";
  if (score <= -50) return "strong_sell";
  if (score <= -15) return "sell";
  return "hold";
}

/**
 * Qualität (0..100) auf eine ±100-Attraktivität abbilden: 50 = neutral, 100 = +100, 0 = -100.
 * So sprechen beide Achsen dieselbe Sprache, bevor sie gewichtet gemischt werden.
 */
function qualityToSigned(qualityScore: number): number {
  return clamp((clamp(qualityScore, 0, 100) - 50) * 2, -100, 100);
}

export function blendSignal(input: BlendInput, config: RegimeBlendConfig = DEFAULT_REGIME_BLEND): BlendResult {
  const w = resolveWeights(input.regime, config);
  const total = w.quality + w.trading;
  // Normalisieren, damit die Gewichte immer zu 1 summieren (robust gegen Admin-Eingaben).
  const wq = total > 0 ? w.quality / total : 0.5;
  const wt = total > 0 ? w.trading / total : 0.5;

  const qSigned = qualityToSigned(input.qualityScore);
  const tSigned = clamp(input.tradingScore, -100, 100);

  const qualityContribution = wq * qSigned;
  const tradingContribution = wt * tSigned;
  const score = clamp(Math.round(qualityContribution + tradingContribution), -100, 100);

  return {
    score,
    recommendation: toRecommendation(score),
    weights: { quality: wq, trading: wt },
    breakdown: {
      qualityContribution: Math.round(qualityContribution),
      tradingContribution: Math.round(tradingContribution),
    },
  };
}
