import { withTimeout } from "./asyncTimeout";

/** Gesamtes Nutzerzeitbudget inklusive Portfolioanreicherung, EODHD und KI-Zusammenfassung. */
export const DEEP_DIVE_TIMEOUT_MS = 90_000;

export const DEEP_DIVE_TIMEOUT_MESSAGE =
  "Die Deep-Dive-Analyse hat das Zeitlimit von 90 Sekunden überschritten. Bitte versuchen Sie es erneut.";

export function withDeepDiveTimeout<T>(operation: Promise<T>): Promise<T> {
  return withTimeout(operation, DEEP_DIVE_TIMEOUT_MS, DEEP_DIVE_TIMEOUT_MESSAGE);
}
