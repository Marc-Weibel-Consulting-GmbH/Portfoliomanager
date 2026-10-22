type DisplayedHolding = {
  ticker?: string;
  shares?: string | number;
  avgBuyPrice?: string | number;
  isin?: string | null;
  currency?: string;
  entryDate?: string | null;
};

type PositionEditForm = {
  ticker: string;
  isin: string;
  shares: string;
  avgBuyPrice: string;
  currency: string;
  entryDate?: string;
};

export function isShareOnlyDemoPositionEdit(input: {
  originalTicker: string;
  displayedHolding: DisplayedHolding;
  /** Reversibler Dialogstandard für undatierte Demopositionen. */
  initialEntryDate?: string;
  form: PositionEditForm;
}): boolean {
  const ticker = input.form.ticker.trim().toUpperCase();
  const originalTicker = input.originalTicker.trim().toUpperCase();
  const displayedCurrency = String(input.displayedHolding.currency ?? 'CHF').toUpperCase();
  const displayedAvgBuyPrice = Number(input.displayedHolding.avgBuyPrice);
  const formAvgBuyPrice = input.form.avgBuyPrice.trim() === '' ? displayedAvgBuyPrice : Number(input.form.avgBuyPrice);
  const displayedEntryDate = String(input.displayedHolding.entryDate ?? '');
  const displayedIsin = String(input.displayedHolding.isin ?? '').trim().toUpperCase();
  const formEntryDate = input.form.entryDate ?? '';
  const allowedEntryDate = displayedEntryDate || (input.initialEntryDate ?? '');

  return ticker === originalTicker
    && input.form.isin.trim().toUpperCase() === displayedIsin
    && Number.isFinite(formAvgBuyPrice)
    && Number.isFinite(displayedAvgBuyPrice)
    && formAvgBuyPrice === displayedAvgBuyPrice
    && input.form.currency.toUpperCase() === displayedCurrency
    && formEntryDate === allowedEntryDate;
}
