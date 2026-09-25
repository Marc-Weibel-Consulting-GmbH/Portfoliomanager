export type PositionEntryBasisStatus =
  | "missing"
  | "confirmed_date"
  | "transaction_date"
  | "multiple_transaction_dates"
  | "undated_cost_basis";

export type PositionEntryBasis = {
  status: PositionEntryBasisStatus;
  entryDate: string | null;
  label: string;
};

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

/**
 * Separates confirmed/transaction-based cost basis from a display-only price.
 * Multiple purchase dates deliberately remain undated: an average cost has no
 * single purchase date unless the user explicitly records an accounting rule.
 */
export function resolvePositionEntryBasis(input: {
  hasCostBasis: boolean;
  storedEntryDate?: unknown;
  transactionDates?: unknown[];
}): PositionEntryBasis {
  if (!input.hasCostBasis) {
    return { status: "missing", entryDate: null, label: "Einstandsdaten fehlen" };
  }

  const storedEntryDate = normalizeIsoDate(input.storedEntryDate);
  if (storedEntryDate) {
    return { status: "confirmed_date", entryDate: storedEntryDate, label: "Einstand bestätigt" };
  }

  const transactionDates = Array.from(new Set(
    (input.transactionDates ?? [])
      .map(normalizeIsoDate)
      .filter((date): date is string => date !== null),
  )).sort();

  if (transactionDates.length === 1) {
    return { status: "transaction_date", entryDate: transactionDates[0], label: "Einstand aus Buchung" };
  }
  if (transactionDates.length > 1) {
    return { status: "multiple_transaction_dates", entryDate: null, label: "Mehrere Kauftranchen" };
  }
  return { status: "undated_cost_basis", entryDate: null, label: "Einstand ohne Datum" };
}
