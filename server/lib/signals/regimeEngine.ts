/**
 * regimeEngine — 6-stufige Marktregime-Klassifikation
 *
 * Transparent, regelbasiert, vollständig auditierbar.
 * Keine ML-Blackbox: jede Entscheidung ist in rationale[] dokumentiert.
 *
 * Regime-Hierarchie (Priorität absteigend):
 *   1. crisis          — Drawdown > 20% UND Volatilität > 30%
 *   2. recovery        — Drawdown > 10%, aber Trend dreht (SMA50 steigt)
 *   3. bear_trend      — Preis < SMA200, SMA50 fällt, ADX > 20
 *   4. bull_trend      — Preis > SMA200, SMA50 steigt, ADX > 20
 *   5. sideways_high_vol — ADX < 20, Volatilität > 20%
 *   6. sideways_low_vol  — ADX < 20, Volatilität <= 20%
 */

import type { MarketRegime, RegimeFeatures, RegimeSnapshot } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Schwellenwerte (dokumentierte Konstanten)
// ─────────────────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  CRISIS_DRAWDOWN: -0.20,         // -20% Drawdown
  CRISIS_VOL: 0.30,               // 30% annualisierte Volatilität
  RECOVERY_DRAWDOWN: -0.10,       // -10% Drawdown
  TREND_ADX_MIN: 20,              // ADX > 20 = Trend vorhanden
  SIDEWAYS_HIGH_VOL: 0.20,        // 20% annualisierte Volatilität
  BULL_PRICE_VS_SMA200: 0.0,      // Preis > SMA200
  BEAR_PRICE_VS_SMA200: 0.0,      // Preis < SMA200
  SLOPE_RISING: 0.0,              // Positive Steigung
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

/** Einfacher gleitender Durchschnitt */
function sma(prices: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += prices[j];
    result.push(sum / period);
  }
  return result;
}

/** Steigung des SMA über die letzten `lookback` Tage (normiert auf Preis) */
function smaSlope(smaValues: number[], lookback = 10): number | null {
  const valid = smaValues.filter(v => !isNaN(v));
  if (valid.length < lookback + 1) return null;
  const recent = valid.slice(-lookback);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (first === 0) return null;
  return (last - first) / first;
}

/** Average True Range (ATR-14) als Prozent des aktuellen Preises */
function atrPct(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const high = prices[i];  // Wir haben nur Close-Preise → TR = |close - prevClose|
    const low = prices[i];
    const prevClose = prices[i - 1];
    trs.push(Math.abs(high - prevClose));
  }
  const recentTrs = trs.slice(-period);
  const atr = recentTrs.reduce((a, b) => a + b, 0) / period;
  const currentPrice = prices[prices.length - 1];
  return currentPrice > 0 ? atr / currentPrice : null;
}

/** Average Directional Index (ADX-14) — vereinfachte Berechnung mit Close-Preisen */
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

  // Wilder-Smoothing
  function wilderSmooth(arr: number[], p: number): number[] {
    const result: number[] = [arr.slice(0, p).reduce((a, b) => a + b, 0)];
    for (let i = p; i < arr.length; i++) {
      result.push(result[result.length - 1] - result[result.length - 1] / p + arr[i]);
    }
    return result;
  }

  const smoothTR = wilderSmooth(tr, period);
  const smoothPlusDM = wilderSmooth(plusDM, period);
  const smoothMinusDM = wilderSmooth(minusDM, period);

  const dx: number[] = [];
  for (let i = 0; i < smoothTR.length; i++) {
    if (smoothTR[i] === 0) continue;
    const plusDI = (smoothPlusDM[i] / smoothTR[i]) * 100;
    const minusDI = (smoothMinusDM[i] / smoothTR[i]) * 100;
    const diDiff = Math.abs(plusDI - minusDI);
    const diSum = plusDI + minusDI;
    dx.push(diSum > 0 ? (diDiff / diSum) * 100 : 0);
  }

  if (dx.length < period) return null;
  const recentDx = dx.slice(-period);
  return recentDx.reduce((a, b) => a + b, 0) / period;
}

/** Annualisierte realisierte Volatilität über `period` Tage */
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

/** Maximaler Drawdown über `period` Tage */
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
// Feature-Berechnung
// ─────────────────────────────────────────────────────────────────────────────

