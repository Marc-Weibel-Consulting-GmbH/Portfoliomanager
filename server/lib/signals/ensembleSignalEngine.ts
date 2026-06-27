/**
 * ensembleSignalEngine — Regime-gewichtete Kombination aller Signal-Engines
 *
 * Kombiniert:
 *   - trendSignal (MA-Alignment, ADX, Slope, Golden/Death Cross)
 *   - meanReversionSignal (RSI, Bollinger, Stochastik — light version)
 *   - rsiSignal (aus bestehenden TradingView-Daten)
 *
 * Gewichtung nach Regime:
 *   bull_trend / bear_trend  → Trend 70%, MeanRev 30%
 *   sideways_low_vol         → Trend 30%, MeanRev 70%
 *   sideways_high_vol        → Trend 40%, MeanRev 60%
 *   crisis / recovery        → Trend 50%, MeanRev 50%
 */

import type { MarketRegime, SignalOutput } from "./types";
import { computeTrendSignal } from "./trendSignalEngine";

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

function sma(prices: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { result.push(NaN); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += prices[j];
    result.push(sum / period);
  }
  return result;
}

function stdDev(prices: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { result.push(NaN); continue; }
    const slice = prices.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    result.push(Math.sqrt(variance));
  }
  return result;
}

function rsi(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  const recentPrices = prices.slice(-period - 1);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < recentPrices.length; i++) {
    const change = recentPrices[i] - recentPrices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mean-Reversion Signal Engine (light)
// ─────────────────────────────────────────────────────────────────────────────

function computeMeanReversionSignal(prices: number[]): {
  score: number;
  rationale: string[];
} {
  const rationale: string[] = [];
  let score = 0;
  let totalWeight = 0;

  if (prices.length < 20) {
    return { score: 0, rationale: ["Zu wenige Datenpunkte für Mean-Reversion"] };
  }

  const currentPrice = prices[prices.length - 1];

  // ── RSI (Gewicht: 0.40) ────────────────────────────────────────────────────
  const rsiVal = rsi(prices, 14);
  if (rsiVal !== null) {
    totalWeight += 0.40;
    if (rsiVal < 30) {
      score += 0.40 * 1.0;
      rationale.push(`✓ RSI ${rsiVal.toFixed(1)} < 30 (überverkauft → Kaufsignal)`);
    } else if (rsiVal < 40) {
      score += 0.40 * 0.5;
      rationale.push(`✓ RSI ${rsiVal.toFixed(1)} < 40 (leicht überverkauft)`);
    } else if (rsiVal > 70) {
      score += 0.40 * -1.0;
      rationale.push(`✗ RSI ${rsiVal.toFixed(1)} > 70 (überkauft → Verkaufssignal)`);
    } else if (rsiVal > 60) {
      score += 0.40 * -0.5;
      rationale.push(`✗ RSI ${rsiVal.toFixed(1)} > 60 (leicht überkauft)`);
    } else {
      rationale.push(`~ RSI ${rsiVal.toFixed(1)} (neutral)`);
    }
  }

  // ── Bollinger Bands (Gewicht: 0.35) ────────────────────────────────────────
  const bbPeriod = 20;
  const bbMult = 2.0;
  const bbSma = sma(prices, bbPeriod);
  const bbStd = stdDev(prices, bbPeriod);
  const lastBbSma = bbSma[bbSma.length - 1];
  const lastBbStd = bbStd[bbStd.length - 1];

  if (!isNaN(lastBbSma) && !isNaN(lastBbStd) && lastBbStd > 0) {
    totalWeight += 0.35;
    const upperBand = lastBbSma + bbMult * lastBbStd;
    const lowerBand = lastBbSma - bbMult * lastBbStd;
    const bbPosition = (currentPrice - lowerBand) / (upperBand - lowerBand);

    if (bbPosition < 0.05) {
      score += 0.35 * 1.0;
      rationale.push(`✓ Preis am unteren Bollinger Band (${(bbPosition * 100).toFixed(0)}%) → Kaufsignal`);
    } else if (bbPosition < 0.20) {
      score += 0.35 * 0.5;
      rationale.push(`✓ Preis nahe unterem Bollinger Band (${(bbPosition * 100).toFixed(0)}%)`);
    } else if (bbPosition > 0.95) {
      score += 0.35 * -1.0;
      rationale.push(`✗ Preis am oberen Bollinger Band (${(bbPosition * 100).toFixed(0)}%) → Verkaufssignal`);
    } else if (bbPosition > 0.80) {
      score += 0.35 * -0.5;
      rationale.push(`✗ Preis nahe oberem Bollinger Band (${(bbPosition * 100).toFixed(0)}%)`);
    } else {
      rationale.push(`~ Preis in Bollinger-Mitte (${(bbPosition * 100).toFixed(0)}%)`);
    }
  }

  // ── Preis vs. SMA20 (Gewicht: 0.25) ────────────────────────────────────────
  const sma20 = sma(prices, 20);
  const lastSma20 = sma20[sma20.length - 1];
  if (!isNaN(lastSma20) && lastSma20 > 0) {
    totalWeight += 0.25;
    const deviation = (currentPrice - lastSma20) / lastSma20;
    const normalizedDev = Math.max(-1, Math.min(1, -deviation * 10)); // Invertiert: weit unter SMA20 = bullisch
    score += 0.25 * normalizedDev;
    if (deviation < -0.05) rationale.push(`✓ Preis ${(deviation * 100).toFixed(1)}% unter SMA20 (Rückkehr erwartet)`);
    else if (deviation > 0.05) rationale.push(`✗ Preis ${(deviation * 100).toFixed(1)}% über SMA20 (Rückkehr erwartet)`);
    else rationale.push(`~ Preis nahe SMA20`);
  }

  const normalizedScore = totalWeight > 0 ? score / totalWeight : 0;
  return { score: Math.max(-1, Math.min(1, normalizedScore)), rationale };
}

// ─────────────────────────────────────────────────────────────────────────────
// Regime-Gewichtung
// ─────────────────────────────────────────────────────────────────────────────

function getRegimeWeights(regime: MarketRegime): { trend: number; meanRev: number } {
  switch (regime) {
    case "bull_trend":    return { trend: 0.70, meanRev: 0.30 };
    case "bear_trend":    return { trend: 0.70, meanRev: 0.30 };
    case "sideways_low_vol": return { trend: 0.30, meanRev: 0.70 };
    case "sideways_high_vol": return { trend: 0.40, meanRev: 0.60 };
    case "crisis":        return { trend: 0.50, meanRev: 0.50 };
    case "recovery":      return { trend: 0.50, meanRev: 0.50 };
    default:              return { trend: 0.50, meanRev: 0.50 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Öffentliche API
// ─────────────────────────────────────────────────────────────────────────────

export function computeEnsembleSignal(
  prices: number[],
  regime: MarketRegime
): SignalOutput {
  const trendSignal = computeTrendSignal(prices, regime);
  const { score: mrScore, rationale: mrRationale } = computeMeanReversionSignal(prices);

  const weights = getRegimeWeights(regime);

  const combinedScore = trendSignal.rawScore * weights.trend + mrScore * weights.meanRev;
  const clampedScore = Math.max(-1, Math.min(1, combinedScore));

  const direction: -1 | 0 | 1 = clampedScore > 0.15 ? 1 : clampedScore < -0.15 ? -1 : 0;

  // Konfidenz: Übereinstimmung der beiden Engines erhöht Konfidenz
  const trendDir = trendSignal.rawScore > 0.1 ? 1 : trendSignal.rawScore < -0.1 ? -1 : 0;
  const mrDir = mrScore > 0.1 ? 1 : mrScore < -0.1 ? -1 : 0;
  const agreement = trendDir === mrDir && trendDir !== 0;
  const baseConfidence = Math.abs(clampedScore);
  const confidence = Math.min(1, agreement ? baseConfidence * 1.2 : baseConfidence * 0.8);

  const entry = direction !== 0 && confidence > 0.45;
  const exit = direction === 0 && confidence > 0.55;

  // Stop/Take-Profit aus Trend-Signal übernehmen
  const rationale = [
    `Regime: ${regime} → Trend ${(weights.trend * 100).toFixed(0)}% / MeanRev ${(weights.meanRev * 100).toFixed(0)}%`,
    `Trend-Score: ${trendSignal.rawScore.toFixed(3)}, MeanRev-Score: ${mrScore.toFixed(3)}`,
    agreement ? "✓ Beide Engines stimmen überein (höhere Konfidenz)" : "~ Engines uneinig (reduzierte Konfidenz)",
    "",
    "── Trend-Signale ──",
    ...trendSignal.rationale,
    "",
    "── Mean-Reversion-Signale ──",
    ...mrRationale,
  ];

  return {
    engine: "ensemble",
    direction,
    rawScore: clampedScore,
    confidence,
    entry,
    exit,
    stopLossPct: trendSignal.stopLossPct,
    takeProfitPct: trendSignal.takeProfitPct,
    trailingStopPct: trendSignal.trailingStopPct,
    holdingPeriodHint: trendSignal.holdingPeriodHint,
    rationale,
  };
}
