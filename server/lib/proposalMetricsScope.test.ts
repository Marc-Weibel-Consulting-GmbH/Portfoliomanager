import { describe, expect, it } from 'vitest';
import { describeProposalMetricsScope } from './proposalMetricsScope';

describe('describeProposalMetricsScope', () => {
  it('kennzeichnet Kennzahlen als Aktienteil, sobald ein Multi-Asset-Sleeve nach der Aktienoptimierung ergänzt wird', () => {
    expect(describeProposalMetricsScope({ stocksOnly: false, hasSleevePositions: true })).toEqual({
      scope: 'equity_sleeve',
      titlePrefix: 'Aktienkomponente',
      note: 'Rendite, Schwankung, Sharpe und historischer Drawdown beziehen sich auf den optimierten Aktienteil. Für die nachträglich ergänzten Anlageklassen liegt keine gemeinsame, zehnjährige Kursbasis vor; Gesamtportfoliokennzahlen werden daher nicht behauptet.',
    });
  });

  it('erlaubt Gesamtportfolio-Kennzahlen nur für einen ausschliesslichen Aktienentwurf ohne nachträgliche Sleeves', () => {
    expect(describeProposalMetricsScope({ stocksOnly: true, hasSleevePositions: false })).toEqual({
      scope: 'total_portfolio',
      titlePrefix: 'Portfolio',
      note: null,
    });
  });
});
