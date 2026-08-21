type ShareTransaction = {
  ticker?: string | null;
  transactionType?: string | null;
  shares?: string | number | null;
  notes?: string | null;
};

/**
 * `portfolioData` enthält die Ausgangspositionen. Nur nachträgliche `buy`- und
 * `sell`-Transaktionen verändern diese Stückzahlen; `entry` spiegelt die
 * Ausgangsposition und darf daher nicht noch einmal addiert werden.
 */
export function reconcileSharesWithTransactions(
  baseShares: number,
  ticker: string,
  transactions: ShareTransaction[]
): number {
  const key = ticker.toUpperCase();
  const delta = transactions.reduce((sum, transaction) => {
    if (transaction.ticker?.toUpperCase() !== key) return sum;
    const shares = Number.parseFloat(String(transaction.shares ?? "0"));
    if (!Number.isFinite(shares) || shares <= 0) return sum;
    if (transaction.transactionType === "buy" && transaction.notes !== "Initial purchase for portfolio activation") return sum + shares;
    if (transaction.transactionType === "sell") return sum - shares;
    return sum;
  }, 0);

  return Math.max(0, baseShares + delta);
}
