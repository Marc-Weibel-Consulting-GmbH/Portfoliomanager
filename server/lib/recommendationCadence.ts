/**
 * Kadenz-Logik für wiederkehrende Transaktions-Empfehlungen (Track D / P3).
 * Rein und deterministisch (Zeit wird injiziert) — für UI-Anzeige ("nächste Aktualisierung")
 * und den späteren Cron.
 */

export type Cadence = "off" | "weekly" | "monthly" | "quarterly";

/** Intervall in Tagen. "off" = nie fällig. */
export function cadenceDays(cadence: Cadence): number {
  switch (cadence) {
    case "weekly": return 7;
    case "monthly": return 30;
    case "quarterly": return 91;
    default: return Infinity;
  }
}

/** Nächster Fälligkeitszeitpunkt (ms) oder null bei "off". */
export function nextDueMs(cadence: Cadence, lastGeneratedAtMs: number | null): number | null {
  if (cadence === "off") return null;
  // Nie generiert → sofort fällig, aber es gibt keinen sinnvollen Termin dafür.
  // Vorher lief hier 0 als Basis mit, was 0 + 7 Tage = 08.01.1970 ergab und in
  // der Ansicht als «Nächste Aktualisierung fällig: 08.01.1970» erschien.
  // `isDue()` prüft den Null-Fall ohnehin separat und bleibt unberührt.
  if (lastGeneratedAtMs == null) return null;
  return lastGeneratedAtMs + cadenceDays(cadence) * 86_400_000;
}

/** Ist die nächste Empfehlungsliste fällig? */
export function isDue(cadence: Cadence, lastGeneratedAtMs: number | null, nowMs: number): boolean {
  if (cadence === "off") return false;
  if (lastGeneratedAtMs == null) return true; // noch nie generiert
  const due = nextDueMs(cadence, lastGeneratedAtMs);
  return due != null && nowMs >= due;
}

const LABELS: Record<Cadence, string> = {
  off: "Aus",
  weekly: "Wöchentlich",
  monthly: "Monatlich",
  quarterly: "Quartalsweise",
};

export function cadenceLabel(cadence: Cadence): string {
  return LABELS[cadence] ?? cadence;
}
