/**
 * trendSignalEngine — MA-Alignment, ADX, Slope-basiertes Trend-Signal
 *
 * Bevorzugt in: bull_trend, bear_trend
 * Logik: Mehrere Trend-Indikatoren werden gewichtet kombiniert.
 *
 * Indikatoren:
 *   1. MA-Alignment (SMA20 > SMA50 > SMA200 = vollständig bullisch)
 *   2. ADX-Stärke (> 25 = starker Trend)
 *   3. SMA50-Steigung (Richtung und Stärke)
 *   4. Golden/Death Cross (SMA50 vs SMA200)
 *   5. Preis vs. SMA200 (langfristiger Trend)
 */

import type { MarketRegime, SignalOutput } from "./types";

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

function smaSlope(smaValues: number[], lookback = 10): number | null {
  const valid = smaValues.filter(v => !isNaN(v));
  if (valid.length < lookback + 1) return null;
  const recent = valid.slice(-lookback);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (first === 0) return null;
  return (last - first) / first;
}

function adx(prices: number[], period = 14): number | null {
  if (prices.length < period * 2 + 1) return null;
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const upMove = prices[i] - prices[i - 1];
    const downMove = prices[i - 1] - prices[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(Math.abs(prices[i] - prices[i - 1]));
  }
  function wilderSmooth(arr: number[], p: number): number[] {
    const r: number[] = [arr.slice(0, p).reduce((a, b) => a + b, 0)];
    for (let i = p; i < arr.length; i++) r.push(r[r.length - 1] - r[r.length - 1] / p + arr[i]);
    return r;
  }
  const sTR = wilderSmooth(tr, period);
  const sPDM = wilderSmooth(plusDM, period);
  const sMDM = wilderSmooth(minusDM, period);
  const dx: number[] = [];
  for (let i = 0; i < sTR.length; i++) {
    if (sTR[i] === 0) continue;
    const pDI = (sPDM[i] / sTR[i]) * 100;
    const mDI = (sMDM[i] / sTR[i]) * 100;
    const diff = Math.abs(pDI - mDI);
    const sum = pDI + mDI;
    dx.push(sum > 0 ? (diff / sum) * 100 : 0);
  }
  if (dx.length < period) return null;
  return dx.slice(-period).reduce((a, b) => a + b, 0) / period;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trend Signal Engine
// ─────────────────────────────────────────────────────────────────────────────

export function computeTrendSignal(
  prices: number[],
  regime: MarketRegime
): SignalOutput {
  const rationale: string[] = [];

  if (prices.length < 50) {
    return {
      engine: "trend",
      direction: 0,
      rawScore: 0,
      confidence: 0,
      entry: false,
      exit: false,
      stopLossPct: null,
      takeProfitPct: null,
      trailingStopPct: null,
      holdingPeriodHint: null,
      rationale: ["Zu wenige Datenpunkte für Trend-Analyse (min. 50 benötigt)"],
    };
  }

  const currentPrice = prices[prices.length - 1];
  const sma20 = sma(prices, 20);
  const sma50 = sma(prices, 50);
  const sma200 = sma(prices, 200);

  const lastSma20 = sma20[sma20.length - 1];
  const lastSma50 = sma50[sma50.length - 1];
  const lastSma200 = sma200[sma200.length - 1];
  const prevSma50 = sma50[sma50.length - 2];
  const prevSma200 = sma200[sma200.length - 2];

  const slope50 = smaSlope(sma50);
  const adxVal = adx(prices);

  let score = 0;
  let totalWeight = 0;

  // ── 1. MA-Alignment (Gewicht: 0.30) ────────────────────────────────────────
  const w1 = 0.30;
  totalWeight += w1;
  if (!isNaN(lastSma20) && !isNaN(lastSma50) && !isNaN(lastSma200)) {
    if (currentPrice > lastSma20 && lastSma20 > lastSma50 && lastSma50 > lastSma200) {
      score += w1 * 1.0;
      rationale.push("✓ Vollständige bullische MA-Ausrichtung: Preis > SMA20 > SMA50 > SMA200");
    } else if (currentPrice < lastSma20 && lastSma20 < lastSma50 && lastSma50 < lastSma200) {
      score += w1 * -1.0;
      rationale.push("✗ Vollständige bärische MA-Ausrichtung: Preis < SMA20 < SMA50 < SMA200");
    } else if (currentPrice > lastSma50 && lastSma50 > lastSma200) {
      score += w1 * 0.6;
      rationale.push("✓ Teilweise bullisch: Preis > SMA50 > SMA200");
    } else if (currentPrice < lastSma50 && lastSma50 < lastSma200) {
      score += w1 * -0.6;
      rationale.push("✗ Teilweise bärisch: Preis < SMA50 < SMA200");
    } else {
      rationale.push("~ MA-Ausrichtung gemischt (neutral)");
    }
  } else if (!isNaN(lastSma50)) {
    if (currentPrice > lastSma50) {
      score += w1 * 0.4;
      rationale.push("✓ Preis über SMA50");
    } else {
      score += w1 * -0.4;
      rationale.push("✗ Preis unter SMA50");
    }
  }

  // ── 2. ADX-Stärke (Gewicht: 0.20) ──────────────────────────────────────────
  const w2 = 0.20;
  totalWeight += w2;
  if (adxVal !== null) {
    if (adxVal > 30) {
      // Starker Trend — Score-Richtung kommt vom MA-Alignment
      const direction = score > 0 ? 1 : -1;
      score += w2 * direction * Math.min(adxVal / 50, 1.0);
      rationale.push(`✓ Starker Trend: ADX ${adxVal.toFixed(0)} > 30`);
    } else if (adxVal > 20) {
      const direction = score > 0 ? 1 : -1;
      score += w2 * direction * 0.5;
      rationale.push(`~ Moderater Trend: ADX ${adxVal.toFixed(0)}`);
    } else {
      rationale.push(`✗ Schwacher Trend: ADX ${adxVal.toFixed(0)} < 20 (Trendfolge-Signal unzuverlässig)`);
    }
  }

  // ── 3. SMA50-Steigung (Gewicht: 0.20) ──────────────────────────────────────
  const w3 = 0.20;
  totalWeight += w3;
  if (slope50 !== null) {
    const normalizedSlope = Math.max(-1, Math.min(1, slope50 * 20)); // Normierung
    score += w3 * normalizedSlope;
    if (slope50 > 0.005) rationale.push(`✓ SMA50 steigt stark: ${(slope50 * 100).toFixed(2)}%`);
    else if (slope50 > 0) rationale.push(`✓ SMA50 steigt leicht: ${(slope50 * 100).toFixed(2)}%`);
    else if (slope50 < -0.005) rationale.push(`✗ SMA50 fällt stark: ${(slope50 * 100).toFixed(2)}%`);
    else rationale.push(`✗ SMA50 fällt leicht: ${(slope50 * 100).toFixed(2)}%`);
  }

  // ── 4. Golden/Death Cross (Gewicht: 0.15) ──────────────────────────────────
  const w4 = 0.15;
  totalWeight += w4;
  if (!isNaN(lastSma50) && !isNaN(lastSma200) && !isNaN(prevSma50) && !isNaN(prevSma200)) {
    const goldenCross = prevSma50 <= prevSma200 && lastSma50 > lastSma200;
    const deathCross = prevSma50 >= prevSma200 && lastSma50 < lastSma200;
    if (goldenCross) {
      score += w4 * 1.0;
      rationale.push("✓ Golden Cross: SMA50 kreuzt SMA200 von unten (starkes Kaufsignal)");
    } else if (deathCross) {
      score += w4 * -1.0;
      rationale.push("✗ Death Cross: SMA50 kreuzt SMA200 von oben (starkes Verkaufssignal)");
    } else if (lastSma50 > lastSma200) {
      score += w4 * 0.3;
      rationale.push("✓ SMA50 > SMA200 (bullisch)");
    } else {
      score += w4 * -0.3;
      rationale.push("✗ SMA50 < SMA200 (bärisch)");
    }
  }

  // ── 5. Preis vs. SMA200 (Gewicht: 0.15) ────────────────────────────────────
  const w5 = 0.15;
  totalWeight += w5;
  if (!isNaN(lastSma200) && lastSma200 > 0) {
    const pVs200 = (currentPrice - lastSma200) / lastSma200;
    const normalizedPVs200 = Math.max(-1, Math.min(1, pVs200 * 5));
    score += w5 * normalizedPVs200;
    if (pVs200 > 0.05) rationale.push(`✓ Preis ${(pVs200 * 100).toFixed(1)}% über SMA200`);
    else if (pVs200 > 0) rationale.push(`✓ Preis leicht über SMA200`);
    else if (pVs200 < -0.05) rationale.push(`✗ Preis ${(pVs200 * 100).toFixed(1)}% unter SMA200`);
    else rationale.push(`✗ Preis leicht unter SMA200`);
  }

  // ── Normierung ──────────────────────────────────────────────────────────────
  const rawScore = totalWeight > 0 ? score / totalWeight : 0;
  const clampedScore = Math.max(-1, Math.min(1, rawScore));

  // Richtung
  const direction: -1 | 0 | 1 = clampedScore > 0.15 ? 1 : clampedScore < -0.15 ? -1 : 0;

  // Konfidenz: höher wenn ADX stark und Score eindeutig
  const adxBoost = adxVal !== null ? Math.min(adxVal / 50, 1.0) : 0.5;
  const scoreStrength = Math.abs(clampedScore);
  const confidence = Math.min(1, scoreStrength * 0.7 + adxBoost * 0.3);

  // Entry/Exit-Signale
  const entry = direction !== 0 && confidence > 0.5;
  const exit = direction === 0 && confidence > 0.6;

  // Stop-Loss / Take-Profit (ATR-basiert, vereinfacht)
  const recentPrices = prices.slice(-20);
  const avgMove = recentPrices.reduce((sum, p, i) =>
    i === 0 ? 0 : sum + Math.abs(p - recentPrices[i - 1]), 0
  ) / Math.max(recentPrices.length - 1, 1);
  const atrPct = currentPrice > 0 ? avgMove / currentPrice : 0.02;

  const stopLossPct = direction === 1 ? -(atrPct * 2 * 100) : direction === -1 ? atrPct * 2 * 100 : null;
  const takeProfitPct = direction === 1 ? atrPct * 4 * 100 : direction === -1 ? -(atrPct * 4 * 100) : null;
  const trailingStopPct = direction !== 0 ? atrPct * 1.5 * 100 : null;

  // Haltedauer-Hint: Trend-Signale haben längere Haltedauer
  const holdingPeriodHint = direction !== 0 ? (adxVal !== null && adxVal > 25 ? 30 : 15) : null;

  // Regime-Warnung
  if (regime === "sideways_low_vol" || regime === "sideways_high_vol") {
    rationale.push("⚠ Trend-Engine in Seitwärtsmarkt — Signal weniger zuverlässig");
  }

  return {
    engine: "trend",
    direction,
    rawScore: clampedScore,
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
