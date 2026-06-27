/**
 * meanReversionSignalEngine — Vollständige Mean-Reversion Signal Engine (Phase 2)
 *
 * Bevorzugt in: sideways_low_vol, sideways_high_vol
 * Logik: Mehrere Oszillatoren und statistische Rückkehr-zur-Mitte-Signale.
 *
 * Indikatoren:
 *   1. RSI(14) — Klassischer Überverkauft/Überkauft-Indikator (Gewicht: 0.25)
 *   2. Stochastik(%K, %D) — Momentum-Oszillator (Gewicht: 0.20)
 *   3. Bollinger Bands (20, 2σ) — Statistische Bandbreite (Gewicht: 0.20)
 *   4. Z-Score (Preis vs. SMA20) — Statistische Abweichung (Gewicht: 0.20)
 *   5. CCI (Commodity Channel Index, 20) — Zyklusindikator (Gewicht: 0.15)
 *
 * Alle Indikatoren werden normiert auf [-1, 1]:
 *   +1 = stark überverkauft (Kaufsignal)
 *   -1 = stark überkauft (Verkaufssignal)
 *    0 = neutral
 */

import type { MarketRegime, SignalOutput } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Interne Hilfsfunktionen
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
    const m = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - m) ** 2, 0) / period;
    result.push(Math.sqrt(variance));
  }
  return result;
}

/** RSI (Wilder-Smoothing) */
function calcRsi(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;
  // Wilder-Smoothing für den Rest
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Stochastik %K und %D */
function calcStochastic(
  prices: number[],
  kPeriod = 14,
  dPeriod = 3
): { k: number | null; d: number | null } {
  if (prices.length < kPeriod + dPeriod) return { k: null, d: null };
  const kValues: number[] = [];
  for (let i = kPeriod - 1; i < prices.length; i++) {
    const slice = prices.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...slice);
    const low = Math.min(...slice);
    const range = high - low;
    kValues.push(range === 0 ? 50 : ((prices[i] - low) / range) * 100);
  }
  const lastK = kValues[kValues.length - 1];
  const dSlice = kValues.slice(-dPeriod);
  const lastD = dSlice.reduce((a, b) => a + b, 0) / dSlice.length;
  return { k: lastK, d: lastD };
}

/** Bollinger Band Position [0, 1] — 0 = unteres Band, 1 = oberes Band */
function calcBollingerPosition(
  prices: number[],
  period = 20,
  mult = 2.0
): { position: number | null; bandwidth: number | null } {
  const bbSma = sma(prices, period);
  const bbStd = stdDev(prices, period);
  const lastSma = bbSma[bbSma.length - 1];
  const lastStd = bbStd[bbStd.length - 1];
  if (isNaN(lastSma) || isNaN(lastStd) || lastStd === 0) return { position: null, bandwidth: null };
  const upper = lastSma + mult * lastStd;
  const lower = lastSma - mult * lastStd;
  const currentPrice = prices[prices.length - 1];
  const position = (currentPrice - lower) / (upper - lower);
  const bandwidth = (upper - lower) / lastSma; // Normierte Bandbreite
  return { position: Math.max(0, Math.min(1, position)), bandwidth };
}

/** Z-Score des Preises vs. SMA(period) */
function calcZScore(prices: number[], period = 20): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const m = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - m) ** 2, 0) / period;
  const s = Math.sqrt(variance);
  if (s === 0) return 0;
  return (prices[prices.length - 1] - m) / s;
}

/** CCI (Commodity Channel Index) */
function calcCci(prices: number[], period = 20): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const typicalPrices = slice; // Vereinfacht: nur Close (kein High/Low verfügbar)
  const m = typicalPrices.reduce((a, b) => a + b, 0) / period;
  const meanDev = typicalPrices.reduce((a, b) => a + Math.abs(b - m), 0) / period;
  if (meanDev === 0) return 0;
  return (prices[prices.length - 1] - m) / (0.015 * meanDev);
}

// ─────────────────────────────────────────────────────────────────────────────
// Normierungsfunktionen: Indikator → [-1, 1] (invertiert: überverkauft = +1)
// ─────────────────────────────────────────────────────────────────────────────

/** RSI → [-1, 1]: RSI < 30 → +1 (kaufen), RSI > 70 → -1 (verkaufen) */
function normalizeRsi(rsiVal: number): number {
  if (rsiVal <= 20) return 1.0;
  if (rsiVal <= 30) return 0.5 + (30 - rsiVal) / 20;   // [0.5, 1.0]
  if (rsiVal <= 45) return (45 - rsiVal) / 30;           // [0, 0.5]
  if (rsiVal <= 55) return 0;                             // neutral
  if (rsiVal <= 70) return -(rsiVal - 55) / 30;          // [-0.5, 0]
  if (rsiVal <= 80) return -0.5 - (rsiVal - 70) / 20;   // [-1.0, -0.5]
  return -1.0;
}

