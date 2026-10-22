export type PositionSizeEditorBounds = {
  currentValueChf: number;
  maxValueChf: number;
  sliderStepChf: number;
};

function roundChf(value: number): number {
  return Math.round(value * 100) / 100;
}

function getSliderStepChf(maxValueChf: number): number {
  if (maxValueChf < 5_000) return 10;
  if (maxValueChf < 20_000) return 50;
  if (maxValueChf < 100_000) return 100;
  if (maxValueChf < 500_000) return 500;
  return 1_000;
}

/**
 * Rechnet einen CHF-Zielwert gegen den aktuellen, bereits CHF-konvertierten
 * Stückkurs. Die sechs Nachkommastellen entsprechen der serverseitigen
 * Cash-Gegenbuchung für reine Demo-Positionsänderungen.
 */
export function calculateSharesForPositionValueChf(input: {
  targetValueChf: number;
  currentPriceChf: number;
}): number | null {
  const targetValueChf = Number(input.targetValueChf);
  const currentPriceChf = Number(input.currentPriceChf);
  if (!Number.isFinite(targetValueChf) || targetValueChf < 0 || !(currentPriceChf > 0)) {
    return null;
  }
  return Math.round((targetValueChf / currentPriceChf) * 1_000_000) / 1_000_000;
}

/**
 * Der Regler darf eine Position nur mit der aktuellen Cash-Reserve aufstocken.
 * Er berechnet ausschliesslich eine lokale Vorschau; erst «Speichern» ruft die
 * bestehende serverseitige Cash-Gegenbuchung auf.
 */
export function getPositionSizeEditorBounds(input: {
  shares: number;
  currentPriceChf: number;
  cashBalanceChf: number;
}): PositionSizeEditorBounds | null {
  const shares = Number(input.shares);
  const currentPriceChf = Number(input.currentPriceChf);
  const cashBalanceChf = Number(input.cashBalanceChf);
  if (!(shares >= 0) || !(currentPriceChf > 0)) return null;

  const currentValueChf = roundChf(shares * currentPriceChf);
  const availableCashChf = Number.isFinite(cashBalanceChf) ? Math.max(0, cashBalanceChf) : 0;
  const maxValueChf = roundChf(currentValueChf + availableCashChf);

  return {
    currentValueChf,
    maxValueChf,
    sliderStepChf: getSliderStepChf(maxValueChf),
  };
}
