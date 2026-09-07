import { describe, expect, it } from 'vitest';
import { buildTenYearHistoryBackfillPlan, filterStrictlyMissingHistoryDays, filterUnpersistedHistoryDays, findEarliestNormalizedHistoryDate } from './historicalBackfillPlan';

describe('buildTenYearHistoryBackfillPlan', () => {
  const asOf = '2026-09-07';

  it('fordert keinen Import an, wenn ein Titel am oder vor dem Stichtag bereits Kurse hat', () => {
    expect(buildTenYearHistoryBackfillPlan({ ticker: 'NESN.SW', earliestDate: '2015-12-31', asOfDate: asOf })).toBeNull();
  });

  it('füllt bei einer zu kurzen Reihe nur die fehlende Vorperiode mit einem Handelstags-Puffer nach', () => {
    expect(buildTenYearHistoryBackfillPlan({ ticker: 'NTRA.US', earliestDate: '2019-07-01', asOfDate: asOf })).toEqual({
      ticker: 'NTRA.US',
      historyCutoffDate: '2016-09-07',
      fromDate: '2016-08-31',
      toDate: '2019-06-30',
      reason: 'earliest_price_after_ten_year_cutoff',
    });
  });

  it('plant für einen Titel ohne lokale Kursreihe den gesamten 10-Jahres-Zeitraum', () => {
    expect(buildTenYearHistoryBackfillPlan({ ticker: 'BHP.AX', earliestDate: null, asOfDate: asOf })).toEqual({
      ticker: 'BHP.AX',
      historyCutoffDate: '2016-09-07',
      fromDate: '2016-08-31',
      toDate: '2026-09-07',
      reason: 'no_local_history',
    });
  });

  it('erkennt bereits gespeicherte US-Historie auch bei einem Empfehlungsticker ohne Suffix', () => {
    expect(findEarliestNormalizedHistoryDate('RMD', [
      { ticker: 'RMD.US', earliestDate: '2003-01-02' },
      { ticker: 'NESN.SW', earliestDate: '1995-01-03' },
    ])).toBe('2003-01-02');
  });

  it('filtert den bereits gespeicherten ersten Kurstag strikt aus einem Backfillbatch heraus', () => {
    expect(filterStrictlyMissingHistoryDays([
      { date: '2016-08-31', close: 10 },
      { date: '2019-06-29', close: 20 },
      { date: '2019-06-30', close: 21 },
    ], '2019-06-30')).toEqual([
      { date: '2016-08-31', close: 10 },
      { date: '2019-06-29', close: 20 },
    ]);
  });

  it('lässt bei einem wiederholten Backfill weder persistierte noch doppelte EODHD-Tage in den Insertbatch', () => {
    expect(filterUnpersistedHistoryDays([
      { date: '2017-01-03', close: 10 },
      { date: '2017-01-03', close: 10.1 },
      { date: '2017-01-04', close: 11 },
      { date: '2017-01-05', close: 12 },
    ], ['2017-01-04'])).toEqual([
      { date: '2017-01-03', close: 10 },
      { date: '2017-01-05', close: 12 },
    ]);
  });
});
