/**
 * riskOverlayEngine — Phase 3: Historisch validierte Schwellenwerte
 * ─────────────────────────────────────────────────────────────────────────────
 * Verwendet kalibrierte Schwellenwerte aus riskThresholdCalibrator.ts
 * statt hartcodierter Werte.
 *
 * Verbesserungen gegenüber Phase 1/2:
 * - Schwellenwerte per Walk-Forward-Backtest kalibriert (IS=252T, OOS=63T)
 * - Regime-spezifische Multiplikatoren aus historischer Validierung
 * - On-the-fly Kalibrierung wenn Cache leer (≥252 Preispunkte nötig)
 * - Transparente Ausgabe: zeigt ob Default oder kalibrierte Schwellenwerte
 */

import type { MarketRegime, RiskOverlay, SignalOutput } from "./types";
import {
  CalibratedThresholds,
  DEFAULT_DD_THRESHOLDS,
  DEFAULT_VOL_THRESHOLDS,
  DEFAULT_REGIME_MULTIPLIERS,
  calibrateRiskThresholds,
  getCachedThresholds,
  setCachedThresholds,
} from './riskThresholdCalibrator';

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

// Re-Exports für Abwärtskompatibilität und Admin-Nutzung
export type { CalibratedThresholds } from './riskThresholdCalibrator';
export {
  calibrateRiskThresholds,
  getCachedThresholds,
  setCachedThresholds,
  getCacheStats,
  clearThresholdCache,
  DEFAULT_VOL_THRESHOLDS,
  DEFAULT_DD_THRESHOLDS,
  DEFAULT_REGIME_MULTIPLIERS,
} from './riskThresholdCalibrator';

// ─────────────────────────────────────────────────────────────────────────────
// Risk Overlay Berechnung
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Berechnet den Risk Overlay mit historisch validierten Schwellenwerten.
 *
 * @param prices          Historische Schlusskurse (älteste zuerst)
 * @param regime          Aktuelles Marktregime
 * @param lpplBubbleScore LPPLS-Blasenscore (optional)
 * @param ticker          Ticker für Cache-Lookup (optional)
 * @param calibrated      Vorberechnete kalibrierte Schwellenwerte (optional)
 */
