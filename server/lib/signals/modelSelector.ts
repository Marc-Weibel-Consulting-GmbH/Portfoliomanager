/**
 * modelSelector — Multi-Metrik Modellauswahl je Regime (Phase 2)
 *
 * Wählt die beste Signal-Engine für das aktuelle Markt-Regime basierend auf:
 *   1. Walk-Forward-Backtest-Metriken (OOS-Evaluation über rollierende Fenster)
 *   2. Regime-spezifischer Gewichtungsformel (aus Blueprint)
 *   3. Stabilitäts-Score (Konsistenz über 3 Subperioden)
 *
 * Gewichtungsformel (aus signal-framework-blueprint.md):
 *   totalScore =
 *     0.20 × sharpe
 *   + 0.15 × sortino
 *   + 0.15 × calmar
 *   + 0.10 × profitFactor
 *   + 0.10 × stabilityScore   // Std der Sharpe über 3 Subperioden
 *   + 0.10 × walkForwardScore // OOS/IS Ratio (1.0 = kein Overfitting)
 *   + 0.10 × costResilience   // Sharpe nach 0.5% Transaktionskosten
 *   - 0.10 × turnoverPenalty  // Normiert auf [0,1], 1 = täglicher Wechsel
 *
 * Walk-Forward-Logik:
 *   - IS (In-Sample): 120 Tage Trainings-Fenster
 *   - OOS (Out-of-Sample): 30 Tage Test-Fenster
 *   - 3 rollierende Fenster für Stabilitäts-Score
 *   - OOS/IS Sharpe-Ratio = walkForwardScore
 */

import type { MarketRegime, ModelEvaluation, SignalEngineType, SignalOutput } from "./types";
import {
  calcSharpe,
  calcSortino,
  calcCalmar,
  calcMaxDrawdown,
  TRADING_DAYS_YEAR,
} from "../../analytics/riskStats";

// ─────────────────────────────────────────────────────────────────────────────
// Konstanten
// ─────────────────────────────────────────────────────────────────────────────

const IS_WINDOW = 120;    // In-Sample Fenster (Tage)
const OOS_WINDOW = 30;    // Out-of-Sample Fenster (Tage)
const N_FOLDS = 3;        // Anzahl Walk-Forward-Folds für Stabilitäts-Score
const TRANSACTION_COST = 0.005; // 0.5% Transaktionskosten (Round-Trip)

// Mindest-Datenpunkte für Walk-Forward-Evaluation
const MIN_PRICES_FOR_WF = IS_WINDOW + OOS_WINDOW * N_FOLDS;

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen: Simulated Returns aus Signal-Scores
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Berechnet tägliche Preisrenditen aus einem Preisarray.
 */
function priceReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] === 0) { returns.push(0); continue; }
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return returns;
}

/**
 * Simuliert Strategy-Returns basierend auf einem Signal-Output.
 * Vereinfachte Simulation: Direction × Tagesrendite.
 * Transaktionskosten werden beim Richtungswechsel abgezogen.
 */
function simulateStrategyReturns(
  prices: number[],
  signal: SignalOutput,
  transactionCost = 0
): number[] {
  if (prices.length < 2) return [];
  const returns = priceReturns(prices);
  const direction = signal.direction; // Konstant für den Zeitraum (vereinfacht)

  // Transaktionskosten: einmalig beim Einstieg
  const strategyReturns = returns.map(r => r * direction);
  if (transactionCost > 0 && direction !== 0 && strategyReturns.length > 0) {
    strategyReturns[0] -= transactionCost;
  }
  return strategyReturns;
}

/**
 * Berechnet Profit Factor aus Returns.
 * Profit Factor = Summe der positiven Returns / |Summe der negativen Returns|
 */
function calcProfitFactor(returns: number[]): number {
  const gains = returns.filter(r => r > 0).reduce((a, b) => a + b, 0);
  const losses = Math.abs(returns.filter(r => r < 0).reduce((a, b) => a + b, 0));
  if (losses === 0) return gains > 0 ? 3.0 : 1.0; // Cap bei 3.0 wenn keine Verluste
  return Math.min(3.0, gains / losses);
}

/**
 * Normiert einen Metrik-Wert auf [0, 1] mit Sättigung.
 */
