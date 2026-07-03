/**
 * Unified holdings reconstruction from transactions (D-01).
 *
 * ONE replay loop for "which positions (and how many shares) does this
 * portfolio hold (as of a date)?" — previously re-implemented inline ~45x
 * across 16 files (dashboardRouter alone 13x), with drifting edge semantics.
 *
 * Share semantics are identical to the per-day logic of
 * `performanceEngine.buildHoldingsTimeline` and to
 * `dividendCalendarRouter.aggregateHoldingsFromTransactions`:
 * - `buy` and `entry` add shares, `sell` subtracts shares.
 * - Rows without a ticker and all other transaction types (deposit,
 *   withdrawal, dividend, ...) are ignored.
 * - Shares are NOT clamped at 0: an oversell leaves a negative share count in
 *   the map (matching performanceEngine); consumers filter `shares <= 0`.
 * - Edge difference between the two references: aggregateHoldingsFromTransactions
 *   skips non-finite share values, buildHoldingsTimeline would propagate NaN.
 *   We keep the guard (non-finite shares count as 0) — identical to
 *   performanceEngine on every valid input, without NaN poisoning.
 *
 * Additionally tracks `totalCostLocal`: the position's remaining cost basis in
 * LOCAL currency, accumulated as shares x pricePerShare on buys/entries and
 * reduced by the moving-average cost of sold shares on sells (proportional
 * reduction). Unlike the legacy inline variants, the sell reduction is
 * CLAMPED: selling more shares than held (or selling into an empty position)
 * reduces the cost basis at most to 0 — never negative, never NaN (R-20
 * class). Consumers that only need share counts can ignore this field.
 *
 * The replay is chronological regardless of input order: transactions are
 * sorted ascending by transactionDate internally (DB reads often return DESC,
 * which silently broke order-dependent inline replays — R-06 class).
 */

/** Minimal structural shape of a transaction row as read from the DB. */
export interface HoldingsSourceTransaction {
  transactionType: string;
  transactionDate: Date | string;
  ticker?: string | null;
  shares?: string | null;
  pricePerShare?: string | null;
}

export interface HoldingPosition {
  /** Net shares held (may be negative after an oversell — filter `<= 0`). */
  shares: number;
  /** Remaining cost basis in LOCAL currency (moving average, clamped >= 0). */
  totalCostLocal: number;
}

function toIsoDate(date: Date | string): string {
  return typeof date === "string"
    ? date.split("T")[0]
    : date.toISOString().split("T")[0];
}

function toNum(value: string | null | undefined): number {
  const n = parseFloat(value || "0");
  return Number.isFinite(n) ? n : 0;
}

/**
 * Replay buy/entry/sell transactions chronologically into the current
 * holdings map.
 *
 * @param transactions Transaction rows (any order; sorted internally).
 * @param upToDate Optional inclusive cutoff (YYYY-MM-DD): transactions dated
 *   after this day are ignored — yields the holdings AS OF that date.
 * @returns Map ticker -> { shares, totalCostLocal }.
 */
export function buildHoldings(
  transactions: HoldingsSourceTransaction[],
  upToDate?: string
): Map<string, HoldingPosition> {
  const sorted = [...transactions].sort((a, b) =>
    toIsoDate(a.transactionDate).localeCompare(toIsoDate(b.transactionDate))
  );

  const holdings = new Map<string, HoldingPosition>();

  for (const tx of sorted) {
    if (!tx.ticker) continue;
    if (upToDate && toIsoDate(tx.transactionDate) > upToDate) continue;

    const shares = toNum(tx.shares);

    if (tx.transactionType === "buy" || tx.transactionType === "entry") {
      const pos = holdings.get(tx.ticker) || { shares: 0, totalCostLocal: 0 };
      pos.shares += shares;
      pos.totalCostLocal += shares * toNum(tx.pricePerShare);
      holdings.set(tx.ticker, pos);
    } else if (tx.transactionType === "sell") {
      const pos = holdings.get(tx.ticker) || { shares: 0, totalCostLocal: 0 };
      // Moving-average cost of the sold shares, clamped so an oversell (or a
      // sell into an empty position) can never push the cost basis below 0.
      const sellRatio = pos.shares > 0 ? Math.min(1, shares / pos.shares) : 1;
      pos.totalCostLocal -= pos.totalCostLocal * sellRatio;
      pos.shares -= shares;
      holdings.set(tx.ticker, pos);
    }
  }

  return holdings;
}
