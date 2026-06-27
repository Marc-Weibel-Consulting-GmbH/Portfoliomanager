/**
 * riskThresholdCalibrator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 3: Historische Validierung der RiskOverlay-Schwellenwerte
 *
 * Kernidee:
 *   Statt fester Schwellenwerte (z.B. Vol > 35% → dämpfen) werden die
 *   optimalen Schwellenwerte aus historischen Preisdaten kalibriert.
 *
 * Methodik (Walk-Forward Backtest):
 *   1. Für jede Aktie werden historische Preisdaten in Fenster aufgeteilt:
 *      - In-Sample (IS): 252 Handelstage (~1 Jahr)
 *      - Out-of-Sample (OOS): 63 Handelstage (~3 Monate)
 *   2. Im IS-Fenster wird für jeden Schwellenwert-Kandidaten berechnet:
 *      - Wie oft hat ein Signal nach dem Schwellenwert-Trigger eine positive
 *        Rendite über den Haltezeitraum (holdingPeriod) erzielt?
 *      - Sharpe-Ratio des gefilterten Signal-Streams
 *   3. Der Schwellenwert mit der besten OOS-Performance wird gewählt
 *   4. Regime-spezifische Kalibrierung: Schwellenwerte werden je Regime
 *      (bull_trend, bear_trend, sideways, crisis, recovery) separat optimiert
 *
 * Ausgabe: CalibratedThresholds — wird in riskOverlayEngine.ts verwendet
 */

import { MarketRegime } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VolThresholds {
  /** Volatilität (annualisiert), ab der ein Signal gedämpft wird */
  dampLevel1: number;   // z.B. 0.25 → 25%
  dampLevel2: number;   // z.B. 0.35 → 35%
  blockLevel: number;   // z.B. 0.50 → 50%
  /** Dämpfungsfaktoren für die drei Stufen */
  dampFactor1: number;  // z.B. 0.80
  dampFactor2: number;  // z.B. 0.60
  dampFactor3: number;  // z.B. 0.40 (blockLevel)
}

export interface DrawdownThresholds {
  dampLevel1: number;   // z.B. -0.15 → -15%
  dampLevel2: number;   // z.B. -0.25 → -25%
  dampFactor1: number;
  dampFactor2: number;
}

export interface CalibratedThresholds {
  vol: VolThresholds;
  drawdown: DrawdownThresholds;
  /** Regime-spezifische Anpassungen (Multiplikator auf dampFactor) */
  regimeMultipliers: Partial<Record<MarketRegime, number>>;
  /** Metadaten der Kalibrierung */
  meta: {
    ticker: string;
    calibratedAt: string;
    lookbackDays: number;
    numFolds: number;
    avgOosImprovement: number;  // Verbesserung vs. Default-Schwellenwerte
    confidence: 'high' | 'medium' | 'low';
    dataPoints: number;
  };
}

export interface BacktestFold {
  isStart: number;
  isEnd: number;
  oosStart: number;
  oosEnd: number;
  bestVolThreshold: number;
  bestDdThreshold: number;
  oosSharpeDelta: number;  // Verbesserung vs. kein Filter
}

// ─────────────────────────────────────────────────────────────────────────────
// Default-Schwellenwerte (Fallback wenn keine Kalibrierung möglich)
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_VOL_THRESHOLDS: VolThresholds = {
  dampLevel1: 0.25,
  dampLevel2: 0.35,
  blockLevel: 0.50,
  dampFactor1: 0.80,
  dampFactor2: 0.60,
  dampFactor3: 0.40,
};

export const DEFAULT_DD_THRESHOLDS: DrawdownThresholds = {
  dampLevel1: -0.15,
  dampLevel2: -0.25,
  dampFactor1: 0.75,
  dampFactor2: 0.50,
};

export const DEFAULT_REGIME_MULTIPLIERS: Partial<Record<MarketRegime, number>> = {
  bull_trend: 1.1,          // Etwas lockerer in Bullmärkten
  bear_trend: 0.85,         // Strenger in Bärenmärkten
  sideways_low_vol: 0.95,
  sideways_high_vol: 0.80,  // Strenger bei hoher Seitwärts-Volatilität
  crisis: 0.40,             // Sehr streng in Krisen
  recovery: 0.90,
};

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