function normalizeMetric(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Walk-Forward Evaluation
// ─────────────────────────────────────────────────────────────────────────────

interface WalkForwardResult {
  isSharpe: number;
  oosSharpe: number;
  walkForwardScore: number;  // OOS/IS Ratio, gekappt auf [0, 1]
  stabilityScore: number;    // 1 - Std(OOS-Sharpe über Folds) / max(|OOS-Sharpe|)
  foldSharpes: number[];     // OOS-Sharpe je Fold
}

/**
 * Walk-Forward-Evaluation für eine Engine.
 * Verwendet rollierende IS/OOS-Fenster.
 */
function runWalkForward(
  prices: number[],
  signal: SignalOutput,
  isWindow = IS_WINDOW,
  oosWindow = OOS_WINDOW,
  nFolds = N_FOLDS
): WalkForwardResult {
  const foldSharpes: number[] = [];
  const isSharpesAll: number[] = [];

  for (let fold = 0; fold < nFolds; fold++) {
    // Fenster-Positionen: OOS-Fenster sind chronologisch aufeinanderfolgend
    const oosEnd = prices.length - fold * oosWindow;
    const oosStart = oosEnd - oosWindow;
    const isEnd = oosStart;
    const isStart = Math.max(0, isEnd - isWindow);

    if (isEnd - isStart < 30 || oosEnd - oosStart < 10) continue;

    const isFenster = prices.slice(isStart, isEnd);
    const oosFenster = prices.slice(oosStart, oosEnd);

    const isReturns = simulateStrategyReturns(isFenster, signal, 0);
    const oosReturns = simulateStrategyReturns(oosFenster, signal, TRANSACTION_COST);

    if (isReturns.length > 0) isSharpesAll.push(calcSharpe(isReturns));
    if (oosReturns.length > 0) foldSharpes.push(calcSharpe(oosReturns));
  }

  const isSharpe = isSharpesAll.length > 0
    ? isSharpesAll.reduce((a, b) => a + b, 0) / isSharpesAll.length
    : 0;
  const oosSharpe = foldSharpes.length > 0
    ? foldSharpes.reduce((a, b) => a + b, 0) / foldSharpes.length
    : 0;

  // Walk-Forward Score: OOS/IS Ratio, normiert auf [0, 1]
  // 1.0 = OOS genauso gut wie IS (kein Overfitting)
  // 0.0 = OOS deutlich schlechter als IS (starkes Overfitting)
  let walkForwardScore = 0.5; // Default
  if (Math.abs(isSharpe) > 0.1) {
    const ratio = oosSharpe / Math.abs(isSharpe);
    walkForwardScore = Math.max(0, Math.min(1, (ratio + 0.5) / 1.5)); // Normierung: ratio=1 → 1.0, ratio=-0.5 → 0
  }

  // Stabilitäts-Score: 1 - normierte Std der OOS-Sharpes
  let stabilityScore = 0.5;
  if (foldSharpes.length >= 2) {
    const mean = foldSharpes.reduce((a, b) => a + b, 0) / foldSharpes.length;
    const variance = foldSharpes.reduce((a, b) => a + (b - mean) ** 2, 0) / foldSharpes.length;
    const stdDev = Math.sqrt(variance);
    const maxAbs = Math.max(...foldSharpes.map(Math.abs), 0.1);
    stabilityScore = Math.max(0, Math.min(1, 1 - stdDev / maxAbs));
  }

  return { isSharpe, oosSharpe, walkForwardScore, stabilityScore, foldSharpes };
}

// ─────────────────────────────────────────────────────────────────────────────
// Modell-Evaluation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Berechnet alle Bewertungsmetriken für eine Engine.
 */
function evaluateEngine(
  prices: number[],
  signal: SignalOutput,
  regime: MarketRegime
): ModelEvaluation {
  const hasEnoughData = prices.length >= MIN_PRICES_FOR_WF;

  // Gesamte Preishistorie für Basis-Metriken
  const allReturns = simulateStrategyReturns(prices, signal, 0);
  const allReturnsWithCost = simulateStrategyReturns(prices, signal, TRANSACTION_COST);

  const sharpe = allReturns.length > 0 ? calcSharpe(allReturns) : 0;
  const sortino = allReturns.length > 0 ? calcSortino(allReturns) : 0;
  const calmar = allReturns.length > 0 ? calcCalmar(allReturns) : 0;
  const profitFactor = allReturns.length > 0 ? calcProfitFactor(allReturns) : 1.0;

  // Turnover Penalty: Häufigkeit der Richtungswechsel (vereinfacht)
  // Da wir nur ein Signal haben, ist Turnover = 0 (keine Wechsel im Beobachtungszeitraum)
  // In einer vollständigen Implementierung würde man historische Signale vergleichen
  const turnoverPenalty = 0.1; // Konservative Schätzung

  // Cost Resilience: Sharpe nach Transaktionskosten / Sharpe ohne Kosten
  const sharpeWithCost = allReturnsWithCost.length > 0 ? calcSharpe(allReturnsWithCost) : 0;
  const costResilience = Math.abs(sharpe) > 0.01
    ? Math.max(0, Math.min(1, sharpeWithCost / sharpe))
    : 0.5;

  // Walk-Forward (nur wenn genug Daten)
  let walkForwardScore = 0.5;
  let stabilityScore = 0.5;

  if (hasEnoughData) {
    const wf = runWalkForward(prices, signal);
    walkForwardScore = wf.walkForwardScore;
    stabilityScore = wf.stabilityScore;
  } else {
    // Schätzung aus Signal-Konfidenz wenn nicht genug Daten
    walkForwardScore = signal.confidence * 0.7;
    stabilityScore = signal.confidence * 0.6;
  }

  // Normierung der Metriken auf [0, 1] für die Gewichtungsformel
  // Sharpe: typisch [-2, 3] → normiert auf [0, 1]
  const normSharpe = normalizeMetric(sharpe, -2, 3);
  const normSortino = normalizeMetric(sortino, -3, 5);
  const normCalmar = normalizeMetric(calmar, -2, 3);
  const normProfitFactor = normalizeMetric(profitFactor, 0.5, 3.0);

  // Gewichtungsformel aus Blueprint
  const totalScore =
    0.20 * normSharpe +
    0.15 * normSortino +
    0.15 * normCalmar +
    0.10 * normProfitFactor +
    0.10 * stabilityScore +
    0.10 * walkForwardScore +
    0.10 * costResilience -
    0.10 * turnoverPenalty;

  return {
    engine: signal.engine,
    regime,
    sharpe,
    sortino,
    calmar,
    profitFactor,
    stabilityScore,
    walkForwardScore,
    costResilience,
    turnoverPenalty,
    totalScore: Math.max(0, Math.min(1, totalScore)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Regime-Priors: A-priori Gewichtung je Regime
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A-priori Gewichtung der Engines je Regime.
 * Kombiniert mit dem Walk-Forward-Score für die finale Auswahl.
 */
function getRegimePrior(
  engine: SignalEngineType,
  regime: MarketRegime
): number {
  const priors: Record<MarketRegime, Partial<Record<SignalEngineType, number>>> = {
    bull_trend:         { trend: 0.50, breakout: 0.30, mean_reversion: 0.10, ensemble: 0.10 },
    bear_trend:         { trend: 0.45, breakout: 0.30, mean_reversion: 0.15, ensemble: 0.10 },
    sideways_low_vol:   { mean_reversion: 0.55, trend: 0.15, breakout: 0.10, ensemble: 0.20 },
    sideways_high_vol:  { mean_reversion: 0.40, ensemble: 0.30, breakout: 0.20, trend: 0.10 },
    crisis:             { ensemble: 0.45, mean_reversion: 0.25, trend: 0.20, breakout: 0.10 },
    recovery:           { ensemble: 0.35, trend: 0.30, mean_reversion: 0.25, breakout: 0.10 },
  };
  return priors[regime]?.[engine] ?? 0.10;
}

// ─────────────────────────────────────────────────────────────────────────────
// Öffentliche API
// ─────────────────────────────────────────────────────────────────────────────

export interface ModelSelectionResult {
  selectedEngine: SignalEngineType;
  selectedSignal: SignalOutput;
  evaluations: ModelEvaluation[];
  rationale: string[];
  walkForwardEnabled: boolean;
}

/**
 * Wählt die beste Signal-Engine für das aktuelle Regime.
 *
 * @param prices - Historische Schlusskurse (chronologisch)
 * @param regime - Aktuelles Markt-Regime
 * @param signals - Map von Engine-Typ zu Signal-Output
 * @returns Ausgewählte Engine mit Begründung
 */
export function selectBestModel(
  prices: number[],
  regime: MarketRegime,
  signals: Map<SignalEngineType, SignalOutput>
): ModelSelectionResult {
  const rationale: string[] = [];
  const evaluations: ModelEvaluation[] = [];
  const walkForwardEnabled = prices.length >= MIN_PRICES_FOR_WF;

  rationale.push(`Walk-Forward: ${walkForwardEnabled ? `aktiv (${N_FOLDS} Folds, IS=${IS_WINDOW}T, OOS=${OOS_WINDOW}T)` : `deaktiviert (< ${MIN_PRICES_FOR_WF} Datenpunkte)`}`);

  // Alle Engines evaluieren
  const scoredEngines: Array<{ engine: SignalEngineType; combinedScore: number; eval: ModelEvaluation }> = [];

  for (const [engineType, signal] of signals.entries()) {
    const evaluation = evaluateEngine(prices, signal, regime);
    evaluations.push(evaluation);

    // Kombinierter Score: Walk-Forward-Score × 0.7 + Regime-Prior × 0.3
    const prior = getRegimePrior(engineType, regime);
    const combinedScore = evaluation.totalScore * 0.70 + prior * 0.30;

    scoredEngines.push({ engine: engineType, combinedScore, eval: evaluation });

    rationale.push(
      `${engineType}: WF-Score=${evaluation.walkForwardScore.toFixed(2)}, ` +
      `Sharpe=${evaluation.sharpe.toFixed(2)}, ` +
      `Stability=${evaluation.stabilityScore.toFixed(2)}, ` +
      `Prior=${prior.toFixed(2)}, ` +
      `Combined=${combinedScore.toFixed(3)}`
    );
  }

  // Beste Engine wählen
  scoredEngines.sort((a, b) => b.combinedScore - a.combinedScore);

  if (scoredEngines.length === 0) {
    // Fallback: Ensemble
    const fallbackSignal = signals.get("ensemble") ?? signals.values().next().value;
    return {
      selectedEngine: "ensemble",
      selectedSignal: fallbackSignal,
      evaluations,
      rationale: [...rationale, "⚠ Kein Signal verfügbar — Fallback auf Ensemble"],
      walkForwardEnabled,
    };
  }

  const best = scoredEngines[0];
  const second = scoredEngines[1];

  // Mindest-Konfidenz-Schwelle: Wenn beste Engine sehr schwach, Ensemble bevorzugen
  const minConfidenceThreshold = 0.35;
  const bestSignal = signals.get(best.engine)!;

  let selectedEngine = best.engine;
  let selectedSignal = bestSignal;

  if (best.combinedScore < minConfidenceThreshold) {
    const ensembleSignal = signals.get("ensemble");
    if (ensembleSignal) {
      selectedEngine = "ensemble";
      selectedSignal = ensembleSignal;
      rationale.push(`⚠ Beste Engine (${best.engine}) unter Mindestschwelle ${minConfidenceThreshold.toFixed(2)} → Fallback auf Ensemble`);
    }
  } else if (second && best.combinedScore - second.combinedScore < 0.05) {
    // Sehr knapper Unterschied: Ensemble als Tie-Breaker
    rationale.push(`~ Knapper Unterschied (${(best.combinedScore - second.combinedScore).toFixed(3)}) zwischen ${best.engine} und ${second.engine}`);
  }

  rationale.push(`✓ Ausgewählt: ${selectedEngine} (Combined-Score: ${best.combinedScore.toFixed(3)}, Regime: ${regime})`);

  return {
    selectedEngine,
    selectedSignal,
    evaluations,
    rationale,
    walkForwardEnabled,
  };
}

/**
 * Gibt eine Zusammenfassung der Modell-Evaluationen zurück (für UI-Anzeige).
 */
export function formatModelSelectionSummary(result: ModelSelectionResult): string[] {
  const lines: string[] = [
    `Ausgewähltes Modell: ${result.selectedEngine}`,
    `Walk-Forward: ${result.walkForwardEnabled ? "aktiv" : "deaktiviert"}`,
    "",
    "── Engine-Bewertungen ──",
  ];

  for (const ev of result.evaluations.sort((a, b) => b.totalScore - a.totalScore)) {
    lines.push(
      `${ev.engine === result.selectedEngine ? "✓" : "○"} ${ev.engine}: ` +
      `Score=${ev.totalScore.toFixed(3)}, Sharpe=${ev.sharpe.toFixed(2)}, ` +
      `WF=${ev.walkForwardScore.toFixed(2)}, Stability=${ev.stabilityScore.toFixed(2)}`
    );
  }

  return lines;
}
