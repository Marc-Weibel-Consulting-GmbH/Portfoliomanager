export type DatedPortfolioValue = {
  date: string;
  portfolioValueCHF: number;
};

export type PortfolioDrawdownPoint = DatedPortfolioValue & {
  runningPeakCHF: number;
  drawdownPct: number;
};

export type PortfolioDrawdownAnalysis = {
  points: PortfolioDrawdownPoint[];
  maxDrawdownPct: number | null;
  peakDate: string | null;
  troughDate: string | null;
};

/**
 * Builds an auditable max-drawdown series from chronological CHF portfolio values.
 *
 * The calculation is intentionally based on the same path as the displayed risk
 * KPI: every value is compared with the highest value observed up to that date.
 * Missing / non-positive values are ignored rather than silently converted to zero.
 */
export function buildPortfolioDrawdownAnalysis(
  values: DatedPortfolioValue[],
): PortfolioDrawdownAnalysis {
  const points: PortfolioDrawdownPoint[] = [];
  let runningPeak = Number.NEGATIVE_INFINITY;
  let runningPeakDate: string | null = null;
  let maxDrawdownPct = 0;
  let maxDrawdownPeakDate: string | null = null;
  let troughDate: string | null = null;

  for (const value of values) {
    if (!Number.isFinite(value.portfolioValueCHF) || value.portfolioValueCHF <= 0) {
      continue;
    }

    if (value.portfolioValueCHF > runningPeak) {
      runningPeak = value.portfolioValueCHF;
      runningPeakDate = value.date;
    }

    const drawdownPct = ((value.portfolioValueCHF - runningPeak) / runningPeak) * 100;
    if (drawdownPct < maxDrawdownPct) {
      maxDrawdownPct = drawdownPct;
      maxDrawdownPeakDate = runningPeakDate;
      troughDate = value.date;
    }

    points.push({
      date: value.date,
      portfolioValueCHF: value.portfolioValueCHF,
      runningPeakCHF: runningPeak,
      drawdownPct,
    });
  }

  return {
    points,
    maxDrawdownPct: points.length > 0 ? maxDrawdownPct : null,
    peakDate: maxDrawdownPeakDate,
    troughDate,
  };
}

export function calculateDailyReturns(values: number[]): number[] {
  const dailyReturns: number[] = [];
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1] > 0) {
      dailyReturns.push((values[index] - values[index - 1]) / values[index - 1]);
    }
  }
  return dailyReturns;
}
