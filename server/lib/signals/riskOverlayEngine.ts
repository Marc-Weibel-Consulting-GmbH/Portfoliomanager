/**
 * riskOverlayEngine — LPPL + Volatilität → Signal-Dämpfung
 *
 * Reduziert die Konfidenz und blockiert Entry-Signale bei erhöhtem Risiko.
 * Modifiziert kein Signal-Vorzeichen — nur die Stärke.
 *
 * Quellen:
 *   - LPPLS BubbleScore (aus lpplsEngine.ts, bereits im System)
 *   - Realisierte Volatilität (aus Preisserie)
 *   - Drawdown (aus Preisserie)
 */

import type { MarketRegime, RiskOverlay, SignalOutput } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

function realizedVol(prices: number[], period: number): number | null {
  if (prices.length < period + 1) return null;
  const recentPrices = prices.slice(-period - 1);
  const returns: number[] = [];
  for (let i = 1; i < recentPrices.length; i++) {
    if (recentPrices[i - 1] > 0) {
      returns.push(Math.log(recentPrices[i] / recentPrices[i - 1]));
    }
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance * 252);
}

function maxDrawdown(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const recentPrices = prices.slice(-period);
  let peak = recentPrices[0];
  let maxDD = 0;
  for (const p of recentPrices) {
    if (p > peak) peak = p;
    const dd = (p - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  return maxDD;
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk Overlay Berechnung
// ─────────────────────────────────────────────────────────────────────────────

export function computeRiskOverlay(
  prices: number[],
  regime: MarketRegime,
  lpplBubbleScore: number | null = null
): RiskOverlay {
  const warnings: string[] = [];
  let dampingFactor = 1.0; // 1.0 = kein Dämpfen, 0.0 = vollständig blockiert
  let blockEntry = false;

  const vol20 = realizedVol(prices, 20);
  const vol60 = realizedVol(prices, 60);
  const dd63 = maxDrawdown(prices, 63);

  // ── 1. LPPL Bubble Score ────────────────────────────────────────────────────
  if (lpplBubbleScore !== null) {
    if (lpplBubbleScore > 0.7) {
      dampingFactor *= 0.3;
      blockEntry = true;
      warnings.push(`⚠ LPPLS BubbleScore ${lpplBubbleScore.toFixed(2)} > 0.7: Hohes Blasenrisiko — Entry blockiert`);
    } else if (lpplBubbleScore > 0.5) {
      dampingFactor *= 0.6;
      warnings.push(`⚠ LPPLS BubbleScore ${lpplBubbleScore.toFixed(2)} > 0.5: Erhöhtes Blasenrisiko — Signal gedämpft`);
    } else if (lpplBubbleScore < -0.5) {
      dampingFactor *= 0.5;
      blockEntry = true;
      warnings.push(`⚠ LPPLS BubbleScore ${lpplBubbleScore.toFixed(2)} < -0.5: Blasenplatzen-Risiko — Entry blockiert`);
    } else if (lpplBubbleScore < -0.3) {
      dampingFactor *= 0.7;
      warnings.push(`⚠ LPPLS BubbleScore ${lpplBubbleScore.toFixed(2)} < -0.3: Erhöhtes Abwärtsrisiko`);
    }
  }

  // ── 2. Realisierte Volatilität ──────────────────────────────────────────────
  if (vol20 !== null) {
    if (vol20 > 0.50) {
      dampingFactor *= 0.4;
      blockEntry = true;
      warnings.push(`⚠ Volatilität ${(vol20 * 100).toFixed(0)}% > 50% (extrem) — Entry blockiert`);
    } else if (vol20 > 0.35) {
      dampingFactor *= 0.6;
      warnings.push(`⚠ Volatilität ${(vol20 * 100).toFixed(0)}% > 35% (sehr hoch) — Signal gedämpft`);
    } else if (vol20 > 0.25) {
      dampingFactor *= 0.8;
      warnings.push(`~ Volatilität ${(vol20 * 100).toFixed(0)}% > 25% (erhöht)`);
    }
  }

  // ── 3. Drawdown ─────────────────────────────────────────────────────────────
  if (dd63 !== null) {
    if (dd63 < -0.25) {
      dampingFactor *= 0.5;
      warnings.push(`⚠ Drawdown ${(dd63 * 100).toFixed(1)}% < -25% (starker Rückgang) — Signal gedämpft`);
    } else if (dd63 < -0.15) {
      dampingFactor *= 0.75;
      warnings.push(`~ Drawdown ${(dd63 * 100).toFixed(1)}% < -15% (moderater Rückgang)`);
    }
  }

  // ── 4. Regime-spezifische Anpassungen ──────────────────────────────────────
  if (regime === "crisis") {
    dampingFactor *= 0.4;
    blockEntry = true;
    warnings.push("⚠ Krisenregime — alle Entry-Signale blockiert");
  } else if (regime === "sideways_high_vol") {
    dampingFactor *= 0.7;
    warnings.push("~ Seitwärts mit hoher Volatilität — Signal gedämpft");
  }

  // Volatilitäts-Normalisierung für Stop-Loss-Anpassung
  const volAdjustment = vol20 !== null ? Math.min(2.0, vol20 / 0.15) : 1.0;

  return {
    dampingFactor: Math.max(0, Math.min(1, dampingFactor)),
    blockEntry,
    volAdjustment,
    lpplBubbleScore: lpplBubbleScore ?? undefined,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal mit Risk Overlay anwenden
// ─────────────────────────────────────────────────────────────────────────────

export function applyRiskOverlay(
  signal: SignalOutput,
  overlay: RiskOverlay
): SignalOutput {
  const dampedConfidence = signal.confidence * overlay.dampingFactor;
  const dampedEntry = signal.entry && !overlay.blockEntry && dampedConfidence > 0.4;

  // Stop-Loss bei hoher Volatilität erweitern
  const adjustedStopLoss = signal.stopLossPct !== null
    ? signal.stopLossPct * overlay.volAdjustment
    : null;
  const adjustedTakeProfit = signal.takeProfitPct !== null
    ? signal.takeProfitPct * overlay.volAdjustment
    : null;

  return {
    ...signal,
    confidence: dampedConfidence,
    entry: dampedEntry,
    stopLossPct: adjustedStopLoss,
    takeProfitPct: adjustedTakeProfit,
    rationale: [
      ...signal.rationale,
      "",
      "── Risk Overlay ──",
      `Dämpfungsfaktor: ${(overlay.dampingFactor * 100).toFixed(0)}%`,
      ...overlay.warnings,
    ],
  };
}
