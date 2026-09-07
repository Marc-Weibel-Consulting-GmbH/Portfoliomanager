export interface ProposalAnalysisCopyInput {
  positionCount: number;
  expectedReturnPct: number | null | undefined;
  sharpe: number | null | undefined;
  volatilityPct: number | null | undefined;
  metricsScope: 'equity_component' | 'whole_portfolio' | string | null | undefined;
}

export interface ProposalAnalysisCopy {
  title: string;
  summary: string;
  scopeNote: string | null;
}

/**
 * Produces an explicitly scoped fallback narrative for proposal statistics.
 * Optimizer metrics describe the equity sleeve whenever fixed multi-asset
 * sleeves are appended after optimization, so they must not be worded as
 * whole-portfolio properties.
 */
export function buildProposalAnalysisCopy(input: ProposalAnalysisCopyInput): ProposalAnalysisCopy {
  const returnFragment = input.expectedReturnPct != null
    ? ` mit einer historischen Modellrendite von ~${input.expectedReturnPct.toFixed(1)}% p.a.`
    : '';
  const sharpeFragment = input.sharpe != null
    ? ` und einer historischen Sharpe-Ratio von ${input.sharpe.toFixed(2)}`
    : '';
  const volatilityFragment = input.volatilityPct != null
    ? ` (Volatilität ~${input.volatilityPct.toFixed(1)}%)`
    : '';

  if (input.metricsScope === 'equity_component') {
    return {
      title: 'Analyse des Aktienanteils',
      summary: `Der optimierte Aktienanteil umfasst ${input.positionCount} Titel${returnFragment}${sharpeFragment}${volatilityFragment}. Die Kennzahlen gelten nicht für das Gesamtportfolio, da Obligationen, Gold, Immobilien und weitere Sleeves erst danach ergänzt werden.`,
      scopeNote: 'Kennzahlen gelten nur für den optimierten Aktienanteil, nicht für das Gesamtportfolio.',
    };
  }

  return {
    title: 'KI-Portfolio-Analyse',
    summary: `Dieses Portfolio umfasst ${input.positionCount} Titel${returnFragment}${sharpeFragment}${volatilityFragment}. Die Zusammensetzung basiert auf Score-Ranking, Sektor-Diversifikation und Markt-Regime-Analyse.`,
    scopeNote: null,
  };
}
