/**
 * Optimierungsengine-Kennzahlen wie Volatilität werden als Dezimalbrüche
 * zurückgegeben (z. B. 0.1636). Die vollständige Vorschau zeigt sie in Prozent.
 */
export function formatFullReoptimizationFraction(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export interface FullReoptimizationReturnEvidenceInput {
  requestedLookbackDays: number;
  historicalAnnualizedReturn: number | null | undefined;
  /** Vom serverseitigen Kandidaten-Gate nach Kalenderdaten bestätigte Vollabdeckung. */
  hasFullRequestedWindow?: boolean;
  basis: {
    jahreMin: number;
    jahreMedian: number;
    gemeinsameTage: number;
  } | null | undefined;
}

/**
 * Beschreibt die tatsächlich verwendete Basis der historischen, hypothetisch
 * täglich rebalancierten Aktienrendite. Ein Engine-Erwartungswert darf nicht
 * als langfristige Portfolioperformance ausgegeben werden.
 */
export function getFullReoptimizationReturnEvidence(input: FullReoptimizationReturnEvidenceInput) {
  const requestedYears = input.requestedLookbackDays / 252;
  const basis = input.basis;
  const value = typeof input.historicalAnnualizedReturn === "number" && Number.isFinite(input.historicalAnnualizedReturn)
    ? formatFullReoptimizationFraction(input.historicalAnnualizedReturn)
    : "keine belastbare Kennzahl";
  const hasRequestedHistory = Boolean(
    basis
    && basis.jahreMin >= requestedYears - 0.05
    && (
      input.hasFullRequestedWindow === true
      || (input.hasFullRequestedWindow === undefined && basis.gemeinsameTage >= input.requestedLookbackDays - 1)
    ),
  );
  const basisText = basis
    ? `${basis.jahreMin.toFixed(1)} Jahre mindestens · ${basis.jahreMedian.toFixed(1)} Jahre Median · ${basis.gemeinsameTage} gemeinsame Handelstage`
    : "Historienbasis nicht nachgewiesen";

  return {
    label: "Historische Rendite p.a. (hypothetisch)",
    value,
    requestedYears,
    hasRequestedHistory,
    basisText,
  };
}
