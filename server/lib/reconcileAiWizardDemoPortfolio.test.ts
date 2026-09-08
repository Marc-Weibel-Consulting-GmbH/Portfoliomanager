import { describe, expect, it } from 'vitest';
import { reconcileAiWizardDemoPortfolio } from './reconcileAiWizardDemoPortfolio';

describe('reconcileAiWizardDemoPortfolio', () => {
  it('rebuilds an ETF sleeve from its canonical USD quote and keeps cash as the residual', () => {
    const repaired = reconcileAiWizardDemoPortfolio({
      investmentAmountChf: 600_000,
      targetCashReservePct: 10,
      holdings: [
        { ticker: 'CSBGC0.SW', companyName: 'Bond ETF', weight: 45, assetType: 'bond', totalValue: '270011.83' },
        { ticker: 'CMDY', companyName: 'Commodity ETF', weight: 3.6, assetType: 'etf', totalValue: '21618.48' },
        { ticker: 'REET', companyName: 'REIT ETF', weight: 7.2, assetType: 'etf', totalValue: '43209.80' },
        { ticker: 'EQUITY', companyName: 'Equity', weight: 34.2, assetType: 'stock', totalValue: '205200.00' },
      ],
      quotesByTicker: new Map([
        ['CSBGC0.SW', { ticker: 'CSBGC0.SW', category: 'ETF', currency: 'CHF', currentPrice: 103.255, exchangeRateToChf: 1 }],
        ['CMDY', { ticker: 'CMDY', category: 'ETF', currency: 'USD', currentPrice: 63.96, exchangeRateToChf: 0.8092 }],
        ['REET', { ticker: 'REET', category: 'ETF', currency: 'USD', currentPrice: 27.4, exchangeRateToChf: 0.8092 }],
        ['EQUITY', { ticker: 'EQUITY', category: 'Aktien', currency: 'CHF', currentPrice: 100, exchangeRateToChf: 1 }],
      ]),
    });

    const bondEtf = repaired.holdings.find((holding) => holding.ticker === 'CSBGC0.SW');
    const commodityEtf = repaired.holdings.find((holding) => holding.ticker === 'CMDY');
    const realEstateEtf = repaired.holdings.find((holding) => holding.ticker === 'REET');

    expect(bondEtf).toMatchObject({ assetType: 'etf', currency: 'CHF', currentPrice: '103.255', exchangeRateToChf: '1' });
    expect(commodityEtf).toMatchObject({ assetType: 'etf', currency: 'USD', currentPrice: '63.96', exchangeRateToChf: '0.8092' });
    expect(realEstateEtf).toMatchObject({ assetType: 'etf', currency: 'USD', currentPrice: '27.4', exchangeRateToChf: '0.8092' });
    expect(Number(commodityEtf?.shares)).toBe(Math.round((600_000 * 0.036) / (63.96 * 0.8092)));
    expect(repaired.securitiesValueChf + repaired.cashBalanceChf).toBe(600_000);
    expect(repaired.cashBalanceChf).toBeGreaterThan(0);
  });

  it('rejects a missing canonical quote rather than silently assuming CHF or a unit FX rate', () => {
    expect(() => reconcileAiWizardDemoPortfolio({
      investmentAmountChf: 100_000,
      targetCashReservePct: 10,
      holdings: [{ ticker: 'MISSING', weight: 90, assetType: 'stock', totalValue: '90000' }],
      quotesByTicker: new Map(),
    })).toThrow(/Kursdaten fehlen/);
  });
});