export function computeRiskOverlay(
  prices: number[],
  regime: MarketRegime,
  lpplBubbleScore: number | null = null,
  ticker?: string,
  calibrated?: CalibratedThresholds
): RiskOverlay {
  const warnings: string[] = [];
  let dampingFactor = 1.0;
  let blockEntry = false;

  // ── Schwellenwerte laden (kalibriert > Cache > Default) ───────────────────
  let thresholds: CalibratedThresholds | null = calibrated ?? null;
  if (!thresholds && ticker) thresholds = getCachedThresholds(ticker);
  // On-the-fly Kalibrierung wenn genug Daten vorhanden
  if (!thresholds && prices.length >= 252) {
    thresholds = calibrateRiskThresholds(ticker ?? 'unknown', prices);
    if (ticker) setCachedThresholds(ticker, thresholds);
  }

  const volT = thresholds?.vol ?? DEFAULT_VOL_THRESHOLDS;
  const ddT = thresholds?.drawdown ?? DEFAULT_DD_THRESHOLDS;
  const regimeMult = thresholds?.regimeMultipliers ?? DEFAULT_REGIME_MULTIPLIERS;
  const isCalibrated = thresholds !== null && thresholds.meta.numFolds > 0;
  const calibLabel = isCalibrated
    ? `kalibriert/${thresholds!.meta.confidence}`
    : 'Standard';

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

  // ── 2. Realisierte Volatilität (kalibrierte Schwellenwerte) ─────────────────
  if (vol20 !== null) {
    if (vol20 > volT.blockLevel) {
      dampingFactor *= volT.dampFactor3;
      blockEntry = true;
      warnings.push(`⚠ Vol ${(vol20 * 100).toFixed(0)}% > ${(volT.blockLevel * 100).toFixed(0)}% (extrem, ${calibLabel}) — Entry blockiert`);
    } else if (vol20 > volT.dampLevel2) {
      dampingFactor *= volT.dampFactor2;
      warnings.push(`⚠ Vol ${(vol20 * 100).toFixed(0)}% > ${(volT.dampLevel2 * 100).toFixed(0)}% (sehr hoch, ${calibLabel}) — Signal gedämpft`);
    } else if (vol20 > volT.dampLevel1) {
      dampingFactor *= volT.dampFactor1;
      warnings.push(`~ Vol ${(vol20 * 100).toFixed(0)}% > ${(volT.dampLevel1 * 100).toFixed(0)}% (erhöht, ${calibLabel})`);
    }
  }

  // ── 3. Drawdown (kalibrierte Schwellenwerte) ──────────────────────────────
  if (dd63 !== null) {
    if (dd63 < ddT.dampLevel2) {
      dampingFactor *= ddT.dampFactor2;
      warnings.push(`⚠ Drawdown ${(dd63 * 100).toFixed(1)}% < ${(ddT.dampLevel2 * 100).toFixed(0)}% (stark, ${calibLabel}) — Signal gedämpft`);
    } else if (dd63 < ddT.dampLevel1) {
      dampingFactor *= ddT.dampFactor1;
      warnings.push(`~ Drawdown ${(dd63 * 100).toFixed(1)}% < ${(ddT.dampLevel1 * 100).toFixed(0)}% (moderat, ${calibLabel})`);
    }
  }

  // ── 4. Regime-spezifische Anpassungen (kalibriert) ───────────────────────
  const regMultiplier = regimeMult[regime] ?? 1.0;
  if (regime === "crisis") {
    dampingFactor *= regMultiplier;
    blockEntry = true;
    warnings.push(`⚠ Krisenregime (Mult. ${regMultiplier.toFixed(2)}) — alle Entry-Signale blockiert`);
  } else if (regime === "sideways_high_vol") {
    dampingFactor *= regMultiplier;
    warnings.push(`~ Seitwärts/hohe Vol (Mult. ${regMultiplier.toFixed(2)}) — Signal gedämpft`);
  } else if (regime === "bear_trend" && regMultiplier < 1.0) {
    dampingFactor *= regMultiplier;
    warnings.push(`~ Bärenmarkt (Mult. ${regMultiplier.toFixed(2)}) — Signal gedämpft`);
  } else if (regime === "bull_trend" && regMultiplier > 1.0) {
    dampingFactor = Math.min(1.0, dampingFactor * regMultiplier);
  }

  // Volatilitäts-Normalisierung für Stop-Loss-Anpassung
  const volAdjustment = vol20 !== null ? Math.min(2.0, vol20 / 0.15) : 1.0;

  const result: RiskOverlay & { calibrationMeta?: any } = {
    dampingFactor: Math.max(0, Math.min(1, dampingFactor)),
    blockEntry,
    volAdjustment,
    lpplBubbleScore: lpplBubbleScore ?? undefined,
    warnings,
  };

  // Kalibrierungs-Metadaten für Transparenz-Trail anhängen
  if (isCalibrated && thresholds) {
    result.calibrationMeta = {
      numFolds: thresholds.meta.numFolds,
      confidence: thresholds.meta.confidence,
      avgOosImprovement: thresholds.meta.avgOosImprovement,
      volDampLevel2: volT.dampLevel2,
      ddDampLevel1: ddT.dampLevel1,
      calibratedAt: thresholds.meta.calibratedAt,
    };
  }

  return result;
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

  const calibMeta = (overlay as any).calibrationMeta;
  const calibLine = calibMeta
    ? `Kalibrierung: ${calibMeta.numFolds} Folds, ${calibMeta.confidence} Konfidenz, OOS-ΔSharpe ${calibMeta.avgOosImprovement.toFixed(2)}`
    : 'Kalibrierung: Standard-Schwellenwerte';

  return {
    ...signal,
    confidence: dampedConfidence,
    entry: dampedEntry,
    stopLossPct: adjustedStopLoss,
    takeProfitPct: adjustedTakeProfit,
    rationale: [
      ...signal.rationale,
      "",
      "── Risk Overlay (Phase 3) ──",
      `Dämpfungsfaktor: ${(overlay.dampingFactor * 100).toFixed(0)}%`,
      calibLine,
      ...overlay.warnings,
    ],
  };
}
