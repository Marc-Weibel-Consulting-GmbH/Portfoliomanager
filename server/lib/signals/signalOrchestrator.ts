/**
 * signalOrchestrator — Zentraler Einstiegspunkt des Signal-Frameworks
 *
 * Ablauf:
 *  1. Regime klassifizieren (regimeEngine)
 *  2. Ensemble-Signal berechnen (ensembleSignalEngine, regime-aware)
 *  3. Risk Overlay anwenden (riskOverlayEngine)
 *  4. Finale PortfolioAction erzeugen
 *
 * Alle Zwischenergebnisse werden in PortfolioAction.signalOutputs gespeichert
 * für vollständige Auditierbarkeit.
 */

import { computeRegime } from "./regimeEngine";
import { computeTrendSignal } from "./trendSignalEngine";
import { computeEnsembleSignal } from "./ensembleSignalEngine";
import { computeRiskOverlay, applyRiskOverlay } from "./riskOverlayEngine";
import type {
  OrchestratorInput,
  PortfolioAction,
  PortfolioActionType,
  RiskOverlayResult,
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
  // computeRegime(prices, lpplRisk?, date?) → RegimeSnapshot
  const regimeSnapshot = computeRegime(
    prices,
    lpplRisk ?? null,
    new Date().toISOString().slice(0, 10)
  );

  // ── 2. Trend-Signal (für signalOutputs Audit-Trail) ──────────────────────
  const trendSignal = computeTrendSignal(prices, regimeSnapshot.regime);

  // ── 3. Ensemble-Signal ───────────────────────────────────────────────────
  // computeEnsembleSignal(prices, regime) → SignalOutput
  const ensembleSignal = computeEnsembleSignal(prices, regimeSnapshot.regime);

  // ── 4. Risk Overlay ──────────────────────────────────────────────────────
  const overlay = computeRiskOverlay(prices, regimeSnapshot.regime, lpplRisk ?? null);
  const adjustedEnsemble = applyRiskOverlay(ensembleSignal, overlay);

  const riskOverlayResult = toRiskOverlayResult(
    overlay.dampingFactor,
    overlay.blockEntry,
    overlay.warnings
  );

  // ── 5. Finale Aktion ─────────────────────────────────────────────────────
  const action = scoreToAction(
    adjustedEnsemble.rawScore,
    adjustedEnsemble.confidence,
    adjustedEnsemble.entry,
    adjustedEnsemble.exit
  );

  const triggeredBy: string[] = [];
  if (trendSignal.direction !== 0) triggeredBy.push("trendSignalEngine");
  if (ensembleSignal.direction !== 0) triggeredBy.push("ensembleSignalEngine");
  if (overlay.warnings.length > 0) triggeredBy.push("riskOverlayEngine");

  const signalOutputs: SignalOutput[] = [trendSignal, ensembleSignal, adjustedEnsemble];

  return {
    ticker,
    action,
    conviction: adjustedEnsemble.confidence,
    rationale: adjustedEnsemble.rationale,
    triggeredBy,
    regime: regimeSnapshot.regime,
    regimeConfidence: regimeSnapshot.confidence,
    selectedModel: "ensemble",
    rawScore: ensembleSignal.rawScore,
    adjustedScore: adjustedEnsemble.rawScore,
    targetWeight: null, // V2: Portfolio-Optimierer
    stopLossPct: adjustedEnsemble.stopLossPct,
    takeProfitPct: adjustedEnsemble.takeProfitPct,
    regimeFeatures: regimeSnapshot.features,
    signalOutputs,
    riskOverlay: riskOverlayResult,
    computedAt: now,
  };
}
