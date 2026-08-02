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
  if (config[key]) return config[key];
  // SIG-2 (Audit 2026-07): die Regime-Engine liefert `bull_trend`/`bear_trend`,
  // die Config-Keys heissen `bull`/`bear` — ohne Alias fielen genau die zwei
  // häufigsten Trendregimes still auf default (50/50) zurück und die beworbene
  // regime-abhängige Gewichtung war dort wirkungslos.
  const ALIASES: Record<string, string> = { bull_trend: "bull", bear_trend: "bear" };
  const aliased = ALIASES[key];
  if (aliased && config[aliased]) return config[aliased];
  return config.default;
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

export interface CombinedBlendInput {
  /** Momentum/Timing-Score, -1..1. */
  momentumScore: number;
  /** Qualitäts-Score, -1..1. */
  qualityScore: number;
  regime: string;
  /** LPPL-/Blasen-Abschlag, 0..1 (subtraktiv). */
  lpplPenalty?: number;
}

export interface CombinedBlendResult {
  /** 0..100, gleiche Skala wie die bisherige combined-Formel. */
  combinedScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  signalLabel: "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";
  weights: RegimeWeights;
}

/**
 * Notenband und Handlungsempfehlung — EINE Tabelle für beide.
 *
 * Vorher standen die Schwellen getrennt: Note B ab 0.60, Kaufsignal ab 0.55.
 * Zwischen 55.0 und 59.9 stand damit «Note C, Signal Kaufen» — für einen
 * Privatanleger ein Widerspruch, den keine Erklärung auflöst. Auch die
 * Gegenrichtung war offen: ab 0.70 gab es «Stark kaufen» bei blosser Note B.
 *
 * Beide Angaben beantworten dieselbe Frage in unterschiedlicher Sprache. Sie
 * kommen deshalb aus derselben Zeile — auseinanderlaufen können sie nicht mehr.
 *
 * Die Grenzen sind die des Notenbandes; es ist die etabliertere Skala und
 * erscheint in der Oberfläche prominenter.
 */
export const SCORE_BAENDER: {
  abScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  signal: "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";
  klartext: string;
}[] = [
  { abScore: 0.75, grade: "A", signal: "STRONG BUY",  klartext: "Sehr gut — deutlich kaufenswert" },
  { abScore: 0.60, grade: "B", signal: "BUY",         klartext: "Gut — kaufenswert" },
  { abScore: 0.45, grade: "C", signal: "HOLD",        klartext: "Durchschnittlich — halten" },
  { abScore: 0.30, grade: "D", signal: "SELL",        klartext: "Schwach — Abbau prüfen" },
  { abScore: 0,    grade: "F", signal: "STRONG SELL", klartext: "Sehr schwach — Verkauf prüfen" },
];

/** Band zu einem Score (0..1). Fällt nie durch — das letzte Band beginnt bei 0. */
export function bandFuerScore(combined: number): (typeof SCORE_BAENDER)[number] {
  const v = clamp(combined, 0, 1);
  return SCORE_BAENDER.find((b) => v >= b.abScore) ?? SCORE_BAENDER[SCORE_BAENDER.length - 1];
}

/**
 * Regime-abhängige Variante der bestehenden Momentum+Quality−LPPL-Kombiscore-Formel
 * (signalsRouter Step 8a). Faktor 1.0 statt 0.8: neutrale Aktien (momentumScore=0, qualityScore=0)
 * ergeben combined=0.5 → HOLD statt SELL. Nur die Gewichtung wird regime-abhängig und admin-konfigurierbar.
 */
export function blendCombinedScore(
  input: CombinedBlendInput,
  config: RegimeBlendConfig = DEFAULT_REGIME_BLEND
): CombinedBlendResult {
  const w = resolveWeights(input.regime, config);
  const total = w.quality + w.trading;
  const wq = total > 0 ? w.quality / total : 0.5;
  const wt = total > 0 ? w.trading / total : 0.5;

  const mNorm = (clamp(input.momentumScore, -1, 1) + 1) / 2; // -1..1 → 0..1
  const qNorm = (clamp(input.qualityScore, -1, 1) + 1) / 2;
  const lppl = input.lpplPenalty ?? 0;

  const combined = clamp(1.0 * (wq * qNorm + wt * mNorm) - lppl, 0, 1);
  const combinedScore = parseFloat((combined * 100).toFixed(1));
  const band = bandFuerScore(combined);

  return { combinedScore, grade: band.grade, signalLabel: band.signal, weights: { quality: wq, trading: wt } };
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
