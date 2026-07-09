/**
 * Profil → Optimizer-Parameter (Anlegerprofil 2.0, Stufe P3).
 *
 * Zentrale, reine Ableitung, wie das aktive Anlageprofil den Optimizer und das
 * Scoring steuert. Wird von analytics.optimize und autoPortfolio.buildProposal
 * genutzt — eine Quelle statt verstreuter Ad-hoc-Regeln.
 *
 * Wichtig: verschärft nur (engere Caps für vorsichtige Profile), lockert nie über
 * den Admin-Cap hinaus. Ohne Profil greifen die Defaults → Standardverhalten bleibt.
 */

export interface ActiveProfileForOptimizer {
  riskProfile: "konservativ" | "ausgewogen" | "wachstum" | "aggressiv";
  maxDrawdownTolerancePct: number;
  investmentHorizonYears: number;
}

export interface BaseRulesForOptimizer {
  maxPositionPercent: number;   // Admin-Cap in %
  minPositionPercent: number;   // Admin-Untergrenze in %
  minPositionAmountCHF: number; // Admin-Mindestgrösse
}

export interface ProfileOptimizerParams {
  method: "max_sharpe" | "min_variance";
  minPositionWeight: number; // Anteil 0..1
  maxPositionWeight: number; // Anteil 0..1
  minPositionChf: number;
  momentumWeight: number; // Scoring-Gewicht Momentum
  qualityWeight: number;  // Scoring-Gewicht Qualität
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function optimizerParamsForProfile(
  p: ActiveProfileForOptimizer,
  rules: BaseRulesForOptimizer,
): ProfileOptimizerParams {
  // Methode aus dem Risikoprofil (nur DB-basierte Methoden — kein Yahoo).
  const method: "max_sharpe" | "min_variance" =
    p.riskProfile === "konservativ" ? "min_variance" : "max_sharpe";

  const minW = rules.minPositionPercent / 100;
  const baseMax = rules.maxPositionPercent / 100;

  // Drawdown-Toleranz verschärft die Einzelposition-Obergrenze. Faktor = 1 bei
  // «normaler» Toleranz (≥ 20 %), tiefer (engere Caps) bei geringer Toleranz.
  const factor = clamp(0.6 + p.maxDrawdownTolerancePct / 50, 0.6, 1);
  const maxW = Math.max(minW * 2, baseMax * factor);

  // Horizont: kurz → mehr Momentum, lang → mehr Qualität. Summe bleibt 0.8
  // (die übrigen 0.2 sind der LPPL-Malus im Scoring).
  let momentumWeight = 0.4;
  let qualityWeight = 0.4;
  if (p.investmentHorizonYears <= 5) {
    momentumWeight = 0.5;
    qualityWeight = 0.3;
  } else if (p.investmentHorizonYears >= 12) {
    momentumWeight = 0.3;
    qualityWeight = 0.5;
  }

  return {
    method,
    minPositionWeight: minW,
    maxPositionWeight: maxW,
    minPositionChf: rules.minPositionAmountCHF,
    momentumWeight,
    qualityWeight,
  };
}