/** Annualisierte realisierte Volatilität (log returns) */
function realizedVol(prices: number[], window: number): number | null {
  if (prices.length < window + 1) return null;
  const slice = prices.slice(-window - 1);
  const logReturns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    if (slice[i - 1] > 0 && slice[i] > 0) {
      logReturns.push(Math.log(slice[i] / slice[i - 1]));
    }
  }
  if (logReturns.length < 5) return null;
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance = logReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / logReturns.length;
  return Math.sqrt(variance * 252);
}

/** Max Drawdown über ein Fenster */
function maxDrawdown(prices: number[], window: number): number | null {
  if (prices.length < window) return null;
  const slice = prices.slice(-window);
  let peak = slice[0];
  let maxDD = 0;
  for (const p of slice) {
    if (p > peak) peak = p;
    const dd = (p - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  return maxDD;
}

/** Sharpe-Ratio einer Rendite-Serie */
function sharpeRatio(returns: number[]): number {
  if (returns.length < 5) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length);
  if (std < 1e-8) return 0;
  return (mean / std) * Math.sqrt(252);
}

/**
 * Simuliert einen einfachen Signal-Stream:
 * - Signal = 1 (long) wenn vol < volThreshold UND dd > ddThreshold
 * - Rendite = Preis[t+holdingPeriod] / Preis[t] - 1
 * - Gibt Sharpe der gefilterten Renditen zurück
 */
function simulateFilteredSignals(
  prices: number[],
  volThreshold: number,
  ddThreshold: number,
  holdingPeriod: number = 14
): number {
  const returns: number[] = [];

  for (let i = 20; i < prices.length - holdingPeriod; i++) {
    const vol = realizedVol(prices.slice(0, i + 1), 20);
    const dd = maxDrawdown(prices.slice(0, i + 1), 63);

    if (vol === null || dd === null) continue;

    // Signal: Nur einsteigen wenn Risiko-Filter NICHT ausgelöst
    const filtered = vol > volThreshold || dd < ddThreshold;
    if (!filtered) {
      const ret = prices[i + holdingPeriod] / prices[i] - 1;
      returns.push(ret);
    }
  }

  return sharpeRatio(returns);
}

/**
 * Simuliert Buy-and-Hold als Baseline
 */
function buyAndHoldSharpe(prices: number[], holdingPeriod: number = 14): number {
  const returns: number[] = [];
  for (let i = 0; i < prices.length - holdingPeriod; i++) {
    returns.push(prices[i + holdingPeriod] / prices[i] - 1);
  }
  return sharpeRatio(returns);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hauptfunktion: Kalibrierung
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kalibriert die RiskOverlay-Schwellenwerte für eine Aktie auf Basis
 * historischer Preisdaten.
 *
 * @param ticker  Ticker-Symbol (nur für Metadaten)
 * @param prices  Historische Schlusskurse (älteste zuerst), mind. 252 Werte
 * @param holdingPeriod  Haltedauer in Handelstagen (default: 14)
 */
export function calibrateRiskThresholds(
  ticker: string,
  prices: number[],
  holdingPeriod: number = 14
): CalibratedThresholds {

  // Mindestdaten prüfen
  if (prices.length < 252) {
    return buildDefaultThresholds(ticker, prices.length);
  }

  // ── Walk-Forward-Folds definieren ──────────────────────────────────────────
  const IS_WINDOW = 252;   // 1 Jahr IS
  const OOS_WINDOW = 63;   // 3 Monate OOS
  const MIN_TOTAL = IS_WINDOW + OOS_WINDOW;

  const folds: BacktestFold[] = [];
  let pos = 0;

  while (pos + MIN_TOTAL <= prices.length) {
    const isStart = pos;
    const isEnd = pos + IS_WINDOW;
    const oosStart = isEnd;
    const oosEnd = Math.min(oosStart + OOS_WINDOW, prices.length);

    if (oosEnd - oosStart < 20) break;  // Zu wenig OOS-Daten

    folds.push({
      isStart, isEnd, oosStart, oosEnd,
      bestVolThreshold: DEFAULT_VOL_THRESHOLDS.dampLevel2,
      bestDdThreshold: DEFAULT_DD_THRESHOLDS.dampLevel1,
      oosSharpeDelta: 0,
    });

    pos += OOS_WINDOW;  // Rollierende Fenster
  }

  if (folds.length === 0) {
    return buildDefaultThresholds(ticker, prices.length);
  }

  // ── Kandidaten-Gitter ──────────────────────────────────────────────────────
  const volCandidates = [0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50];
  const ddCandidates = [-0.10, -0.15, -0.20, -0.25, -0.30];

  // ── Optimierung je Fold ───────────────────────────────────────────────────
  for (const fold of folds) {
    const isSeries = prices.slice(fold.isStart, fold.isEnd);
    const oosSeries = prices.slice(fold.oosStart, fold.oosEnd);

    // Baseline (kein Filter)
    const baselineIS = buyAndHoldSharpe(isSeries, holdingPeriod);
    const baselineOOS = buyAndHoldSharpe(oosSeries, holdingPeriod);

    let bestISImprovement = -Infinity;
    let bestVol = DEFAULT_VOL_THRESHOLDS.dampLevel2;
    let bestDD = DEFAULT_DD_THRESHOLDS.dampLevel1;

    // Grid-Search im IS-Fenster
    for (const volT of volCandidates) {
      for (const ddT of ddCandidates) {
        const isSharp = simulateFilteredSignals(isSeries, volT, ddT, holdingPeriod);
        const improvement = isSharp - baselineIS;
        if (improvement > bestISImprovement) {
          bestISImprovement = improvement;
          bestVol = volT;
          bestDD = ddT;
        }
      }
    }

    // OOS-Validierung mit den besten IS-Parametern
    const oosSharp = simulateFilteredSignals(oosSeries, bestVol, bestDD, holdingPeriod);
    fold.bestVolThreshold = bestVol;
    fold.bestDdThreshold = bestDD;
    fold.oosSharpeDelta = oosSharp - baselineOOS;
  }

  // ── Aggregation der Fold-Ergebnisse ────────────────────────────────────────
  // Gewichtung: neuere Folds zählen mehr (geometrisch)
  const weights = folds.map((_, i) => Math.pow(1.2, i));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let weightedVol = 0;
  let weightedDD = 0;
  let avgOosImprovement = 0;

  for (let i = 0; i < folds.length; i++) {
    const w = weights[i] / totalWeight;
    weightedVol += folds[i].bestVolThreshold * w;
    weightedDD += folds[i].bestDdThreshold * w;
    avgOosImprovement += folds[i].oosSharpeDelta * w;
  }

  // ── Schwellenwert-Struktur aufbauen ────────────────────────────────────────
  // dampLevel2 = kalibrierter Hauptschwellenwert
  // dampLevel1 = 80% davon (frühe Warnung)
  // blockLevel = 140% davon (harte Sperre)
  const dampLevel2 = Math.max(0.20, Math.min(0.50, weightedVol));
  const dampLevel1 = Math.max(0.15, dampLevel2 * 0.75);
  const blockLevel = Math.min(0.65, dampLevel2 * 1.40);

  const ddLevel1 = Math.max(-0.30, Math.min(-0.08, weightedDD));
  const ddLevel2 = Math.max(-0.40, ddLevel1 * 1.60);

  // ── Konfidenz basierend auf OOS-Verbesserung ──────────────────────────────
  let confidence: 'high' | 'medium' | 'low';
  if (avgOosImprovement > 0.3 && folds.length >= 3) {
    confidence = 'high';
  } else if (avgOosImprovement > 0.0 && folds.length >= 2) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // ── Regime-Multiplikatoren kalibrieren ────────────────────────────────────
  // Einfache Heuristik: Wenn Kalibrierung niedrige Schwellenwerte ergibt,
  // ist die Aktie volatiler → Regime-Multiplikatoren werden strenger
  const volRatio = dampLevel2 / DEFAULT_VOL_THRESHOLDS.dampLevel2;  // < 1 = strenger
  const regimeMultipliers: Partial<Record<MarketRegime, number>> = {
    bull_trend: Math.min(1.2, DEFAULT_REGIME_MULTIPLIERS.bull_trend! * volRatio),
    bear_trend: Math.max(0.6, DEFAULT_REGIME_MULTIPLIERS.bear_trend! * volRatio),
    sideways_low_vol: Math.max(0.7, DEFAULT_REGIME_MULTIPLIERS.sideways_low_vol! * volRatio),
    sideways_high_vol: Math.max(0.6, DEFAULT_REGIME_MULTIPLIERS.sideways_high_vol! * volRatio),
    crisis: Math.max(0.25, DEFAULT_REGIME_MULTIPLIERS.crisis! * volRatio),
    recovery: Math.max(0.7, DEFAULT_REGIME_MULTIPLIERS.recovery! * volRatio),
  };

  return {
    vol: {
      dampLevel1,
      dampLevel2,
      blockLevel,
      dampFactor1: 0.80,
      dampFactor2: 0.60,
      dampFactor3: 0.40,
    },
    drawdown: {
      dampLevel1: ddLevel1,
      dampLevel2: ddLevel2,
      dampFactor1: 0.75,
      dampFactor2: 0.50,
    },
    regimeMultipliers,
    meta: {
      ticker,
      calibratedAt: new Date().toISOString(),
      lookbackDays: prices.length,
      numFolds: folds.length,
      avgOosImprovement,
      confidence,
      dataPoints: prices.length,
    },
  };
}

/** Erstellt Default-Schwellenwerte wenn zu wenig Daten vorhanden */
function buildDefaultThresholds(ticker: string, dataPoints: number): CalibratedThresholds {
  return {
    vol: { ...DEFAULT_VOL_THRESHOLDS },
    drawdown: { ...DEFAULT_DD_THRESHOLDS },
    regimeMultipliers: { ...DEFAULT_REGIME_MULTIPLIERS },
    meta: {
      ticker,
      calibratedAt: new Date().toISOString(),
      lookbackDays: dataPoints,
      numFolds: 0,
      avgOosImprovement: 0,
      confidence: 'low',
      dataPoints,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch-Kalibrierung für mehrere Ticker
// ─────────────────────────────────────────────────────────────────────────────

export interface BatchCalibrationResult {
  ticker: string;
  thresholds: CalibratedThresholds;
  durationMs: number;
}

/**
 * Kalibriert Schwellenwerte für mehrere Ticker parallel.
 * Wird vom Admin-Trigger und vom Cron-Job verwendet.
 */
export async function calibrateMultipleTickers(
  tickerPricesMap: Map<string, number[]>,
  holdingPeriod: number = 14
): Promise<BatchCalibrationResult[]> {
  const results: BatchCalibrationResult[] = [];

  for (const [ticker, prices] of Array.from(tickerPricesMap.entries())) {
    const start = Date.now();
    try {
      const thresholds = calibrateRiskThresholds(ticker, prices, holdingPeriod);
      results.push({ ticker, thresholds, durationMs: Date.now() - start });
    } catch (e) {
      console.warn(`[riskThresholdCalibrator] Failed for ${ticker}:`, (e as Error).message);
      results.push({
        ticker,
        thresholds: buildDefaultThresholds(ticker, prices.length),
        durationMs: Date.now() - start,
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Cache (TTL: 24h)
// ─────────────────────────────────────────────────────────────────────────────

const thresholdCache = new Map<string, { thresholds: CalibratedThresholds; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;  // 24 Stunden

export function getCachedThresholds(ticker: string): CalibratedThresholds | null {
  const entry = thresholdCache.get(ticker);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    thresholdCache.delete(ticker);
    return null;
  }
  return entry.thresholds;
}

export function setCachedThresholds(ticker: string, thresholds: CalibratedThresholds): void {
  thresholdCache.set(ticker, {
    thresholds,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function clearThresholdCache(): void {
  thresholdCache.clear();
}

export function getCacheStats(): { size: number; tickers: string[] } {
  return {
    size: thresholdCache.size,
    tickers: Array.from(thresholdCache.keys()),
  };
}
