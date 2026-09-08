export type ManualDemoHolding = {
  ticker: string;
  shares: number;
  priceLocal: number;
  currency: string;
  /** CHF-Wert einer lokalen Währungseinheit, z. B. USDCHF = 0.80. */
  exchangeRateToChf: number;
};

function valueInChf(holding: ManualDemoHolding): number {
  if (!(holding.shares >= 0)) throw new Error(`Ungültige Stückzahl für ${holding.ticker}.`);
  if (!(holding.priceLocal > 0)) throw new Error(`Ungültiger Marktpreis für ${holding.ticker}.`);
  if (!(holding.exchangeRateToChf > 0)) throw new Error(`Ungültiger CHF-Wechselkurs für ${holding.ticker}.`);
  return holding.shares * holding.priceLocal * holding.exchangeRateToChf;
}

function summedValueInChf(holdings: ManualDemoHolding[]): number {
  const seen = new Set<string>();
  return holdings.reduce((sum, holding) => {
    if (!holding.ticker || seen.has(holding.ticker)) {
      throw new Error(`Positionen müssen eindeutige Ticker enthalten (${holding.ticker || "leer"}).`);
    }
    seen.add(holding.ticker);
    return sum + valueInChf(holding);
  }, 0);
}

export function rebalanceManualDemoPortfolio(input: {
  cashBalanceChf: number;
  before: ManualDemoHolding[];
  after: ManualDemoHolding[];
}): {
  cashBalanceChf: number;
  securitiesValueBeforeChf: number;
  securitiesValueAfterChf: number;
  totalValueBeforeChf: number;
  totalValueAfterChf: number;
} {
  if (!(input.cashBalanceChf >= 0)) throw new Error("Ungültige Cash-Reserve.");
  const securitiesValueBeforeChf = summedValueInChf(input.before);
  const securitiesValueAfterChf = summedValueInChf(input.after);
  const totalValueBeforeChf = securitiesValueBeforeChf + input.cashBalanceChf;
  const cashBalanceChf = input.cashBalanceChf + securitiesValueBeforeChf - securitiesValueAfterChf;

  // Ein geringfügiger negativer Wert kann nur durch Cent-/Stückzahlrundung entstehen.
  if (cashBalanceChf < -0.005) {
    throw new Error("Die gewünschte Positionsänderung ist nicht durch die Cash-Reserve gedeckt.");
  }
  const normalizedCashBalanceChf = Math.max(0, Math.round(cashBalanceChf * 100) / 100);
  const totalValueAfterChf = securitiesValueAfterChf + normalizedCashBalanceChf;

  return {
    cashBalanceChf: normalizedCashBalanceChf,
    securitiesValueBeforeChf,
    securitiesValueAfterChf,
    totalValueBeforeChf,
    totalValueAfterChf,
  };
}

/**
 * Rechnet die Eingabe des bestehenden Gewichtungseditors gegen den aktuellen
 * Gesamtwert des Demoportfolios. Nicht mehr vorhandene Titel werden nicht
 * implizit umverteilt, sondern erhöhen die Cash-Reserve als Restbetrag.
 */
export function rebalanceManualDemoPortfolioWeights(input: {
  cashBalanceChf: number;
  before: ManualDemoHolding[];
  targetWeightsPct: Array<{ ticker: string; weightPct: number }>;
}): {
  positions: Array<{ ticker: string; shares: number; weightPct: number }>;
  cashBalanceChf: number;
  securitiesValueBeforeChf: number;
  securitiesValueAfterChf: number;
  totalValueBeforeChf: number;
  totalValueAfterChf: number;
} {
  const securitiesValueBeforeChf = summedValueInChf(input.before);
  if (!(input.cashBalanceChf >= 0)) throw new Error("Ungültige Cash-Reserve.");
  const totalValueBeforeChf = securitiesValueBeforeChf + input.cashBalanceChf;
  const targetTickers = new Set<string>();
  const quoteByTicker = new Map(input.before.map((holding) => [holding.ticker, holding]));
  const targetWeightSum = input.targetWeightsPct.reduce((sum, target) => {
    if (!target.ticker || targetTickers.has(target.ticker)) {
      throw new Error(`Positionen müssen eindeutige Ticker enthalten (${target.ticker || "leer"}).`);
    }
    targetTickers.add(target.ticker);
    if (!(target.weightPct >= 0)) throw new Error(`Ungültiges Gewicht für ${target.ticker}.`);
    if (!quoteByTicker.has(target.ticker)) throw new Error(`Fehlende Kursbasis für ${target.ticker}.`);
    return sum + target.weightPct;
  }, 0);
  if (targetWeightSum > 100.005) {
    throw new Error("Die Zielgewichte dürfen 100 % nicht überschreiten.");
  }

  const positions = input.targetWeightsPct
    .filter((target) => target.weightPct > 0)
    .map((target) => {
      const quote = quoteByTicker.get(target.ticker)!;
      const targetValueChf = totalValueBeforeChf * target.weightPct / 100;
      const shares = Math.round((targetValueChf / (quote.priceLocal * quote.exchangeRateToChf)) * 1_000_000) / 1_000_000;
      return { ticker: target.ticker, shares, weightPct: target.weightPct };
    });
  const after = positions.map((position) => {
    const quote = quoteByTicker.get(position.ticker)!;
    return { ...quote, shares: position.shares };
  });
  const rebalanced = rebalanceManualDemoPortfolio({
    cashBalanceChf: input.cashBalanceChf,
    before: input.before,
    after,
  });
  return { ...rebalanced, positions };
}
