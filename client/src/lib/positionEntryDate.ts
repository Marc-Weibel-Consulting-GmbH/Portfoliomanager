function toIsoDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

/**
 * Supplies a reversible UI default for undated demo cost bases. It never
 * persists a date: persistence remains an explicit save action in the modal.
 */
export function resolveInitialEntryDate(input: {
  storedEntryDate: string | null | undefined;
  entryBasisStatus?: string | null;
  portfolioCreatedAt: string | Date | null | undefined;
}): string {
  const stored = toIsoDate(input.storedEntryDate);
  if (stored) return stored;

  if (input.entryBasisStatus === "multiple_transaction_dates") {
    return "";
  }

  return toIsoDate(input.portfolioCreatedAt);
}