/** Stochastik → [-1, 1]: %K < 20 → +1, %K > 80 → -1 */
function normalizeStochastic(k: number, d: number): number {
  const avg = (k + d) / 2;
  if (avg <= 10) return 1.0;
  if (avg <= 20) return 0.5 + (20 - avg) / 20;
  if (avg <= 40) return (40 - avg) / 40;
  if (avg <= 60) return 0;
  if (avg <= 80) return -(avg - 60) / 40;
  if (avg <= 90) return -0.5 - (avg - 80) / 20;
  return -1.0;
}

/** Bollinger Position → [-1, 1]: Position < 0.05 → +1, Position > 0.95 → -1 */
function normalizeBollinger(position: number): number {
  if (position <= 0.0) return 1.0;
  if (position <= 0.1) return 1.0 - position * 5;       // [0.5, 1.0]
  if (position <= 0.3) return 0.5 - (position - 0.1) * 2.5; // [0, 0.5]
  if (position <= 0.7) return 0;                          // neutral
  if (position <= 0.9) return -(position - 0.7) * 2.5;  // [-0.5, 0]
  if (position <= 1.0) return -0.5 - (position - 0.9) * 5; // [-1.0, -0.5]
  return -1.0;
}

/** Z-Score → [-1, 1]: Z < -2 → +1, Z > +2 → -1 */
function normalizeZScore(z: number): number {
  return Math.max(-1, Math.min(1, -z / 2));
}

/** CCI → [-1, 1]: CCI < -100 → +1, CCI > +100 → -1 */
function normalizeCci(cci: number): number {
  return Math.max(-1, Math.min(1, -cci / 100));
}

// ─────────────────────────────────────────────────────────────────────────────
// Öffentliche API
// ─────────────────────────────────────────────────────────────────────────────

