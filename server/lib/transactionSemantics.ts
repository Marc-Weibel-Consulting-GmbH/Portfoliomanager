/**
 * Transaction Semantics — single source of truth for reading transaction rows.
 *
 * Canonical semantics (see OPTIMIZATION_PLAN.md R-01/R-02):
 *
 * 1. `totalAmountCHF` = GROSS trade value in CHF, EXCLUDING fees.
 *    Fees always live separately in the `fees` column.
 *    - Cost basis of a buy therefore = gross + fees.
 *    - Net proceeds of a sell therefore = gross - fees.
 *    Write paths (TransactionModal, CSV import, edit, db.ts recalculation)
 *    follow this convention; legacy rows where the manual path folded fees
 *    into totalAmountCHF are migrated by `scripts/migrate-fee-semantics.ts`.
 *
 * 2. External-flow sign convention (investor's perspective on the portfolio):
 *    deposits are POSITIVE (money in), withdrawals are NEGATIVE (money out).
 *    The DB contains BOTH storage conventions for withdrawals (TransactionModal
 *    stores them negative, other paths positive), so consumers must never read
 *    the raw sign — `getSignedFlowCHF` normalizes via the transaction type.
 *
 * 3. Dividends are INTERNAL income of the portfolio, NOT external flows
 *    (R-05). They affect cash, never TWR/IRR flow lists.
 *
 * R-15 (fixed for async consumers): when `totalAmountCHF` is missing we fall
 * back to `totalAmount × fxRate` if an fxRate is stored. Without a stored
 * fxRate, `resolveGrossAmountCHF` performs an FX lookup at the TRANSACTION
 * DATE (via an injected lookup fn, keeping this module pure/testable) before
 * resorting to the last-resort fallback. Async consumers where amounts
 * materially matter (performanceService, dashboardRouter.getPerformanceMetrics,
 * annualPerformanceRouter) pre-resolve rows via `withResolvedGrossAmountCHF`.
 * Only SYNC contexts still hit the old last-resort fallback in
 * `getGrossAmountCHF` (raw local amount treated as CHF) — that path now logs
 * a warning (once per process).
 */

/** Minimal structural shape of a transaction row as read from the DB. */
export interface TransactionAmountFields {
  transactionType: string;
  totalAmountCHF?: string | null;
  totalAmount?: string | null;
  fxRate?: string | null;
  fees?: string | null;
}

