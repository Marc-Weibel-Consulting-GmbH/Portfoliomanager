export type FullReoptimizationApplyScope = "all_equities" | "single_equity";

export type ReoptimizationHolding = {
  ticker: string;
  weight: string | number | null | undefined;
};

export type ReoptimizationApplyChange = {
  ticker: string;
  currentWeightPct: number;
  targetWeightPct: number;
  deltaWeightPct: number;
};

export type FullReoptimizationApplyPlan = {
  targetWeightsPct: Array<{ ticker: string; weightPct: number }>;
  changes: ReoptimizationApplyChange[];
  /** Positive = cash increases, negative = cash is invested; percentage points of total portfolio value. */
  cashDeltaChfPct: number;
};

function asWeightPct(value: string | number | null | undefined): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalizedTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

/**
 * Translates the already disclosed full-reoptimization result into the existing
 * demo-weight mutation contract. A single-title application changes exactly one
 * optimizer target and retains every other security and sleeve. A full
 * application replaces only equities; cash and fixed sleeves remain unchanged.
 */
export function buildFullReoptimizationApplyPlan(input: {
  holdings: ReoptimizationHolding[];
  optimizedWeights: Record<string, number>;
  isSleeve: (ticker: string) => boolean;
  scope: FullReoptimizationApplyScope;
  ticker?: string;
}): FullReoptimizationApplyPlan {
  const currentByTicker = new Map<string, number>();
  const orderedCurrentTickers: string[] = [];
  for (const holding of input.holdings) {
    const ticker = normalizedTicker(holding.ticker);
    if (!ticker || ticker === "CASH" || currentByTicker.has(ticker)) continue;
    currentByTicker.set(ticker, asWeightPct(holding.weight));
    orderedCurrentTickers.push(ticker);
  }

  const optimizedEntries = Object.entries(input.optimizedWeights)
    .map(([ticker, weight]) => ({ ticker: normalizedTicker(ticker), relativeWeight: Number(weight) }))
    .filter(({ ticker, relativeWeight }) => ticker && Number.isFinite(relativeWeight) && relativeWeight > 0);
  const relativeWeightSum = optimizedEntries.reduce((sum, entry) => sum + entry.relativeWeight, 0);
  if (relativeWeightSum <= 0) throw new Error("Die aktuelle Volloptimierung enthält keine umsetzbaren Aktiengewichte.");

  const fixedSleeveWeightPct = orderedCurrentTickers
    .filter((ticker) => input.isSleeve(ticker))
    .reduce((sum, ticker) => sum + (currentByTicker.get(ticker) ?? 0), 0);
  const currentEquityWeightPct = orderedCurrentTickers
    .filter((ticker) => !input.isSleeve(ticker))
    .reduce((sum, ticker) => sum + (currentByTicker.get(ticker) ?? 0), 0);
  const optimizedTargetByTicker = new Map(
    optimizedEntries.map(({ ticker, relativeWeight }) => [
      ticker,
      (relativeWeight / relativeWeightSum) * currentEquityWeightPct,
    ] as const),
  );

  let targetByTicker: Map<string, number>;
  if (input.scope === "single_equity") {
    const ticker = normalizedTicker(input.ticker ?? "");
    const targetWeightPct = optimizedTargetByTicker.get(ticker);
    if (targetWeightPct === undefined) {
      throw new Error("Der gewählte Titel ist nicht Teil der aktuellen Volloptimierung.");
    }
    targetByTicker = new Map(currentByTicker);
    targetByTicker.set(ticker, targetWeightPct);
  } else {
    targetByTicker = new Map();
    for (const ticker of orderedCurrentTickers) {
      if (input.isSleeve(ticker)) targetByTicker.set(ticker, currentByTicker.get(ticker) ?? 0);
    }
    for (const [ticker, weightPct] of optimizedTargetByTicker) targetByTicker.set(ticker, weightPct);
  }

  const targetWeightsPct = Array.from(targetByTicker.entries())
    .map(([ticker, weightPct]) => ({ ticker, weightPct }))
    .filter(({ weightPct }) => weightPct > 0.000_001);
  const currentForChangedUniverse = new Set([...currentByTicker.keys(), ...targetByTicker.keys()]);
  const changes = Array.from(currentForChangedUniverse)
    .map((ticker) => {
      const currentWeightPct = currentByTicker.get(ticker) ?? 0;
      const targetWeightPct = targetByTicker.get(ticker) ?? 0;
      return {
        ticker,
        currentWeightPct,
        targetWeightPct,
        deltaWeightPct: targetWeightPct - currentWeightPct,
      };
    })
    .filter((change) => Math.abs(change.deltaWeightPct) > 0.000_001)
    .sort((left, right) => left.ticker.localeCompare(right.ticker));

  const targetSecurityWeightPct = targetWeightsPct.reduce((sum, target) => sum + target.weightPct, 0);
  const currentSecurityWeightPct = orderedCurrentTickers.reduce((sum, ticker) => sum + (currentByTicker.get(ticker) ?? 0), 0);
  return {
    targetWeightsPct,
    changes,
    cashDeltaChfPct: currentSecurityWeightPct - targetSecurityWeightPct,
  };
}
