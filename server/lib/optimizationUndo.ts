export type OptimizationUndoTransaction = {
  id: number;
  source: string | null | undefined;
  transactionType: string;
  totalAmountCHF: string | number | null | undefined;
  ticker: string | null | undefined;
};

export type OptimizationUndoSummary = {
  transactionIds: number[];
  transactionCount: number;
  /** Betrag, der beim Löschen der Buchungsgruppe dem aktuellen Cashbestand gutgeschrieben wird. */
  reverseCashChangeChf: number;
  tickers: string[];
};

/**
 * Validiert eine einzelne, automatisch gebuchte Optimierungsgruppe vor einer
 * Rücknahme. Manuelle Einträge, Dividenden oder unbestimmbare CHF-Beträge
 * werden niemals stillschweigend in eine Rücknahme einbezogen.
 */
export function buildOptimizationUndoSummary(
  transactions: OptimizationUndoTransaction[],
): OptimizationUndoSummary {
  if (transactions.length === 0) {
    throw new Error("Für die Rücknahme wurde keine Optimierungs-Transaktion gefunden.");
  }

  if (transactions.some((transaction) => transaction.source !== "optimization")) {
    throw new Error(
      "Eine Rücknahme darf ausschliesslich automatisch gebuchte Optimierungs-Transaktionen enthalten.",
    );
  }

  let reverseCashChangeChf = 0;
  const tickers = new Set<string>();

  for (const transaction of transactions) {
    const amount = Number(transaction.totalAmountCHF);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Für die Rücknahme fehlt ein gültiger CHF-Betrag.");
    }

    if (transaction.transactionType === "buy") {
      // Beim Entfernen eines Kaufs fliesst der verbuchte Betrag zurück in Cash.
      reverseCashChangeChf += amount;
    } else if (transaction.transactionType === "sell") {
      // Beim Entfernen eines Verkaufs wird der zuvor gutgeschriebene Erlös abgezogen.
      reverseCashChangeChf -= amount;
    } else {
      throw new Error("Eine Optimierungsrücknahme unterstützt ausschliesslich Kauf- und Verkaufsbuchungen.");
    }

    if (transaction.ticker) tickers.add(transaction.ticker);
  }

  return {
    transactionIds: transactions.map((transaction) => transaction.id),
    transactionCount: transactions.length,
    reverseCashChangeChf: Number(reverseCashChangeChf.toFixed(2)),
    tickers: [...tickers],
  };
}
