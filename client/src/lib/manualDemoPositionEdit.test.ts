import { describe, expect, it } from 'vitest';
import { isShareOnlyDemoPositionEdit } from './manualDemoPositionEdit';

describe('isShareOnlyDemoPositionEdit', () => {
  it('erkennt eine reine Stückzahländerung bei gewichtsbasiertem Altbestand anhand der angezeigten Ausgangswerte', () => {
    expect(isShareOnlyDemoPositionEdit({
      originalTicker: 'NESN.SW',
      displayedHolding: {
        ticker: 'NESN.SW',
        shares: 191.58,
        avgBuyPrice: 80.88,
        currency: 'CHF',
      },
      form: {
        ticker: 'NESN.SW',
        isin: '',
        shares: '200',
        avgBuyPrice: '80.88',
        currency: 'CHF',
      },
    })).toBe(true);
  });

  it('leitet bei einer Metadatenänderung nicht in den reinen Cash-Rebalancepfad', () => {
    expect(isShareOnlyDemoPositionEdit({
      originalTicker: 'NESN.SW',
      displayedHolding: {
        ticker: 'NESN.SW',
        shares: 191.58,
        avgBuyPrice: 80.88,
        currency: 'CHF',
      },
      form: {
        ticker: 'NESN.SW',
        isin: 'CH0038863350',
        shares: '200',
        avgBuyPrice: '80.88',
        currency: 'CHF',
      },
    })).toBe(false);
  });
});
