export interface DemoCashReservePosition {
  ticker: string;
  weightPct: number;
  currentPrice: number;
  currency: string;
  /** 1 Einheit der lokalen Handelswährung = x CHF. */
  exchangeRateToChf: number;
}

export interface DemoCashReserveRebalanceInput {
  investmentAmountChf: number;
  targetCashReservePct: number;
  positions: DemoCashReservePosition[];
}

export interface DemoCashReserveRebalanceResult {
  positions: Array<DemoCashReservePosition & { shares: number }>;
  securitiesValueChf: number;
  cashBalanceChf: number;
  totalValueChf: number;
}

/**
 * Rechnet eine reine Demo-Zielallokation auf eine neue Cash-Reserve um.
 * Es werden keine Kurse gelesen, keine Transaktionen erzeugt und keine externe
 * Ausführung angestossen. Cash ist nach Stückzahlrundung stets das Residuum.
 */
export function rebalanceDemoCashReserve(input: DemoCashReserveRebalanceInput): DemoCashReserveRebalanceResult {
  if (!Number.isFinite(input.investmentAmountChf) || input.investmentAmountChf <= 0) {
    throw new Error("Die Investitionssumme muss positiv sein.");
  }
  if (!Number.isFinite(input.targetCashReservePct) || input.targetCashReservePct < 0 || input.targetCashReservePct >= 100) {
    throw new Error("Die Cash-Quote muss zwischen 0 und unter 100 Prozent liegen.");
  }
  if (input.positions.length === 0) throw new Error("Mindestens eine Wertpapierposition ist erforderlich.");

  const existingWeightPct = input.positions.reduce((sum, position) => sum + position.weightPct, 0);
  if (!Number.isFinite(existingWeightPct) || existingWeightPct <= 0) {
    throw new Error("Die bestehenden Positionsgewichte sind nicht gültig.");
  }

  const targetSecuritiesPct = 100 - input.targetCashReservePct;
  const scalingFactor = targetSecuritiesPct / existingWeightPct;
  let securitiesValueChf = 0;
  const positions = input.positions.map((position) => {
    const currentPrice = Number(position.currentPrice);
    const fxRate = Number(position.exchangeRateToChf);
    const currency = String(position.currency ?? "CHF").toUpperCase();
    if (!Number.isFinite(currentPrice) || currentPrice <= 0 || !Number.isFinite(fxRate) || fxRate <= 0) {
      throw new Error(`Position ${position.ticker} ist nicht bewertbar.`);
    }
    const weightPct = Number((position.weightPct * scalingFactor).toFixed(6));
    const targetValueChf = input.investmentAmountChf * (weightPct / 100);
    const localAllocation = currency === "CHF" ? targetValueChf : targetValueChf / fxRate;
    const shares = Number((localAllocation / currentPrice).toFixed(6));
    const actualValueChf = currency === "CHF"
      ? shares * currentPrice
      : shares * currentPrice * fxRate;
    securitiesValueChf += actualValueChf;
    return { ...position, currency, weightPct, shares };
  });
  securitiesValueChf = Number(securitiesValueChf.toFixed(2));
  const cashBalanceChf = Number((input.investmentAmountChf - securitiesValueChf).toFixed(2));

  return {
    positions,
    securitiesValueChf,
    cashBalanceChf,
    totalValueChf: Number((securitiesValueChf + cashBalanceChf).toFixed(2)),
  };
}
