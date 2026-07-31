/**
 * RESEARCH SPIKE — Issue #205: Intramonth Momentum Cycle
 * =========================================================
 * Hypothesis: Momentum returns concentrate on 6 specific trading days per month
 * due to institutional cash-management practices (Alpha Architect / Heston et al.).
 *
 * The 6 "active" days are defined WITHOUT look-ahead as:
 *   - Last 2 trading days of the month (t-2, t-1 relative to month-end)
 *   - First 4 trading days of the next month (t+1, t+2, t+3, t+4)
 * This matches the published definition and avoids look-ahead bias because
 * we only use the calendar position of the current day, not future prices.
 *
 * FEATURE FLAG: FEATURE_INTRAMONTH_MOMENTUM (default: false)
 * DO NOT activate in production without human review of backtest results.
 */

/**
 * FEATURE FLAG: Intramonth Momentum Cycle (Issue #205)
 * Set via environment variable FEATURE_INTRAMONTH_MOMENTUM=true to enable.
 * Default: false.
 */
export const FEATURE_INTRAMONTH_MOMENTUM = process.env.FEATURE_INTRAMONTH_MOMENTUM === 'true';

/**
 * Determine whether a given date falls on one of the 6 "active" intramonth
 * momentum days (last 2 trading days of month + first 4 of next month).
 *
 * Implementation: We approximate trading days by excluding weekends only
 * (no holiday calendar — conservative approximation).
 *
 * @param date  The date to check
 * @returns     true if this is an active intramonth momentum day
 */
export function isIntramonthMomentumDay(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed

  // Get last calendar day of current month
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Walk back to find last 2 trading days of month
  const lastTradingDays: Date[] = [];
  let d = new Date(lastDayOfMonth);
  while (lastTradingDays.length < 2) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) { // not weekend
      lastTradingDays.push(new Date(d));
    }
    d.setDate(d.getDate() - 1);
  }

  // Walk forward to find first 4 trading days of next month
  const firstTradingDaysNextMonth: Date[] = [];
  let d2 = new Date(year, month + 1, 1); // first day of next month
  while (firstTradingDaysNextMonth.length < 4) {
    const dow = d2.getDay();
    if (dow !== 0 && dow !== 6) {
      firstTradingDaysNextMonth.push(new Date(d2));
    }
    d2.setDate(d2.getDate() + 1);
  }

  const activeDays = [...lastTradingDays, ...firstTradingDaysNextMonth];
  const dateStr = date.toISOString().substring(0, 10);
  return activeDays.some(ad => ad.toISOString().substring(0, 10) === dateStr);
}

/**
 * Calculate intramonth momentum score for a given date and price series.
 * On active days: returns the standard momentum score amplified by 1.5x.
 * On inactive days: returns 0 (flat/no signal).
 *
 * This implements the simplest possible version of the hypothesis:
 * "momentum signal is only valid on the 6 active days per month."
 *
 * @param prices  Historical prices (most recent last)
 * @param date    The current date
 * @returns       Momentum score adjusted for intramonth cycle
 */
export function calcIntramonthMomentumScore(
  prices: number[],
  date: Date
): { value: number | null; score: number; label: string; isActiveDay: boolean } {
  const isActive = isIntramonthMomentumDay(date);

  if (!isActive) {
    return { value: 0, score: 0, label: 'Inaktiver Tag', isActiveDay: false };
  }

  // On active days: use 6M momentum (126 trading days) as the base signal
  const LOOKBACK = 126;
  if (prices.length < LOOKBACK + 1) {
    return { value: null, score: 0, label: 'N/A (Intramonth)', isActiveDay: true };
  }
  const current = prices[prices.length - 1];
  const past = prices[prices.length - 1 - LOOKBACK];
  if (!current || !past || past === 0) {
    return { value: null, score: 0, label: 'N/A (Intramonth)', isActiveDay: true };
  }

  const returnPct = ((current - past) / past) * 100;
  // Amplified scoring on active days (1.5x the standard thresholds)
  let score: number;
  let label: string;
  if (returnPct >= 27) { score = 1.0; label = `+${returnPct.toFixed(1)}% Intramonth (Stark)`; }
  else if (returnPct >= 13) { score = 0.7; label = `+${returnPct.toFixed(1)}% Intramonth`; }
  else if (returnPct >= 5) { score = 0.4; label = `+${returnPct.toFixed(1)}% Intramonth`; }
  else if (returnPct >= 0) { score = 0.1; label = `+${returnPct.toFixed(1)}% Intramonth`; }
  else if (returnPct >= -5) { score = -0.1; label = `${returnPct.toFixed(1)}% Intramonth`; }
  else if (returnPct >= -13) { score = -0.5; label = `${returnPct.toFixed(1)}% Intramonth (Schwach)`; }
  else { score = -0.9; label = `${returnPct.toFixed(1)}% Intramonth (Crash)`; }

  return { value: returnPct, score, label, isActiveDay: true };
}
