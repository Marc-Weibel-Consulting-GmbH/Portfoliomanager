type CashTransaction = {
  transactionType?: string | null;
  totalAmountCHF?: string | number | null;
  fees?: string | number | null;
  notes?: string | null;
};

const ACTIVATION_DEPOSIT_NOTES = new Set([
  "Startkapital für Portfolio-Aktivierung",
  "Liquiditätskonto (Differenz zu Investitionssumme)",
]);

function asAmount(value: CashTransaction["totalAmountCHF"]): number {
  const amount = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(amount) ? amount : 0;
}

function asFees(value: CashTransaction["fees"]): number {
  const fees = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(fees) && fees > 0 ? fees : 0;
}

/** Cash- und Einstandsbewegung eines bereits validierten Ledger-Eintrags. */
export function getPortfolioCashMutation(transaction: CashTransaction): {
  cashDelta: number;
  investmentDelta: number;
} {
  const amount = Math.abs(asAmount(transaction.totalAmountCHF));
  const fees = asFees(transaction.fees);

  switch (transaction.transactionType) {
    case "deposit":
      return {
        cashDelta: amount,
        investmentDelta: ACTIVATION_DEPOSIT_NOTES.has(transaction.notes ?? "") ? 0 : amount,
      };
    case "withdrawal":
      return { cashDelta: -amount - fees, investmentDelta: -amount };
    case "buy":
      return { cashDelta: -amount - fees, investmentDelta: 0 };
    case "sell":
      return { cashDelta: amount - fees, investmentDelta: 0 };
    case "dividend":
      return { cashDelta: amount - fees, investmentDelta: 0 };
    default:
      return { cashDelta: 0, investmentDelta: 0 };
  }
}
