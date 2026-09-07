export type ProposalMetricsScope = 'total_portfolio' | 'equity_sleeve';

export interface ProposalMetricsScopeDescription {
  scope: ProposalMetricsScope;
  titlePrefix: 'Portfolio' | 'Aktienkomponente';
  note: string | null;
}

/**
 * Der Aktienoptimierer wird vor der Ergänzung von Multi-Asset-Sleeves ausgeführt.
 * Seine Kennzahlen dürfen folglich nur dann als Gesamtportfolio ausgegeben werden,
 * wenn keine nachträglichen Anlageklassen im Zielentwurf enthalten sind.
 */
export function describeProposalMetricsScope(input: {
  stocksOnly: boolean;
  hasSleevePositions: boolean;
}): ProposalMetricsScopeDescription {
  if (!input.stocksOnly && input.hasSleevePositions) {
    return {
      scope: 'equity_sleeve',
      titlePrefix: 'Aktienkomponente',
      note: 'Rendite, Schwankung, Sharpe und historischer Drawdown beziehen sich auf den optimierten Aktienteil. Für die nachträglich ergänzten Anlageklassen liegt keine gemeinsame, zehnjährige Kursbasis vor; Gesamtportfoliokennzahlen werden daher nicht behauptet.',
    };
  }

  return {
    scope: 'total_portfolio',
    titlePrefix: 'Portfolio',
    note: null,
  };
}
