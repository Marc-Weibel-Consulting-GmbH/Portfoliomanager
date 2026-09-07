import { describe, expect, it } from 'vitest';
import { buildProposalAnalysisCopy } from './proposalAnalysisCopy';

describe('buildProposalAnalysisCopy', () => {
  it('begrenzt die Kennzahlenbeschreibung eines Multi-Asset-Entwurfs auf den Aktienteil', () => {
    const copy = buildProposalAnalysisCopy({
      positionCount: 12,
      expectedReturnPct: 75.1,
      sharpe: 2.4,
      volatilityPct: 31.8,
      metricsScope: 'equity_component',
    });

    expect(copy.title).toBe('Analyse des Aktienanteils');
    expect(copy.summary).toContain('Aktienanteil');
    expect(copy.summary).not.toContain('Dieses Portfolio');
    expect(copy.scopeNote).toContain('nicht für das Gesamtportfolio');
  });

  it('behält die Gesamtportfolioformulierung bei, wenn die Kennzahlen den vollständigen Entwurf abdecken', () => {
    const copy = buildProposalAnalysisCopy({
      positionCount: 8,
      expectedReturnPct: 6.5,
      sharpe: 0.62,
      volatilityPct: 12.1,
      metricsScope: 'whole_portfolio',
    });

    expect(copy.title).toBe('KI-Portfolio-Analyse');
    expect(copy.summary).toContain('Dieses Portfolio umfasst 8 Titel');
    expect(copy.scopeNote).toBeNull();
  });
});
