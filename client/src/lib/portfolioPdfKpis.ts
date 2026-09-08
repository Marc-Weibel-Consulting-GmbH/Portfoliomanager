/** Kennzahlen, die im kompakten PDF-Deckblatt immer sichtbar sein sollen. */
export function getPortfolioPdfKpiKeys(): string[] {
  return [
    "current_value",
    "absolute_gain",
    "ttwror",
    "dividend_yield",
    "sharpe",
    "volatility",
    "max_drawdown",
  ];
}
