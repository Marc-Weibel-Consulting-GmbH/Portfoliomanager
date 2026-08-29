export type ActivationPosition = {
  ticker: string;
  shares: number;
  pricePerShare: number;
  currency: string;
  fxRate: number;
};

export type ActivationEntry = {
  transactionType: "entry";
  ticker: string;
  shares: string;
  pricePerShare: string;
  currency: string;
  totalAmount: string;
  fxRate: string;
  totalAmountCHF: string;
  fees: "0";
  notes: "Initialer Bestand bei Live-Aktivierung";
};

/**
 * Erstellt nur den fachlichen Anfangsbestand für ein bestehendes Demo-Portfolio.
 * Der Wechsel nach Live ist keine Einzahlung: `cashBalance` und `investmentAmount`
 * müssen deshalb unverändert bleiben. Die Eintrittsbuchungen dienen ausschliesslich
 * als Startpunkt für die Live-Bestands- und Performance-Zeitreihe.
 */
export function buildPortfolioActivationLedger(input: {
  existingCashBalanceCHF: number;
  positions: ActivationPosition[];
}): {
  preservedCashBalanceCHF: number;
  totalPositionValueCHF: number;
  transactions: ActivationEntry[];
} {
  const transactions = input.positions.flatMap((position): ActivationEntry[] => {
    if (
      !position.ticker ||
      !(position.shares > 0) ||
      !(position.pricePerShare > 0) ||
      !(position.fxRate > 0)
    ) {
      return [];
    }

    const totalAmount = position.shares * position.pricePerShare;
    const totalAmountCHF = totalAmount * position.fxRate;

    return [{
      transactionType: "entry",
      ticker: position.ticker,
      shares: position.shares.toFixed(6),
      pricePerShare: position.pricePerShare.toFixed(6),
      currency: position.currency,
      totalAmount: totalAmount.toFixed(2),
      fxRate: position.fxRate.toFixed(8),
      totalAmountCHF: totalAmountCHF.toFixed(2),
      fees: "0",
      notes: "Initialer Bestand bei Live-Aktivierung",
    }];
  });

  const totalPositionValueCHF = transactions.reduce(
    (sum, transaction) => sum + Number.parseFloat(transaction.totalAmountCHF),
    0,
  );

  return {
    preservedCashBalanceCHF: Number.isFinite(input.existingCashBalanceCHF)
      ? input.existingCashBalanceCHF
      : 0,
    totalPositionValueCHF,
    transactions,
  };
}
