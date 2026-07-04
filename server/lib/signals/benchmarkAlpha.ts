/**
 * Benchmark-Alpha-Helfer (F-14)
 * =============================
 * Reine Funktionen für die Alpha-Messung im signalEvaluationCron:
 *   - computeWindowReturn: Benchmark-Return über ein Datumsfenster aus
 *     täglichen Schlusskursen (benchmarkData / historical_prices Format).
 *   - computeAlpha: Alpha = tatsächlicher Return − Benchmark-Return.
 *
 * Returns sind Dezimalbrüche (0.05 = +5%), konsistent mit
 * signal_history.actualReturnPct.
 */

export interface DailyClose {
  date: string; // YYYY-MM-DD
  close: string | number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / MS_PER_DAY;
}

function toNumber(close: string | number): number | null {
  const n = typeof close === "number" ? close : parseFloat(close);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Berechnet den Benchmark-Return über [startDate, endDate].
 *
 * Startkurs: letzter Schlusskurs am/vor startDate; fehlt dieser, der erste
 * Kurs danach (max. maxGapDays entfernt). Endkurs: letzter Schlusskurs
 * am/vor endDate (max. maxGapDays alt — sonst gelten die Daten als stale).
 *
 * Gibt null zurück, wenn kein plausibles Fenster gebildet werden kann.
 */
export function computeWindowReturn(
  rows: DailyClose[],
  startDate: string,
  endDate: string,
  maxGapDays = 7
): number | null {
  if (!rows.length || startDate >= endDate) return null;

  // Nach Datum sortieren und ungültige Kurse verwerfen
  const sorted = rows
    .map((r) => ({ date: r.date, close: toNumber(r.close) }))
    .filter((r): r is { date: string; close: number } => r.close !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;

  // Startkurs: letzter Kurs <= startDate, sonst erster danach (innerhalb Toleranz)
  let start: { date: string; close: number } | null = null;
  for (const row of sorted) {
    if (row.date <= startDate) start = row;
    else break;
  }
  if (start && daysBetween(start.date, startDate) > maxGapDays) start = null;
  if (!start) {
    const after = sorted.find((r) => r.date > startDate);
    if (after && daysBetween(after.date, startDate) <= maxGapDays) start = after;
  }
  if (!start) return null;

  // Endkurs: letzter Kurs <= endDate
  let end: { date: string; close: number } | null = null;
  for (const row of sorted) {
    if (row.date <= endDate) end = row;
    else break;
  }
  if (!end || daysBetween(end.date, endDate) > maxGapDays) return null;
  if (end.date <= start.date) return null;

  return (end.close - start.close) / start.close;
}

/**
 * Alpha = tatsächlicher Return − Benchmark-Return (beides Dezimalbrüche).
 */
export function computeAlpha(
  actualReturn: number | null,
  benchmarkReturn: number | null
): number | null {
  if (actualReturn === null || benchmarkReturn === null) return null;
  if (!Number.isFinite(actualReturn) || !Number.isFinite(benchmarkReturn)) return null;
  return actualReturn - benchmarkReturn;
}
