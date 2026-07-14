/**
 * signalOrchestrator — Zentraler Einstiegspunkt des Signal-Frameworks (Phase 2)
 *
 * Ablauf:
 *  1. Regime klassifizieren (regimeEngine)
 *  2. Alle 4 Signal-Engines berechnen:
 *     - trendSignalEngine (MA-Alignment, ADX, Slope)
 *     - meanReversionSignalEngine (RSI, Stochastik, Bollinger, Z-Score, CCI)
 *     - breakoutSignalEngine (Donchian, ATR-Breakout, Momentum, BB-Squeeze)
 *     - ensembleSignalEngine (Regime-gewichtete Kombination)
 *  3. modelSelector: beste Engine per Walk-Forward-Evaluation wählen
 *  4. Risk Overlay anwenden (riskOverlayEngine)
 *  5. Finale PortfolioAction erzeugen
 *
 * Alle Zwischenergebnisse werden in PortfolioAction.signalOutputs gespeichert
 * für vollständige Auditierbarkeit.
 */

import { computeRegime } from "./regimeEngine";
import { computeTrendSignal } from "./trendSignalEngine";
import { computeMeanReversionSignal } from "./meanReversionSignalEngine";
import { computeBreakoutSignal } from "./breakoutSignalEngine";
import { computeEnsembleSignal } from "./ensembleSignalEngine";
import { computeRiskOverlay, applyRiskOverlay } from "./riskOverlayEngine";
import { selectBestModel } from "./modelSelector";
import type {
  OrchestratorInput,
  PortfolioAction,
  PortfolioActionType,
  RiskOverlayResult,
  SignalEngineType,
  SignalOutput,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

function scoreToAction(
  rawScore: number,
  confidence: number,
  entry: boolean,
  exit: boolean
): PortfolioActionType {
  if (exit && rawScore < -0.3) return "sell";
  if (exit && rawScore < 0) return "reduce";
  if (rawScore > 0.6 && confidence > 0.65 && entry) return "buy";
  if (rawScore > 0.3 && confidence > 0.5 && entry) return "add";
  if (rawScore < -0.6 && confidence > 0.65) return "sell";
  if (rawScore < -0.3 && confidence > 0.5) return "reduce";
  return "hold";
}

function toRiskOverlayResult(
  dampingFactor: number,
  blockEntry: boolean,
  warnings: string[]
): RiskOverlayResult {
  let decision: RiskOverlayResult["decision"] = "allow";
  if (blockEntry && dampingFactor < 0.4) decision = "block";
  else if (blockEntry) decision = "reduce";
  else if (dampingFactor < 0.8) decision = "reduce";

  return {
    decision,
    convictionMultiplier: dampingFactor,
    targetExposureMultiplier: blockEntry ? 0 : dampingFactor,
    rationale: warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Haupt-Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

export function runSignalOrchestrator(input: OrchestratorInput): PortfolioAction {
  const { ticker, prices, lpplRisk, qualityScore, momentumScore } = input;
  const now = new Date().toISOString();

  // ── 1. Regime klassifizieren ─────────────────────────────────────────────
  const regimeSnapshot = computeRegime(
    prices,
    lpplRisk ?? null,
    new Date().toISOString().slice(0, 10)
  );

  // ── 2. Alle 4 Signal-Engines berechnen ───────────────────────────────────
  const trendSignal = computeTrendSignal(prices, regimeSnapshot.regime);
  const meanRevSignal = computeMeanReversionSignal(prices, regimeSnapshot.regime);
  const breakoutSignal = computeBreakoutSignal(prices, regimeSnapshot.regime);
  const ensembleSignal = computeEnsembleSignal(prices, regimeSnapshot.regime);

  // ── 3. modelSelector: beste Engine wählen ────────────────────────────────
  const signalMap = new Map<SignalEngineType, SignalOutput>([
    ["trend", trendSignal],
    ["mean_reversion", meanRevSignal],
    ["breakout", breakoutSignal],
    ["ensemble", ensembleSignal],
  ]);

  // SIG-7: gelernte Engine-Priors des aktuellen Regimes (falls vom Aufrufer
  // geladen) ersetzen die hartkodierten Defaults im Selector.
  const learnedPriors = input.learnedEnginePriorsByRegime?.[regimeSnapshot.regime] ?? null;
  const modelSelection = selectBestModel(prices, regimeSnapshot.regime, signalMap, learnedPriors);
  const selectedSignal = modelSelection.selectedSignal;

  // ── 4. Risk Overlay ──────────────────────────────────────────────────────
  const overlay = computeRiskOverlay(prices, regimeSnapshot.regime, lpplRisk ?? null);
  const adjustedSignal = applyRiskOverlay(selectedSignal, overlay);

  const riskOverlayResult = toRiskOverlayResult(
    overlay.dampingFactor,
    overlay.blockEntry,
    overlay.warnings
  );

  // ── 5. Finale Aktion ─────────────────────────────────────────────────────
  const action = scoreToAction(
    adjustedSignal.rawScore,
    adjustedSignal.confidence,
    adjustedSignal.entry,
    adjustedSignal.exit
  );

  // ── Audit-Trail ──────────────────────────────────────────────────────────
  const triggeredBy: string[] = [];
  if (trendSignal.direction !== 0) triggeredBy.push("trendSignalEngine");
  if (meanRevSignal.direction !== 0) triggeredBy.push("meanReversionSignalEngine");
  if (breakoutSignal.direction !== 0) triggeredBy.push("breakoutSignalEngine");
  if (ensembleSignal.direction !== 0) triggeredBy.push("ensembleSignalEngine");
  if (overlay.warnings.length > 0) triggeredBy.push("riskOverlayEngine");

  // Rationale: modelSelector-Begründung + ausgewähltes Signal
  const combinedRationale = [
    `── ModelSelector ──`,
    ...modelSelection.rationale,
    ``,
    `── ${modelSelection.selectedEngine} Signal ──`,
    ...adjustedSignal.rationale,
  ];

  const signalOutputs: SignalOutput[] = [
    trendSignal,
    meanRevSignal,
    breakoutSignal,
    ensembleSignal,
    adjustedSignal,
  ];

  return {
    ticker,
    action,
    conviction: adjustedSignal.confidence,
    rationale: combinedRationale,
    triggeredBy,
    regime: regimeSnapshot.regime,
    regimeConfidence: regimeSnapshot.confidence,
    selectedModel: modelSelection.selectedEngine,
    rawScore: selectedSignal.rawScore,
    adjustedScore: adjustedSignal.rawScore,
    targetWeight: null, // V3: Portfolio-Optimierer
    stopLossPct: adjustedSignal.stopLossPct,
    takeProfitPct: adjustedSignal.takeProfitPct,
    regimeFeatures: regimeSnapshot.features,
    signalOutputs,
    riskOverlay: riskOverlayResult,
    computedAt: now,
  };
}