export function computeRegimeFeatures(
  prices: number[],
  lpplRisk: number | null = null
): RegimeFeatures {
  if (prices.length < 10) {
    return {
      priceVs50d: null, priceVs100d: null, priceVs200d: null,
      maSlope50d: null, maSlope200d: null, adx: null, atrPct: null,
      realizedVol20d: null, realizedVol60d: null, drawdown63d: null,
      lpplRisk: lpplRisk ?? null,
    };
  }

  const currentPrice = prices[prices.length - 1];
  const sma50 = sma(prices, 50);
  const sma100 = sma(prices, 100);
  const sma200 = sma(prices, 200);

  const lastSma50 = sma50[sma50.length - 1];
  const lastSma100 = sma100[sma100.length - 1];
  const lastSma200 = sma200[sma200.length - 1];

  return {
    priceVs50d: !isNaN(lastSma50) && lastSma50 > 0
      ? (currentPrice - lastSma50) / lastSma50 : null,
    priceVs100d: !isNaN(lastSma100) && lastSma100 > 0
      ? (currentPrice - lastSma100) / lastSma100 : null,
    priceVs200d: !isNaN(lastSma200) && lastSma200 > 0
      ? (currentPrice - lastSma200) / lastSma200 : null,
    maSlope50d: smaSlope(sma50),
    maSlope200d: smaSlope(sma200),
    adx: adx(prices),
    atrPct: atrPct(prices),
    realizedVol20d: realizedVol(prices, 20),
    realizedVol60d: realizedVol(prices, 60),
    drawdown63d: maxDrawdown(prices, 63),
    lpplRisk: lpplRisk ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Regime-Klassifikation
// ─────────────────────────────────────────────────────────────────────────────

export function classifyRegime(features: RegimeFeatures): {
  regime: MarketRegime;
  confidence: number;
  rationale: string[];
} {
  const rationale: string[] = [];
  let rulesMatched = 0;
  let totalRules = 0;

  function check(condition: boolean, description: string): boolean {
    totalRules++;
    if (condition) {
      rationale.push(`✓ ${description}`);
      rulesMatched++;
    } else {
      rationale.push(`✗ ${description}`);
    }
    return condition;
  }

  const vol20 = features.realizedVol20d;
  const dd63 = features.drawdown63d;
  const adxVal = features.adx;
  const slope50 = features.maSlope50d;
  const pVs200 = features.priceVs200d;
  const lppl = features.lpplRisk;

  // ── 1. CRISIS ──────────────────────────────────────────────────────────────
  const isCrisisDrawdown = dd63 !== null && dd63 < THRESHOLDS.CRISIS_DRAWDOWN;
  const isCrisisVol = vol20 !== null && vol20 > THRESHOLDS.CRISIS_VOL;
  const isLpplBubbleBurst = lppl !== null && lppl < -0.5;

  if (isCrisisDrawdown && (isCrisisVol || isLpplBubbleBurst)) {
    check(true, `Drawdown ${(dd63! * 100).toFixed(1)}% < -20% (Krisenschwelle)`);
    if (isCrisisVol) check(true, `Volatilität ${(vol20! * 100).toFixed(1)}% > 30%`);
    if (isLpplBubbleBurst) check(true, `LPPLS BubbleScore ${lppl!.toFixed(2)} < -0.5 (Blasenplatzen)`);
    return {
      regime: "crisis",
      confidence: Math.min(1, rulesMatched / Math.max(totalRules, 1)),
      rationale,
    };
  }

  // ── 2. RECOVERY ────────────────────────────────────────────────────────────
  const isRecoveryDrawdown = dd63 !== null && dd63 < THRESHOLDS.RECOVERY_DRAWDOWN;
  const isTrendTurning = slope50 !== null && slope50 > THRESHOLDS.SLOPE_RISING;

  if (isRecoveryDrawdown && isTrendTurning) {
    check(true, `Drawdown ${(dd63! * 100).toFixed(1)}% < -10% (Erholungsphase)`);
    check(true, `SMA50-Steigung ${(slope50! * 100).toFixed(2)}% > 0 (Trend dreht)`);
    return {
      regime: "recovery",
      confidence: Math.min(1, rulesMatched / Math.max(totalRules, 1)),
      rationale,
    };
  }

  // ── 3. BEAR TREND ──────────────────────────────────────────────────────────
  const isBearish200 = pVs200 !== null && pVs200 < THRESHOLDS.BEAR_PRICE_VS_SMA200;
  const isFalling50 = slope50 !== null && slope50 < THRESHOLDS.SLOPE_RISING;
  const hasTrend = adxVal !== null && adxVal > THRESHOLDS.TREND_ADX_MIN;

  if (isBearish200 && isFalling50 && hasTrend) {
    check(true, `Preis ${(pVs200! * 100).toFixed(1)}% unter SMA200`);
    check(true, `SMA50-Steigung ${(slope50! * 100).toFixed(2)}% < 0 (fallend)`);
    check(true, `ADX ${adxVal!.toFixed(0)} > ${THRESHOLDS.TREND_ADX_MIN} (Trend stark)`);
    return {
      regime: "bear_trend",
      confidence: Math.min(1, rulesMatched / Math.max(totalRules, 1)),
      rationale,
    };
  }

  // ── 4. BULL TREND ──────────────────────────────────────────────────────────
  const isBullish200 = pVs200 !== null && pVs200 > THRESHOLDS.BULL_PRICE_VS_SMA200;
  const isRising50 = slope50 !== null && slope50 > THRESHOLDS.SLOPE_RISING;

  if (isBullish200 && isRising50 && hasTrend) {
    check(true, `Preis ${(pVs200! * 100).toFixed(1)}% über SMA200`);
    check(true, `SMA50-Steigung ${(slope50! * 100).toFixed(2)}% > 0 (steigend)`);
    check(true, `ADX ${adxVal!.toFixed(0)} > ${THRESHOLDS.TREND_ADX_MIN} (Trend stark)`);
    // LPPL-Warnung als Zusatzinfo (blockiert nicht, aber reduziert Konfidenz)
    if (lppl !== null && lppl > 0.5) {
      rationale.push(`⚠ LPPLS BubbleScore ${lppl.toFixed(2)} > 0.5 (Blasenrisiko erhöht)`);
    }
    return {
      regime: "bull_trend",
      confidence: Math.min(1, rulesMatched / Math.max(totalRules, 1)),
      rationale,
    };
  }

  // ── 5. SIDEWAYS HIGH VOL ───────────────────────────────────────────────────
  const isHighVol = vol20 !== null && vol20 > THRESHOLDS.SIDEWAYS_HIGH_VOL;

  if (isHighVol) {
    check(true, `Volatilität ${(vol20! * 100).toFixed(1)}% > 20% (erhöhte Unsicherheit)`);
    if (adxVal !== null) check(false, `ADX ${adxVal.toFixed(0)} ≤ ${THRESHOLDS.TREND_ADX_MIN} (kein klarer Trend)`);
    return {
      regime: "sideways_high_vol",
      confidence: Math.min(1, rulesMatched / Math.max(totalRules, 1)),
      rationale,
    };
  }

  // ── 6. SIDEWAYS LOW VOL (Fallback) ─────────────────────────────────────────
  rationale.push("✓ Kein klarer Trend, niedrige Volatilität → Seitwärtsbewegung");
  if (vol20 !== null) rationale.push(`  Volatilität: ${(vol20 * 100).toFixed(1)}%`);
  if (adxVal !== null) rationale.push(`  ADX: ${adxVal.toFixed(0)}`);

  return {
    regime: "sideways_low_vol",
    confidence: 0.6,
    rationale,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Öffentliche API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Berechnet den aktuellen Regime-Snapshot für eine Preisserie.
 *
 * @param prices  Chronologische Close-Preise (mind. 50, besser 200+)
 * @param lpplRisk  Vorberechneter LPPLS BubbleScore [-1, 1] (optional)
 * @param date    ISO-8601 Datum (default: heute)
 */
export function computeRegime(
  prices: number[],
  lpplRisk: number | null = null,
  date?: string
): RegimeSnapshot {
  const features = computeRegimeFeatures(prices, lpplRisk);
  const { regime, confidence, rationale } = classifyRegime(features);

  return {
    date: date ?? new Date().toISOString().slice(0, 10),
    regime,
    confidence,
    features,
    rationale,
  };
}

/** Gibt einen menschenlesbaren Label für das Regime zurück */
export function regimeLabel(regime: MarketRegime): string {
  const labels: Record<MarketRegime, string> = {
    bull_trend: "Bullenmarkt",
    bear_trend: "Bärenmarkt",
    sideways_low_vol: "Seitwärts (ruhig)",
    sideways_high_vol: "Seitwärts (volatil)",
    crisis: "Krise",
    recovery: "Erholung",
  };
  return labels[regime];
}

/** Gibt die bevorzugte Signal-Engine für ein Regime zurück */
export function preferredEngineForRegime(
  regime: MarketRegime
): "trend" | "mean_reversion" | "ensemble" {
  switch (regime) {
    case "bull_trend":
    case "bear_trend":
      return "trend";
    case "sideways_low_vol":
    case "sideways_high_vol":
      return "mean_reversion";
    case "crisis":
    case "recovery":
    default:
      return "ensemble";
  }
}
