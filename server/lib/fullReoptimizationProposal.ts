export type PortfolioAssetKind = "equity" | "sleeve";

export interface ExistingPortfolioPosition {
  ticker: string;
  weightPct: number;
  assetKind: PortfolioAssetKind;
  assetClass?: string;
}

export interface FullReoptimizationProposalInput {
  currentPositions: ExistingPortfolioPosition[];
  cashWeightPct: number;
  /** Relative Gewichte des Aktienoptimierers; sie müssen zusammen 1 ergeben. */
  optimizedEquityWeights: Record<string, number>;
}

export interface ReoptimizedPortfolioPosition extends ExistingPortfolioPosition {
  weightPct: number;
}

export interface AssetAllocationPreservingEquityProposal {
  positions: ReoptimizedPortfolioPosition[];
  cashWeightPct: number;
  fixedSleeveWeightPct: number;
  equityBudgetPct: number;
  totalWeightPct: number;
}

const ROUNDING_EPSILON = 1e-6;

function finiteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} muss eine endliche, nicht negative Zahl sein.`);
  }
  return value;
}

/**
 * Kombiniert eine relative Aktienzielallokation mit der bestehenden Kapitalbasis.
 *
 * Der Optimierer kennt bewusst nur den Aktienteil. Cash und Multi-Asset-Sleeves
 * behalten ihr Gewicht; dadurch ist eine Neuoptimierung weder eine versteckte
 * Umstellung der Asset-Allokation noch eine Kapital- oder Handelsmutation.
 */
export function buildAssetAllocationPreservingEquityProposal(
  input: FullReoptimizationProposalInput,
): AssetAllocationPreservingEquityProposal {
  const cashWeightPct = finiteNonNegative(input.cashWeightPct, "Cash-Gewicht");
  const sleeves = input.currentPositions.filter((position) => position.assetKind === "sleeve");
  const fixedSleeveWeightPct = sleeves.reduce(
    (sum, position) => sum + finiteNonNegative(position.weightPct, `Sleeve-Gewicht ${position.ticker}`),
    0,
  );
  const equityBudgetPct = 100 - cashWeightPct - fixedSleeveWeightPct;

  if (equityBudgetPct < -ROUNDING_EPSILON) {
    throw new Error("Kapitalbasis ungültig: Cash und feste Sleeves übersteigen zusammen 100 %.");
  }

  const normalizedEquityWeights = Object.entries(input.optimizedEquityWeights)
    .map(([ticker, weight]) => ({ ticker, weight: finiteNonNegative(weight, `Aktiengewicht ${ticker}`) }))
    .filter(({ weight }) => weight > ROUNDING_EPSILON);
  const relativeWeightSum = normalizedEquityWeights.reduce((sum, item) => sum + item.weight, 0);

  if (equityBudgetPct > ROUNDING_EPSILON && relativeWeightSum <= ROUNDING_EPSILON) {
    throw new Error("Kapitalbasis ungültig: Der Aktienanteil benötigt mindestens ein positives Zielgewicht.");
  }

  const positions: ReoptimizedPortfolioPosition[] = [
    ...sleeves.map((position) => ({ ...position, weightPct: position.weightPct })),
    ...normalizedEquityWeights.map(({ ticker, weight }) => ({
      ticker,
      weightPct: (weight / relativeWeightSum) * Math.max(0, equityBudgetPct),
      assetKind: "equity" as const,
    })),
  ];
  const investedWeightPct = positions.reduce((sum, position) => sum + position.weightPct, 0);
  const totalWeightPct = investedWeightPct + cashWeightPct;

  if (Math.abs(totalWeightPct - 100) > ROUNDING_EPSILON) {
    throw new Error("Kapitalbasis ungültig: finale Positionen und Cash ergeben nicht 100 %.");
  }

  return {
    positions,
    cashWeightPct,
    fixedSleeveWeightPct,
    equityBudgetPct: Math.max(0, equityBudgetPct),
    totalWeightPct,
  };
}
