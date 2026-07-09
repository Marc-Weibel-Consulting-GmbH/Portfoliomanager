/**
 * Anlegerprofil-Scoring (Konzept INVESTOR_PROFILE_CONCEPT.md, Stufe P1).
 *
 * Reine, testbare Funktionen: aus den Fragebogen-Antworten werden
 * Risikofähigkeit (objektiv), Risikobereitschaft (subjektiv) und Risikobedarf
 * abgeleitet. Das bindende Profil ist das Minimum aus Fähigkeit und
 * Bereitschaft — die Wunschrendite überschreibt die Tragfähigkeit nie.
 */

export type RiskProfile = "konservativ" | "ausgewogen" | "wachstum" | "aggressiv";
export type Goal = "dividends" | "growth" | "balanced";
export type KnowledgeLevel = "einsteiger" | "fortgeschritten" | "erfahren";

export interface ProfileAnswers {
  // Schritt 1 — Ziel & Horizont
  goal: Goal;
  horizonYears: number;
  purpose: "aufbau" | "entnahme" | "vorsorge";
  // Schritt 2 — Finanzielle Situation (Bänder) → Fähigkeit
  wealthBand: "u50" | "b50_250" | "b250_1m" | "o1m";
  savingsRateBand: "keine" | "niedrig" | "mittel" | "hoch";
  liquidityReserveBand: "u3m" | "b3_6m" | "b6_12m" | "o12m";
  incomeStability: "niedrig" | "mittel" | "hoch";
  // Schritt 3 — Risikobereitschaft → Bereitschaft
  drawdownReaction: "nachkaufen" | "halten" | "teilverkauf" | "verkauf";
  lossComfortPct: number; // max. tolerierter Jahresverlust
  experienceWithLosses: "ja_ok" | "ja_unruhig" | "nein";
  // Schritt 4 — Kenntnisse
  knowledgeLevel: KnowledgeLevel;
  // Schritt 5 — Präferenzen
  excludedSectors: string[];
  esgOnly: boolean;
  targetReturnPct: number | null;
  liquidityNeedPct: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// Score (0–100) → eine der vier Stufen. Schwellen bewusst breit für «ausgewogen».
export function scoreToProfile(score: number): RiskProfile {
  if (score < 30) return "konservativ";
  if (score < 55) return "ausgewogen";
  if (score < 80) return "wachstum";
  return "aggressiv";
}

/** Risikofähigkeit (0–100) aus den objektiven Bändern + Horizont. */
export function computeCapacityScore(a: ProfileAnswers): number {
  const wealth = { u50: 25, b50_250: 50, b250_1m: 75, o1m: 95 }[a.wealthBand];
  const savings = { keine: 20, niedrig: 45, mittel: 70, hoch: 90 }[a.savingsRateBand];
  const reserve = { u3m: 20, b3_6m: 50, b6_12m: 80, o12m: 95 }[a.liquidityReserveBand];
  const income = { niedrig: 30, mittel: 60, hoch: 90 }[a.incomeStability];
  // Horizont: < 3 J. drückt stark, ab ~15 J. voll.
  const horizon = clamp((a.horizonYears / 15) * 100, 10, 100);
  // Gewichtung: Horizont & Reserve am wichtigsten (Verlusttragfähigkeit über Zeit).
  const score = 0.28 * horizon + 0.22 * reserve + 0.2 * wealth + 0.15 * savings + 0.15 * income;
  return Math.round(clamp(score, 0, 100));
}

/** Risikobereitschaft (0–100) aus den Szenario-Antworten. */
export function computeToleranceScore(a: ProfileAnswers): number {
  const reaction = { verkauf: 10, teilverkauf: 40, halten: 70, nachkaufen: 95 }[a.drawdownReaction];
  // Verlustkomfort 5–50 % → 0–100.
  const lossComfort = clamp(((a.lossComfortPct - 5) / (50 - 5)) * 100, 0, 100);
  const experience = { nein: 35, ja_unruhig: 55, ja_ok: 90 }[a.experienceWithLosses];
  const score = 0.5 * reaction + 0.3 * lossComfort + 0.2 * experience;
  return Math.round(clamp(score, 0, 100));
}

/** Risikobedarf (0–100) aus der Zielrendite (nur Abgleich, kein Treiber). */
export function computeNeedScore(a: ProfileAnswers): number | null {
  if (a.targetReturnPct == null) return null;
  // 0 % → 0, ~10 %+ p.a. → 100.
  return Math.round(clamp((a.targetReturnPct / 10) * 100, 0, 100));
}

export interface StrategicAllocation { equity: number; bond: number; cash: number; targetVolPct: number; }

// Musterallokationen je Profil (Richtwerte; im Admin konfigurierbar — P3/Folgeschritt).
export const STRATEGIC_ALLOCATIONS: Record<RiskProfile, StrategicAllocation> = {
  konservativ: { equity: 25, bond: 55, cash: 20, targetVolPct: 5 },
  ausgewogen: { equity: 50, bond: 38, cash: 12, targetVolPct: 9 },
  wachstum: { equity: 72, bond: 20, cash: 8, targetVolPct: 13 },
  aggressiv: { equity: 90, bond: 5, cash: 5, targetVolPct: 17 },
};

export interface ProfileResult {
  capacityScore: number;
  toleranceScore: number;
  needScore: number | null;
  bindingScore: number;
  bindingProfile: RiskProfile;
  capacityProfile: RiskProfile;
  toleranceProfile: RiskProfile;
  strategicAllocation: StrategicAllocation;
  /** Fähigkeit begrenzt die Bereitschaft (Wunsch höher als Tragfähigkeit). */
  capacityBinds: boolean;
  /** Bedarf übersteigt die Fähigkeit deutlich → Zielkonflikt. */
  needConflict: boolean;
}

/** Gesamtauswertung. bindingScore = min(Fähigkeit, Bereitschaft). */
export function evaluateProfile(a: ProfileAnswers): ProfileResult {
  const capacityScore = computeCapacityScore(a);
  const toleranceScore = computeToleranceScore(a);
  const needScore = computeNeedScore(a);
  const bindingScore = Math.min(capacityScore, toleranceScore);
  const bindingProfile = scoreToProfile(bindingScore);
  return {
    capacityScore,
    toleranceScore,
    needScore,
    bindingScore,
    bindingProfile,
    capacityProfile: scoreToProfile(capacityScore),
    toleranceProfile: scoreToProfile(toleranceScore),
    strategicAllocation: STRATEGIC_ALLOCATIONS[bindingProfile],
    capacityBinds: capacityScore < toleranceScore,
    needConflict: needScore != null && needScore > capacityScore + 15,
  };
}

/** Aktives user_investment_profile aus Antworten + Auswertung ableiten. */
export function deriveActiveProfile(a: ProfileAnswers, r: ProfileResult) {
  return {
    riskProfile: r.bindingProfile,
    investmentHorizonYears: clamp(Math.round(a.horizonYears), 1, 50),
    maxDrawdownTolerancePct: clamp(Math.round(a.lossComfortPct), 5, 80),
    investmentGoal: a.goal,
    targetReturnPct: a.targetReturnPct,
    liquidityNeedPct: clamp(Math.round(a.liquidityNeedPct), 0, 100),
    excludedSectors: a.excludedSectors ?? [],
    esgOnly: !!a.esgOnly,
  };
}
