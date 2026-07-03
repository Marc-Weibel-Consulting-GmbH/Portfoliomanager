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
 * Residual risk R-15 (documented, deliberately NOT fixed here): when
 * `totalAmountCHF` is missing we fall back to `totalAmount × fxRate` if an
 * fxRate is stored, else to the raw local-currency `totalAmount` — the last
 * step still mixes currencies (local amount treated as CHF). A proper fix
 * needs an FX lookup at the transaction date (see plan R-15).
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

/**
 * Gross trade value in CHF, EXCLUDING fees (canonical meaning of
 * `totalAmountCHF`). Fallback chain when the CHF column is missing:
 * `totalAmount × fxRate` if fxRate is present, else raw `totalAmount`
 * (residual R-15 risk — see module header).
 */
export function getGrossAmountCHF(tx: TransactionAmountFields): number {
  const chf = parseNum(tx.totalAmountCHF);
  if (chf !== null) return chf;

  const local = parseNum(tx.totalAmount);
  if (local === null) return 0;

  const fxRate = parseNum(tx.fxRate);
  if (fxRate !== null && fxRate > 0) return local * fxRate;

  return local; // R-15: local amount treated as CHF (no fxRate available)
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
