import { normalizeTickerForDb } from '../tickerNormalization';

export interface TenYearHistoryBackfillInput {
  ticker: string;
  earliestDate: string | null;
  asOfDate: string;
}

export interface TenYearHistoryBackfillPlan {
  ticker: string;
  historyCutoffDate: string;
  fromDate: string;
  toDate: string;
  reason: 'no_local_history' | 'earliest_price_after_ten_year_cutoff';
}

export interface HistoricalCoverageRow {
  ticker: string;
  earliestDate: string | null;
}

/** Minimal date-bearing shape returned by the EODHD end-of-day endpoint. */
export interface HistoricalBackfillDay {
  date: string;
}

/** Resolves stock-master tickers to the canonical historical-price key. */
export function findEarliestNormalizedHistoryDate(
  ticker: string,
  rows: HistoricalCoverageRow[],
): string | null {
  const normalizedTicker = normalizeTickerForDb(ticker);
  return rows.find(row => normalizeTickerForDb(row.ticker) === normalizedTicker)?.earliestDate ?? null;
}

/**
 * Keeps only dates that are strictly older than the locally known first day.
 * EODHD may include interval boundaries even when `to` is supplied; inserting
 * that boundary would violate the unique ticker/date key and discard a batch.
 */
export function filterStrictlyMissingHistoryDays<T extends HistoricalBackfillDay>(
  days: T[],
  earliestExistingDate: string | null,
): T[] {
  if (!earliestExistingDate) return days;
  return days.filter(day => day.date < earliestExistingDate);
}

/**
 * Removes days already written by an earlier, interrupted run and collapses
 * duplicate dates returned by the vendor. The first vendor observation wins;
 * existing database values are never replaced by this additive backfill.
 */
export function filterUnpersistedHistoryDays<T extends HistoricalBackfillDay>(
  days: T[],
  persistedDates: Iterable<string>,
): T[] {
  const seenDates = new Set(persistedDates);
  return days.filter(day => {
    if (seenDates.has(day.date)) return false;
    seenDates.add(day.date);
    return true;
  });
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftCalendarDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

/**
 * Defines the missing price interval for a strict ten-calendar-year gate.
 *
 * A seven-day pre-cutoff buffer is intentional: exchanges may be closed on the
 * exact calendar anniversary, but an earlier trading day still proves that the
 * series spans the requested period. Existing price dates are never included.
 */
export function buildTenYearHistoryBackfillPlan(
  input: TenYearHistoryBackfillInput,
): TenYearHistoryBackfillPlan | null {
  const referenceDate = new Date(`${input.asOfDate}T00:00:00.000Z`);
  referenceDate.setUTCFullYear(referenceDate.getUTCFullYear() - 10);
  const historyCutoffDate = toIsoDate(referenceDate);

  if (input.earliestDate && input.earliestDate <= historyCutoffDate) {
    return null;
  }

  const toDate = input.earliestDate
    ? shiftCalendarDate(input.earliestDate, -1)
    : input.asOfDate;
  const fromDate = shiftCalendarDate(historyCutoffDate, -7);

  if (toDate < fromDate) return null;

  return {
    ticker: input.ticker,
    historyCutoffDate,
    fromDate,
    toDate,
    reason: input.earliestDate ? 'earliest_price_after_ten_year_cutoff' : 'no_local_history',
  };
}
