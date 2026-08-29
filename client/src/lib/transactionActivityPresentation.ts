export type TransactionActivityTone = "positive" | "negative" | "neutral";

export function getTransactionActivityPresentation(transactionType?: string | null): {
  label: string;
  tone: TransactionActivityTone;
  sign: "+" | "-" | "";
} {
  switch (transactionType) {
    case "entry":
      return { label: "Anfangsbestand", tone: "positive", sign: "+" };
    case "buy":
      return { label: "Kauf", tone: "positive", sign: "+" };
    case "dividend":
      return { label: "Dividende", tone: "positive", sign: "+" };
    case "deposit":
      return { label: "Einzahlung", tone: "positive", sign: "+" };
    case "withdrawal":
      return { label: "Auszahlung", tone: "negative", sign: "-" };
    case "sell":
      return { label: "Verkauf", tone: "negative", sign: "-" };
    default:
      return { label: transactionType || "Transaktion", tone: "neutral", sign: "" };
  }
}
