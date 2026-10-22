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

  it('erkennt einen rein wertgesteuerten Stückzahlwechsel trotz unveränderter ISIN und reversiblem Portfolio-Startdatum', () => {
    expect(isShareOnlyDemoPositionEdit({
      originalTicker: 'CHDVD.SW',
      displayedHolding: {
        ticker: 'CHDVD.SW',
        shares: 500,
        avgBuyPrice: 188.18,
        currency: 'CHF',
        isin: 'CH0012032048',
        entryDate: null,
      },
      initialEntryDate: '2026-09-08',
      form: {
        ticker: 'CHDVD.SW',
        isin: 'CH0012032048',
        shares: '600',
        avgBuyPrice: '188.18',
        currency: 'CHF',
        entryDate: '2026-09-08',
      },
    })).toBe(true);
  });
});
