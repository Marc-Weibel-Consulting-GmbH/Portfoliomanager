export interface HistoricalAnnualizedReturnInput {
  dailyReturns: number[];
  tradingDaysPerYear: number;
}

/**
 * Geometrische, zeitgewichtete Jahresrendite einer historischen Tagesreihe.
 * Diese Kennzahl beschreibt eine hypothetisch täglich auf Zielgewichte
 * rebalancierte Aktienkomponente; sie ist weder eine Renditeprognose noch die
 * reale Transaktionshistorie eines Portfolios.
 */
export function calculateHistoricalAnnualizedReturn({
  dailyReturns,
  tradingDaysPerYear,
}: HistoricalAnnualizedReturnInput): number | null {
  if (!Number.isFinite(tradingDaysPerYear) || tradingDaysPerYear <= 0 || dailyReturns.length === 0) {
    return null;
  }
  if (dailyReturns.some((dailyReturn) => !Number.isFinite(dailyReturn) || dailyReturn <= -1)) {
    return null;
  }

  const cumulativeGrowth = dailyReturns.reduce((growth, dailyReturn) => growth * (1 + dailyReturn), 1);
  if (!Number.isFinite(cumulativeGrowth) || cumulativeGrowth <= 0) return null;

  return cumulativeGrowth ** (tradingDaysPerYear / dailyReturns.length) - 1;
}