export function computeMeanReversionSignal(
  prices: number[],
  regime: MarketRegime
): SignalOutput {
  const rationale: string[] = [];

  if (prices.length < 30) {
    return {
      engine: "mean_reversion",
      direction: 0,
      rawScore: 0,
      confidence: 0,
      entry: false,
      exit: false,
      stopLossPct: null,
      takeProfitPct: null,
      trailingStopPct: null,
      holdingPeriodHint: null,
      rationale: ["Zu wenige Datenpunkte für Mean-Reversion-Analyse (min. 30 benötigt)"],
    };
  }

  const currentPrice = prices[prices.length - 1];
  let score = 0;
  let totalWeight = 0;
  let bullishCount = 0;
  let bearishCount = 0;

  // ── 1. RSI(14) — Gewicht: 0.25 ────────────────────────────────────────────
  const rsiVal = calcRsi(prices, 14);
  if (rsiVal !== null) {
    const w = 0.25;
    totalWeight += w;
    const norm = normalizeRsi(rsiVal);
    score += w * norm;
    if (norm > 0.3) { bullishCount++; rationale.push(`✓ RSI ${rsiVal.toFixed(1)} < 40 (überverkauft → Mean-Reversion-Kaufsignal)`); }
    else if (norm < -0.3) { bearishCount++; rationale.push(`✗ RSI ${rsiVal.toFixed(1)} > 60 (überkauft → Mean-Reversion-Verkaufssignal)`); }
    else rationale.push(`~ RSI ${rsiVal.toFixed(1)} (neutral, kein Mean-Reversion-Signal)`);
  }

  // ── 2. Stochastik(%K, %D) — Gewicht: 0.20 ─────────────────────────────────
  const { k: stochK, d: stochD } = calcStochastic(prices, 14, 3);
  if (stochK !== null && stochD !== null) {
    const w = 0.20;
    totalWeight += w;
    const norm = normalizeStochastic(stochK, stochD);
    score += w * norm;
    if (norm > 0.3) { bullishCount++; rationale.push(`✓ Stochastik %K=${stochK.toFixed(0)} %D=${stochD.toFixed(0)} (überverkauft)`); }
    else if (norm < -0.3) { bearishCount++; rationale.push(`✗ Stochastik %K=${stochK.toFixed(0)} %D=${stochD.toFixed(0)} (überkauft)`); }
    else rationale.push(`~ Stochastik %K=${stochK.toFixed(0)} (neutral)`);
  }

  // ── 3. Bollinger Bands — Gewicht: 0.20 ────────────────────────────────────
  const { position: bbPos, bandwidth } = calcBollingerPosition(prices, 20, 2.0);
  if (bbPos !== null) {
    const w = 0.20;
    totalWeight += w;
    const norm = normalizeBollinger(bbPos);
    score += w * norm;
    const pct = (bbPos * 100).toFixed(0);
    if (norm > 0.3) { bullishCount++; rationale.push(`✓ Preis am unteren Bollinger Band (${pct}%) → Rückkehr zur Mitte erwartet`); }
    else if (norm < -0.3) { bearishCount++; rationale.push(`✗ Preis am oberen Bollinger Band (${pct}%) → Rückkehr zur Mitte erwartet`); }
    else rationale.push(`~ Bollinger-Position ${pct}% (neutral)`);
    if (bandwidth !== null && bandwidth < 0.05) rationale.push(`⚠ Bollinger-Bandbreite sehr eng (${(bandwidth * 100).toFixed(1)}%) — Ausbruch möglich`);
  }

  // ── 4. Z-Score (Preis vs. SMA20) — Gewicht: 0.20 ─────────────────────────
  const zScore = calcZScore(prices, 20);
  if (zScore !== null) {
    const w = 0.20;
    totalWeight += w;
    const norm = normalizeZScore(zScore);
    score += w * norm;
    if (norm > 0.3) { bullishCount++; rationale.push(`✓ Z-Score ${zScore.toFixed(2)} (Preis ${Math.abs(zScore).toFixed(1)}σ unter SMA20 → Rückkehr erwartet)`); }
    else if (norm < -0.3) { bearishCount++; rationale.push(`✗ Z-Score ${zScore.toFixed(2)} (Preis ${Math.abs(zScore).toFixed(1)}σ über SMA20 → Rückkehr erwartet)`); }
    else rationale.push(`~ Z-Score ${zScore.toFixed(2)} (nahe SMA20, neutral)`);
  }

  // ── 5. CCI(20) — Gewicht: 0.15 ────────────────────────────────────────────
  const cciVal = calcCci(prices, 20);
  if (cciVal !== null) {
    const w = 0.15;
    totalWeight += w;
    const norm = normalizeCci(cciVal);
    score += w * norm;
    if (norm > 0.3) { bullishCount++; rationale.push(`✓ CCI ${cciVal.toFixed(0)} < -100 (überverkauft)`); }
    else if (norm < -0.3) { bearishCount++; rationale.push(`✗ CCI ${cciVal.toFixed(0)} > +100 (überkauft)`); }
    else rationale.push(`~ CCI ${cciVal.toFixed(0)} (neutral)`);
  }

  // ── Normierung & Konfidenz ─────────────────────────────────────────────────
  const rawScore = totalWeight > 0 ? Math.max(-1, Math.min(1, score / totalWeight)) : 0;

  // Übereinstimmung der Indikatoren erhöht Konfidenz
  const totalSignals = bullishCount + bearishCount;
  const dominance = totalSignals > 0 ? Math.max(bullishCount, bearishCount) / totalSignals : 0;
  const baseConfidence = Math.abs(rawScore);
  const confidence = Math.min(1, baseConfidence * 0.6 + dominance * 0.4);

  const direction: -1 | 0 | 1 = rawScore > 0.15 ? 1 : rawScore < -0.15 ? -1 : 0;

  // Entry: nur in Seitwärtsmärkten stark, in Trend-Regimes gedämpft
  const regimeMultiplier = (regime === "sideways_low_vol" || regime === "sideways_high_vol") ? 1.0
    : (regime === "recovery") ? 0.8
    : 0.5; // In Trend-Regimes ist Mean-Reversion weniger zuverlässig

  const entry = direction !== 0 && confidence * regimeMultiplier > 0.45;
  const exit = direction === 0 && confidence > 0.55;

  // Stop-Loss / Take-Profit: enger als Trend-Engine (Mean-Reversion = kürzere Haltedauer)
  const recentPrices = prices.slice(-14);
  const avgMove = recentPrices.reduce((sum, p, i) =>
    i === 0 ? 0 : sum + Math.abs(p - recentPrices[i - 1]), 0
  ) / Math.max(recentPrices.length - 1, 1);
  const atrPct = currentPrice > 0 ? avgMove / currentPrice : 0.015;

  const stopLossPct = direction === 1 ? -(atrPct * 1.5 * 100) : direction === -1 ? atrPct * 1.5 * 100 : null;
  const takeProfitPct = direction === 1 ? atrPct * 2.5 * 100 : direction === -1 ? -(atrPct * 2.5 * 100) : null;
  const trailingStopPct = direction !== 0 ? atrPct * 1.2 * 100 : null;

  // Mean-Reversion: kürzere Haltedauer als Trend
  const holdingPeriodHint = direction !== 0 ? 7 : null;

  // Regime-Warnung
  if (regime === "bull_trend" || regime === "bear_trend") {
    rationale.push("⚠ Mean-Reversion-Engine in Trend-Regime — Signal weniger zuverlässig (Trend dominiert)");
  }
  if (regime === "crisis") {
    rationale.push("⚠ Krisenregime: Mean-Reversion kann sich verzögern (Momentum-Effekte dominieren)");
  }

  rationale.unshift(`Mean-Reversion: ${bullishCount} bullische / ${bearishCount} bärische Indikatoren`);

  return {
    engine: "mean_reversion",
    direction,
    rawScore,
    confidence,
    entry,
    exit,
    stopLossPct,
    takeProfitPct,
    trailingStopPct,
    holdingPeriodHint,
    rationale,
  };
}
