/**
 * Minimum input contract for a new actionable (BUY/SELL) three-score signal.
 *
 * A legacy blended label is intentionally not a fallback here: a missing score
 * component or an insufficient 52-week raw-close series must result in an
 * explicitly blocked recommendation, not in an apparently precise signal.
 */
export type SignalDataQualityInput = {
  rawPriceRows: number;
  qualityScore: number | null;
  valuationScore: number | null;
  timingScore: number | null;
  corporateActionReason?: string | null;
};

export type SignalDataQualityAssessment = {
  allowed: boolean;
  reasons: string[];
};

export const MIN_RAW_PRICE_ROWS_FOR_ACTIONABLE_SIGNAL = 250;

export function assessSignalDataQuality(input: SignalDataQualityInput): SignalDataQualityAssessment {
  const reasons: string[] = [];
  if (input.rawPriceRows < MIN_RAW_PRICE_ROWS_FOR_ACTIONABLE_SIGNAL) {
    reasons.push(
      `Rohkursreihe nur ${input.rawPriceRows} Handelstage (nötig mindestens ${MIN_RAW_PRICE_ROWS_FOR_ACTIONABLE_SIGNAL} für 52-Wochen-Timing)`,
    );
  }
  if (input.qualityScore === null || !Number.isFinite(input.qualityScore)) {
    reasons.push("Qualitäts-Score nicht berechenbar");
  }
  if (input.valuationScore === null || !Number.isFinite(input.valuationScore)) {
    reasons.push("Bewertungs-Score nicht berechenbar");
  }
  if (input.timingScore === null || !Number.isFinite(input.timingScore)) {
    reasons.push("Timing-Score nicht berechenbar");
  }
  if (input.corporateActionReason) {
    reasons.push(input.corporateActionReason);
  }
  return { allowed: reasons.length === 0, reasons };
}
