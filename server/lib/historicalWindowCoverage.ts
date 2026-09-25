export type HistoricalWindowCoverageReason = "starts_too_late" | "ends_too_early" | "no_valid_dates" | null;

export interface HistoricalWindowCoverageInput {
  historyDates: readonly string[];
  requiredStartDate: string;
  requiredEndDate: string;
  /** Feiertage und unterschiedliche Börsenkalender dürfen am Fensterende/-anfang kurz abweichen. */
  maxBoundaryGapCalendarDays?: number;
}

export interface HistoricalWindowCoverage {
  hasFullRequestedWindow: boolean;
  firstDate: string | null;
  lastDate: string | null;
  reason: HistoricalWindowCoverageReason;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Internationale Börsenkalender und FX-Feiertage lassen einzelne gemeinsame
 * Handelstage aus. Eine Entscheidungsbasis darf deshalb nicht exakt 252 Tage
 * pro Jahr verlangen. 85 % der angeforderten Jahres-Handelstage lässt normale
 * Kalenderunterschiede zu, sperrt aber Teilreihen wie 195 Tage für ein
 * angebliches Fünfjahresfenster.
 */
export const MIN_COMMON_RETURN_COVERAGE_RATIO = 0.85;

export interface CommonReturnCoverageInput {
  requestedLookbackDays: number;
  commonReturnDays: number | null | undefined;
}

export function minimumCommonReturnDays(requestedLookbackDays: number): number {
  if (!Number.isInteger(requestedLookbackDays) || requestedLookbackDays < 1) {
    throw new Error("Die angeforderten Handelstage müssen eine positive ganze Zahl sein.");
  }
  return Math.ceil(requestedLookbackDays * MIN_COMMON_RETURN_COVERAGE_RATIO);
}

/**
 * Prüft die tatsächlich nach Kurs-, FX- und Kalenderabgleich verfügbare
 * Renditeschnittmenge. Sie ist strenger und aussagekräftiger als die reine
 * Start-/Endabdeckung einer Rohkursreihe.
 */
export function hasSufficientCommonReturnCoverage(input: CommonReturnCoverageInput): boolean {
  if (!Number.isFinite(input.commonReturnDays) || (input.commonReturnDays ?? 0) < 0) return false;
  return (input.commonReturnDays ?? 0) >= minimumCommonReturnDays(input.requestedLookbackDays);
}

function asUtcDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function calendarDaysBetween(start: string, end: string): number | null {
  const startDate = asUtcDate(start);
  const endDate = asUtcDate(end);
  if (!startDate || !endDate) return null;
  return Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS);
}

/**
 * Prüft ausschliesslich die dokumentierbare Abdeckung eines angeforderten
 * Kalenderfensters. Die Funktion trifft keine Auswahl- oder Anlageentscheidung.
 */
export function assessHistoricalWindowCoverage(input: HistoricalWindowCoverageInput): HistoricalWindowCoverage {
  const maxBoundaryGap = input.maxBoundaryGapCalendarDays ?? 10;
  if (!Number.isInteger(maxBoundaryGap) || maxBoundaryGap < 0) {
    throw new Error("Die zulässige Randlücke muss eine nicht negative ganze Tageszahl sein.");
  }

  const validDates = Array.from(new Set(input.historyDates.filter((date) => asUtcDate(date) != null))).sort();
  const firstDate = validDates.at(0) ?? null;
  const lastDate = validDates.at(-1) ?? null;
  if (!firstDate || !lastDate) {
    return { hasFullRequestedWindow: false, firstDate, lastDate, reason: "no_valid_dates" };
  }

  const startGap = calendarDaysBetween(input.requiredStartDate, firstDate);
  if (startGap == null || startGap > maxBoundaryGap) {
    return { hasFullRequestedWindow: false, firstDate, lastDate, reason: "starts_too_late" };
  }

  const endGap = calendarDaysBetween(lastDate, input.requiredEndDate);
  if (endGap == null || endGap > maxBoundaryGap) {
    return { hasFullRequestedWindow: false, firstDate, lastDate, reason: "ends_too_early" };
  }
  return { hasFullRequestedWindow: true, firstDate, lastDate, reason: null };
}
