import { calculateInitialPortfolioCapitalBasis } from '../../shared/portfolioCapitalBasis';

export type AiWizardHolding = {
  ticker: string;
  companyName?: string;
  weight?: string | number | null;
  assetType?: string | null;
  totalValue?: string | number | null;
  [key: string]: unknown;
};

export type CanonicalQuote = {
  ticker: string;
  category?: string | null;
  currency?: string | null;
  currentPrice?: string | number | null;
  exchangeRateToChf?: string | number | null;
};

export type ReconciledAiWizardDemoPortfolio = {
  holdings: AiWizardHolding[];
  securitiesValueChf: number;
  cashBalanceChf: number;
};

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function asPositiveNumber(value: unknown): number | null {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function asWeight(value: unknown, ticker: string): number {
  const weight = asPositiveNumber(value);
  if (weight === null || weight > 100) {
    throw new Error(`Ungültiges Gewicht für ${ticker}.`);
  }
  return weight;
}

/**
 * Recreates a transaktionsloses AI-Wizard-Demoportfolio from its stored target
 * weights and canonical DB quotes. It deliberately refuses unknown prices/FX:
 * silently treating a foreign security as CHF was the root cause of #3960001.
 */
export function reconcileAiWizardDemoPortfolio(input: {
  investmentAmountChf: number;
  targetCashReservePct: number;
  holdings: AiWizardHolding[];
  quotesByTicker: Map<string, CanonicalQuote>;
}): ReconciledAiWizardDemoPortfolio {
  const investmentAmountChf = asPositiveNumber(input.investmentAmountChf);
  if (investmentAmountChf === null) throw new Error('Ungültiges Startkapital.');

  const holdings = input.holdings.map((holding) => {
    const ticker = String(holding.ticker ?? '').trim();
    const quote = input.quotesByTicker.get(ticker);
    if (!ticker || !quote) throw new Error(`Kursdaten fehlen für ${ticker || 'eine Position'}.`);

    const currentPrice = asPositiveNumber(quote.currentPrice);
    const currency = String(quote.currency ?? '').toUpperCase();
    const rawFxRate = asPositiveNumber(quote.exchangeRateToChf);
    const exchangeRateToChf = currency === 'CHF' ? 1 : rawFxRate;
    if (currentPrice === null || !currency || exchangeRateToChf === null) {
      throw new Error(`Kursdaten fehlen für ${ticker}.`);
    }

    const unitPriceChf = currentPrice * exchangeRateToChf;
    const targetAmountChf = investmentAmountChf * (asWeight(holding.weight, ticker) / 100);
    const shares = Math.round(targetAmountChf / unitPriceChf);
    if (shares <= 0) throw new Error(`Die Stückzahl für ${ticker} ist nicht handelbar.`);

    const totalValue = roundCurrency(shares * unitPriceChf);
    const isEtf = String(quote.category ?? '').toUpperCase() === 'ETF';
    const { nominalValue: _discardNominalValue, ...withoutLegacyNominalValue } = holding as AiWizardHolding & { nominalValue?: unknown };

    return {
      ...withoutLegacyNominalValue,
      ticker,
      currency,
      assetType: isEtf ? 'etf' : (holding.assetType === 'bond' ? 'bond' : 'stock'),
      shares: String(shares),
      currentPrice: String(currentPrice),
      avgBuyPrice: String(unitPriceChf),
      avgBuyPriceCHF: String(unitPriceChf),
      exchangeRateToChf: String(exchangeRateToChf),
      totalValue: totalValue.toFixed(2),
    };
  });

  const capitalBasis = calculateInitialPortfolioCapitalBasis({
    initialCapitalChf: investmentAmountChf,
    targetCashReservePct: input.targetCashReservePct,
    holdings,
  });
  if (capitalBasis.isOverAllocated) {
    throw new Error(`Die rekonstruierten Wertpapiere überschreiten das Startkapital um CHF ${(capitalBasis.securitiesValueChf - investmentAmountChf).toFixed(2)}.`);
  }

  return {
    holdings,
    securitiesValueChf: capitalBasis.securitiesValueChf,
    cashBalanceChf: capitalBasis.cashValueChf,
  };
}
