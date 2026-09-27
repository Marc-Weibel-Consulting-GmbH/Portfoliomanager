import { annualizeReturn, yearsBetween } from "./dateMath";

export type PortfolioValuePoint = {
  date: string;
  portfolioValueCHF: number;
};

/**
 * Geometrische p.a.-Rendite einer qualifizierten CHF-Allokationsreihe.
 *
 * Diese Kennzahl verwendet exakt dieselben festen Stückzahlen und dieselbe
 * konstante Cash-Reserve wie Sharpe, Volatilität und Drawdown des 5J-Proxys.
 * Sie ist deshalb explizit keine tatsächliche Rendite eines später eröffneten
 * Depots und wird vom aufrufenden Risikogate erst nach vollständiger 5J-
 * Abdeckung veröffentlicht.
 */
export function calculateAnnualizedAllocationReturn(points: PortfolioValuePoint[]): number | null {
  if (points.length < 2) return null;

  const sorted = [...points]
    .filter((point) => Number.isFinite(point.portfolioValueCHF) && point.portfolioValueCHF > 0)
    .sort((left, right) => left.date.localeCompare(right.date));
  if (sorted.length < 2) return null;

  const first = sorted[0];
  const last = sorted.at(-1)!;
  const years = yearsBetween(`${first.date}T00:00:00Z`, `${last.date}T00:00:00Z`);
  if (!(years > 0)) return null;

  const totalReturn = last.portfolioValueCHF / first.portfolioValueCHF - 1;
  return Number.isFinite(totalReturn) ? annualizeReturn(totalReturn, years) : null;
}