function parseNum(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

// R-15: einmal-pro-Prozess-Warnung, damit Bewertungs-Loops das Log nicht fluten.
let warnedR15Fallback = false;
function warnR15Fallback(context: string): void {
  if (warnedR15Fallback) return;
  warnedR15Fallback = true;
  console.warn(
    `[transactionSemantics] R-15 fallback hit (${context}): totalAmountCHF and ` +
    `fxRate missing — raw local totalAmount treated as CHF. Async consumers ` +
    `should pre-resolve via resolveGrossAmountCHF/withResolvedGrossAmountCHF.`
  );
}

/**
 * Gross trade value in CHF, EXCLUDING fees (canonical meaning of
 * `totalAmountCHF`). Fallback chain when the CHF column is missing:
 * `totalAmount × fxRate` if fxRate is present, else raw `totalAmount`
 * (residual R-15 risk in SYNC contexts — see module header; async consumers
 * use `resolveGrossAmountCHF` which looks up the FX rate at the transaction
 * date first).
 */
export function getGrossAmountCHF(tx: TransactionAmountFields): number {
  const chf = parseNum(tx.totalAmountCHF);
  if (chf !== null) return chf;

  const local = parseNum(tx.totalAmount);
  if (local === null) return 0;

  const fxRate = parseNum(tx.fxRate);
  if (fxRate !== null && fxRate > 0) return local * fxRate;

  // R-15: local amount treated as CHF (no fxRate available, sync context)
  warnR15Fallback("getGrossAmountCHF");
  return local;
}

/**
 * Row shape for the async R-15 resolution path: additionally carries the
 * transaction currency and date needed for an FX lookup.
 */
export interface ResolvableTransactionFields extends TransactionAmountFields {
  currency?: string | null;
  transactionDate?: Date | string | null;
}

/**
 * Injected FX lookup: rate `currency`→CHF valid at `date` (YYYY-MM-DD), or
 * `null` when no rate is available (mirrors fxHelper.tryGetFxRate semantics).
 */
export type FxRateForDateLookup = (currency: string, date: string) => Promise<number | null>;

function txDateToIso(date: Date | string | null | undefined): string | null {
  if (date == null) return null;
  if (typeof date === "string") return date.split("T")[0] || null;
  return date.toISOString().split("T")[0];
}

/**
 * Async variant of `getGrossAmountCHF` that closes the R-15 gap: when both
 * `totalAmountCHF` and `fxRate` are missing on a non-CHF row, the FX rate is
 * looked up at the TRANSACTION DATE via the injected `getRateForDate` before
 * falling back to the raw local amount. Rows with `totalAmountCHF` present
 * never trigger a lookup; CHF rows are returned as-is (no currency mixing).
 */
export async function resolveGrossAmountCHF(
  tx: ResolvableTransactionFields,
  getRateForDate: FxRateForDateLookup
): Promise<number> {
  const chf = parseNum(tx.totalAmountCHF);
  if (chf !== null) return chf;

  const local = parseNum(tx.totalAmount);
  if (local === null) return 0;

  const fxRate = parseNum(tx.fxRate);
  if (fxRate !== null && fxRate > 0) return local * fxRate;

  const currency = tx.currency || null;
  if (!currency || currency === "CHF") return local; // local IS CHF — correct, not R-15

  const date = txDateToIso(tx.transactionDate);
  if (date) {
    const rate = await getRateForDate(currency, date);
    if (rate !== null && rate > 0) return local * rate;
  }

  // Last resort: lookup failed too — same residual risk as the sync path.
  warnR15Fallback("resolveGrossAmountCHF");
  return local;
}

/**
 * Batch helper for async consumers: returns copies of the rows where a
 * missing `totalAmountCHF` has been filled from `resolveGrossAmountCHF`, so
 * downstream SYNC readers (`getGrossAmountCHF`/`getSignedFlowCHF`) see the
 * date-correct CHF amount instead of hitting the R-15 fallback. Rows that
 * already carry `totalAmountCHF` are passed through unchanged.
 */
export async function withResolvedGrossAmountCHF<T extends ResolvableTransactionFields>(
  transactions: T[],
  getRateForDate: FxRateForDateLookup
): Promise<T[]> {
  return Promise.all(
    transactions.map(async (tx) => {
      if (parseNum(tx.totalAmountCHF) !== null) return tx;
      const gross = await resolveGrossAmountCHF(tx, getRateForDate);
      return { ...tx, totalAmountCHF: String(gross) };
    })
  );
}

/** Fees in CHF; missing/unparsable fees count as 0. */
export function getFeesCHF(tx: TransactionAmountFields): number {
  return parseNum(tx.fees) ?? 0;
}

/**
 * True only for transactions that move money across the portfolio boundary:
 * deposit / withdrawal, plus `entry` (go-live opening positions are
 * deposit-like external inflows — matches performanceEngine's existing
 * classification). Dividends are internal income (R-05), buys/sells are
 * internal reallocations — never external flows.
 */
export function isExternalFlow(tx: Pick<TransactionAmountFields, "transactionType">): boolean {
  return (
    tx.transactionType === "deposit" ||
    tx.transactionType === "withdrawal" ||
    tx.transactionType === "entry"
  );
}

/**
 * Signed external flow in CHF: deposits/entries positive, withdrawals
 * negative — regardless of how the row stored the sign (R-01).
 * Returns 0 for non-external transaction types.
 */
export function getSignedFlowCHF(tx: TransactionAmountFields): number {
  const gross = Math.abs(getGrossAmountCHF(tx));
  switch (tx.transactionType) {
    case "deposit":
    case "entry":
      return gross;
    case "withdrawal":
      return -gross;
    default:
      return 0;
  }
}
