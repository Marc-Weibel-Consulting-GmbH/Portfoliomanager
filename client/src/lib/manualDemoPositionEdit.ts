type DisplayedHolding = {
  ticker?: string;
  shares?: string | number;
  avgBuyPrice?: string | number;
  currency?: string;
};

type PositionEditForm = {
  ticker: string;
  isin: string;
  shares: string;
  avgBuyPrice: string;
  currency: string;
};

export function isShareOnlyDemoPositionEdit(input: {
  originalTicker: string;
  displayedHolding: DisplayedHolding;
  form: PositionEditForm;
}): boolean {
  const ticker = input.form.ticker.trim().toUpperCase();
  const originalTicker = input.originalTicker.trim().toUpperCase();
  const displayedCurrency = String(input.displayedHolding.currency ?? 'CHF').toUpperCase();
  const displayedAvgBuyPrice = Number(input.displayedHolding.avgBuyPrice);
  const formAvgBuyPrice = input.form.avgBuyPrice.trim() === '' ? displayedAvgBuyPrice : Number(input.form.avgBuyPrice);

  return ticker === originalTicker
    && input.form.isin.trim() === ''
    && Number.isFinite(formAvgBuyPrice)
    && Number.isFinite(displayedAvgBuyPrice)
    && formAvgBuyPrice === displayedAvgBuyPrice
    && input.form.currency.toUpperCase() === displayedCurrency;
}
