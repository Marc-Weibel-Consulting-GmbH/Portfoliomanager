import { describe, expect, it } from 'vitest';
import { resolveManualDemoHoldingShares } from './manualDemoHoldingShares';

describe('resolveManualDemoHoldingShares', () => {
  it('rekonstruiert die Stückzahl einer gewichtsbasierten Altposition aus CHF-Kapitalbasis und Kurs', () => {
    expect(resolveManualDemoHoldingShares({
      shares: undefined,
      weightPct: 3,
      capitalBaseChf: 500_000,
      priceLocal: 80,
      exchangeRateToChf: 1,
    })).toBe(187.5);
  });

  it('behält eine bereits explizit gespeicherte Stückzahl unverändert bei', () => {
    expect(resolveManualDemoHoldingShares({
      shares: '200',
      weightPct: 3,
      capitalBaseChf: 500_000,
      priceLocal: 80,
      exchangeRateToChf: 1,
    })).toBe(200);
  });

  it('berücksichtigt den CHF-Wert bei einer Fremdwährungsposition', () => {
    expect(resolveManualDemoHoldingShares({
      shares: null,
      weightPct: 4,
      capitalBaseChf: 500_000,
      priceLocal: 100,
      exchangeRateToChf: 0.8,
    })).toBe(250);
  });
});
