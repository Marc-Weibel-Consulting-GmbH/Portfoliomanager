/**
 * breakoutSignalEngine — Vollständige Breakout Signal Engine (Phase 2)
 *
 * Bevorzugt in: bull_trend (Aufwärts-Breakout), bear_trend (Abwärts-Breakout)
 * Logik: Identifiziert statistisch signifikante Ausbrüche aus Konsolidierungsphasen.
 *
 * Indikatoren:
 *   1. Donchian Channel Breakout (20 Tage) — Klassischer Kanal-Ausbruch (Gewicht: 0.30)
 *   2. ATR-basierter Ausbruch (Preis vs. SMA + n×ATR) — Volatilitäts-adjustiert (Gewicht: 0.25)
 *   3. Momentum-Beschleunigung (Rate of Change Differenz) — Dynamik-Messung (Gewicht: 0.20)
 *   4. Bollinger Band Squeeze + Expansion — Kompression vor Ausbruch (Gewicht: 0.15)
 *   5. Preis-Momentum (52-Wochen-Hoch/Tief Nähe) — Langfristige Stärke (Gewicht: 0.10)
 *
 * Alle Indikatoren werden normiert auf [-1, 1]:
 *   +1 = starker Aufwärts-Breakout (bullisch)
 *   -1 = starker Abwärts-Breakout (bärisch)
 *    0 = kein Breakout / Konsolidierung
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

/** ATR (Average True Range) — vereinfacht mit nur Close-Preisen */
function calcAtr(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  const trValues: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    trValues.push(Math.abs(prices[i] - prices[i - 1]));
  }
  const recent = trValues.slice(-period);
  return recent.reduce((a, b) => a + b, 0) / period;
}

/** Donchian Channel: Highest High und Lowest Low über n Perioden */
function calcDonchian(
  prices: number[],
  period = 20
): { upper: number | null; lower: number | null; position: number | null } {
  if (prices.length < period) return { upper: null, lower: null, position: null };
  // Verwende die letzten period+1 Preise (ohne aktuellen für Breakout-Erkennung)
  const lookback = prices.slice(-period - 1, -1);
  if (lookback.length < period) return { upper: null, lower: null, position: null };
  const upper = Math.max(...lookback);
  const lower = Math.min(...lookback);
  const current = prices[prices.length - 1];
  const range = upper - lower;
  const position = range > 0 ? (current - lower) / range : 0.5;
  return { upper, lower, position };
}

/** Rate of Change (RoC) über n Perioden */
function calcRoc(prices: number[], period: number): number | null {
  if (prices.length < period + 1) return null;
  const prev = prices[prices.length - 1 - period];
  if (prev === 0) return null;
  return (prices[prices.length - 1] - prev) / prev;
}

/** Bollinger Band Bandwidth: (Upper - Lower) / Middle */
function calcBollingerBandwidth(prices: number[], period = 20, mult = 2.0): number | null {
  const bbSma = sma(prices, period);
  const bbStd = stdDev(prices, period);
  const lastSma = bbSma[bbSma.length - 1];
  const lastStd = bbStd[bbStd.length - 1];
  if (isNaN(lastSma) || isNaN(lastStd) || lastSma === 0) return null;
  return (mult * 2 * lastStd) / lastSma;
}

/** Historische Bollinger Bandwidth (vor n Perioden) für Squeeze-Erkennung */
function calcHistoricalBandwidth(prices: number[], lookbackAgo = 5, period = 20, mult = 2.0): number | null {
  if (prices.length < period + lookbackAgo) return null;
  const historicalPrices = prices.slice(0, prices.length - lookbackAgo);
  return calcBollingerBandwidth(historicalPrices, period, mult);
}

// ─────────────────────────────────────────────────────────────────────────────
// Öffentliche API
// ─────────────────────────────────────────────────────────────────────────────

export function computeBreakoutSignal(
  prices: number[],
  regime: MarketRegime
): SignalOutput {
  const rationale: string[] = [];

  if (prices.length < 55) {
    return {
      engine: "breakout",
      direction: 0,
      rawScore: 0,
      confidence: 0,
      entry: false,
      exit: false,
      stopLossPct: null,
      takeProfitPct: null,
      trailingStopPct: null,
      holdingPeriodHint: null,
      rationale: ["Zu wenige Datenpunkte für Breakout-Analyse (min. 55 benötigt)"],
    };
  }

  const currentPrice = prices[prices.length - 1];
  let score = 0;
  let totalWeight = 0;
  let bullishCount = 0;
  let bearishCount = 0;

  // ── 1. Donchian Channel Breakout (20 Tage) — Gewicht: 0.30 ────────────────
  const { upper: donchUpper, lower: donchLower, position: donchPos } = calcDonchian(prices, 20);
  if (donchUpper !== null && donchLower !== null && donchPos !== null) {
    const w = 0.30;
    totalWeight += w;
    const range = donchUpper - donchLower;
    const breakoutThreshold = range > 0 ? 0.005 : 0; // 0.5% über/unter Kanal = Breakout

    if (currentPrice > donchUpper * (1 + breakoutThreshold)) {
      // Echter Aufwärts-Breakout
      const strength = Math.min(1, (currentPrice - donchUpper) / (range * 0.1 + 0.001));
      score += w * (0.7 + 0.3 * strength);
      bullishCount++;
      rationale.push(`✓ Donchian Aufwärts-Breakout: Preis ${currentPrice.toFixed(2)} > 20T-Hoch ${donchUpper.toFixed(2)}`);
    } else if (currentPrice < donchLower * (1 - breakoutThreshold)) {
      // Echter Abwärts-Breakout
      const strength = Math.min(1, (donchLower - currentPrice) / (range * 0.1 + 0.001));
      score += w * -(0.7 + 0.3 * strength);
      bearishCount++;
      rationale.push(`✗ Donchian Abwärts-Breakout: Preis ${currentPrice.toFixed(2)} < 20T-Tief ${donchLower.toFixed(2)}`);
    } else {
      // Innerhalb des Kanals — Position zeigt Tendenz
      const normalizedPos = (donchPos - 0.5) * 2; // [-1, 1]
      score += w * normalizedPos * 0.3; // Gedämpft: kein echter Breakout
      rationale.push(`~ Donchian-Kanal: Preis bei ${(donchPos * 100).toFixed(0)}% des 20T-Kanals (kein Breakout)`);
    }
  }

  // ── 2. ATR-basierter Ausbruch (Preis vs. SMA20 ± 2×ATR) — Gewicht: 0.25 ──
  const atr = calcAtr(prices, 14);
  const sma20 = sma(prices, 20);
  const lastSma20 = sma20[sma20.length - 1];
  if (atr !== null && !isNaN(lastSma20) && lastSma20 > 0) {
    const w = 0.25;
    totalWeight += w;
    const upperBand = lastSma20 + 2 * atr;
    const lowerBand = lastSma20 - 2 * atr;
    const atrPct = atr / lastSma20;

    if (currentPrice > upperBand) {
      const excess = (currentPrice - upperBand) / atr;
      const norm = Math.min(1, 0.5 + excess * 0.5);
      score += w * norm;
      bullishCount++;
      rationale.push(`✓ ATR-Breakout oben: Preis ${((currentPrice - lastSma20) / atr).toFixed(1)}×ATR über SMA20`);
    } else if (currentPrice < lowerBand) {
      const excess = (lowerBand - currentPrice) / atr;
      const norm = Math.min(1, 0.5 + excess * 0.5);
      score += w * -norm;
      bearishCount++;
      rationale.push(`✗ ATR-Breakout unten: Preis ${((lastSma20 - currentPrice) / atr).toFixed(1)}×ATR unter SMA20`);
    } else {
      const deviation = (currentPrice - lastSma20) / (2 * atr);
      score += w * deviation * 0.4;
      rationale.push(`~ ATR-Band: Preis ${((currentPrice - lastSma20) / atr).toFixed(2)}×ATR von SMA20 (kein Breakout)`);
    }
  }

  // ── 3. Momentum-Beschleunigung (RoC Differenz) — Gewicht: 0.20 ────────────
  const roc5 = calcRoc(prices, 5);
  const roc20 = calcRoc(prices, 20);
  const roc10 = calcRoc(prices, 10);
  if (roc5 !== null && roc20 !== null && roc10 !== null) {
    const w = 0.20;
    totalWeight += w;
    // Momentum-Beschleunigung: kurzfristiger RoC > langfristiger RoC = Beschleunigung
    const acceleration = roc5 - roc20 / 4; // Annualisierungskorrektur
    const normalizedAcc = Math.max(-1, Math.min(1, acceleration * 20));
    score += w * normalizedAcc;

    if (normalizedAcc > 0.3) {
      bullishCount++;
      rationale.push(`✓ Momentum-Beschleunigung: 5T-RoC ${(roc5 * 100).toFixed(1)}% > 20T-Trend (Aufwärts-Dynamik)`);
    } else if (normalizedAcc < -0.3) {
      bearishCount++;
      rationale.push(`✗ Momentum-Abbremsung: 5T-RoC ${(roc5 * 100).toFixed(1)}% < 20T-Trend (Abwärts-Dynamik)`);
    } else {
      rationale.push(`~ Momentum neutral: 5T-RoC ${(roc5 * 100).toFixed(1)}%, 20T-RoC ${(roc20 * 100).toFixed(1)}%`);
    }
  }

  // ── 4. Bollinger Band Squeeze + Expansion — Gewicht: 0.15 ─────────────────
  const currentBw = calcBollingerBandwidth(prices, 20, 2.0);
  const historicalBw = calcHistoricalBandwidth(prices, 10, 20, 2.0); // Bandbreite vor 10 Tagen
  if (currentBw !== null && historicalBw !== null && historicalBw > 0) {
    const w = 0.15;
    totalWeight += w;
    const bwExpansion = (currentBw - historicalBw) / historicalBw;

    if (bwExpansion > 0.20) {
      // Bandbreite expandiert stark → Ausbruch in Richtung des aktuellen Scores
      const direction = score > 0 ? 1 : score < 0 ? -1 : 0;
      const expansionStrength = Math.min(1, bwExpansion * 3);
      score += w * direction * expansionStrength;
      if (direction > 0) { bullishCount++; rationale.push(`✓ Bollinger Expansion +${(bwExpansion * 100).toFixed(0)}% → bestätigt Aufwärts-Breakout`); }
      else if (direction < 0) { bearishCount++; rationale.push(`✗ Bollinger Expansion +${(bwExpansion * 100).toFixed(0)}% → bestätigt Abwärts-Breakout`); }
      else rationale.push(`~ Bollinger Expansion +${(bwExpansion * 100).toFixed(0)}% (Richtung unklar)`);
    } else if (bwExpansion < -0.15) {
      // Squeeze: Konsolidierung, kein Breakout
      rationale.push(`⚠ Bollinger Squeeze ${(bwExpansion * 100).toFixed(0)}% → Konsolidierung, Breakout steht bevor`);
      // Kein Score-Beitrag, aber Hinweis auf bevorstehenden Ausbruch
    } else {
      rationale.push(`~ Bollinger Bandbreite stabil (${(currentBw * 100).toFixed(1)}%)`);
    }
  }

  // ── 5. 52-Wochen-Hoch/Tief Nähe — Gewicht: 0.10 ──────────────────────────
  if (prices.length >= 52) {
    const w = 0.10;
    totalWeight += w;
    const yearPrices = prices.slice(-252); // ~1 Jahr
    const yearHigh = Math.max(...yearPrices);
    const yearLow = Math.min(...yearPrices);
    const yearRange = yearHigh - yearLow;

    if (yearRange > 0) {
      const yearPosition = (currentPrice - yearLow) / yearRange;
      const normalizedPos = (yearPosition - 0.5) * 2; // [-1, 1]
      score += w * normalizedPos;

      if (yearPosition > 0.90) {
        bullishCount++;
        rationale.push(`✓ Preis nahe 52-Wochen-Hoch (${(yearPosition * 100).toFixed(0)}%) → Stärke`);
      } else if (yearPosition < 0.10) {
        bearishCount++;
        rationale.push(`✗ Preis nahe 52-Wochen-Tief (${(yearPosition * 100).toFixed(0)}%) → Schwäche`);
      } else {
        rationale.push(`~ 52W-Position: ${(yearPosition * 100).toFixed(0)}% (neutral)`);
      }
    }
  }

  // ── Normierung & Konfidenz ─────────────────────────────────────────────────
  const rawScore = totalWeight > 0 ? Math.max(-1, Math.min(1, score / totalWeight)) : 0;

  // Konfidenz: Übereinstimmung der Indikatoren + Stärke des Scores
  const totalSignals = bullishCount + bearishCount;
  const dominance = totalSignals > 0 ? Math.max(bullishCount, bearishCount) / totalSignals : 0;
  const baseConfidence = Math.abs(rawScore);
  const confidence = Math.min(1, baseConfidence * 0.65 + dominance * 0.35);

  const direction: -1 | 0 | 1 = rawScore > 0.20 ? 1 : rawScore < -0.20 ? -1 : 0;

  // Breakout-Engine: bevorzugt in Trend-Regimes
  const regimeMultiplier = (regime === "bull_trend" || regime === "bear_trend") ? 1.0
    : (regime === "recovery") ? 0.75
    : (regime === "sideways_high_vol") ? 0.6
    : 0.4; // In sideways_low_vol und crisis weniger zuverlässig

  const entry = direction !== 0 && confidence * regimeMultiplier > 0.40;
  const exit = direction === 0 && confidence > 0.50;

  // Stop-Loss / Take-Profit: weiter als Mean-Reversion (Breakouts brauchen Raum)
  const atrForStops = calcAtr(prices, 14);
  const atrPct = atrForStops !== null && currentPrice > 0 ? atrForStops / currentPrice : 0.02;

  const stopLossPct = direction === 1 ? -(atrPct * 2.0 * 100) : direction === -1 ? atrPct * 2.0 * 100 : null;
  const takeProfitPct = direction === 1 ? atrPct * 4.0 * 100 : direction === -1 ? -(atrPct * 4.0 * 100) : null;
  const trailingStopPct = direction !== 0 ? atrPct * 1.5 * 100 : null;

  // Breakout: mittlere Haltedauer (länger als Mean-Reversion, kürzer als Trend)
  const holdingPeriodHint = direction !== 0 ? 14 : null;

  // Regime-Warnungen
  if (regime === "sideways_low_vol") {
    rationale.push("⚠ Breakout-Engine in Low-Vol-Seitwärtsmarkt — Falsch-Ausbrüche häufig");
  }
  if (regime === "crisis") {
    rationale.push("⚠ Krisenregime: Breakouts können schnell umkehren (erhöhte Volatilität)");
  }

  rationale.unshift(`Breakout: ${bullishCount} bullische / ${bearishCount} bärische Signale`);

  return {
    engine: "breakout",
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
