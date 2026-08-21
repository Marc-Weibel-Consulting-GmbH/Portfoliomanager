export const AI_PORTFOLIO_PROTECTION_DAYS = 7;

export type RecommendationAction = 'increase' | 'decrease' | 'hold' | 'exit';
export type PortfolioOverride = 'max_position_weight' | 'data_integrity' | 'hard_risk_limit' | null;

export type PolicySuggestion = {
  action: RecommendationAction;
  currentWeight: number;
  targetWeight: number;
  reason: string;
  decisionCategory?: 'signal_rebalance' | 'risk_rebalance' | 'exit_signal' | 'hold';
  signalContext?: string;
  suppressedReason?: string;
};

export function applyRecommendationProtection<T extends PolicySuggestion>(input: {
  createdAt: Date;
  isAiOptimized: boolean | number;
  portfolioType: 'demo' | 'live';
  creationSource?: 'manual' | 'ai_wizard' | 'import' | null;
  now: Date;
  suggestions: T[];
}) {
  const ageMs = Math.max(0, input.now.getTime() - input.createdAt.getTime());
  const ageDays = ageMs / 86_400_000;
  // Legacy-Demoportfolios erhalten innerhalb der bestehenden Schutzfrist ebenfalls
  // keinen Umschichtungsvorschlag. Neue Wizardportfolios bleiben über creationSource
  // auch nach einer Aktivierung geschützt.
  const aiOrigin = input.creationSource === 'ai_wizard'
    || Number(input.isAiOptimized) === 1
    || input.portfolioType === 'demo';
  const isProtected = aiOrigin && ageDays < AI_PORTFOLIO_PROTECTION_DAYS;

  return {
    isProtected,
    remainingDays: isProtected ? Math.max(1, Math.ceil(AI_PORTFOLIO_PROTECTION_DAYS - ageDays)) : 0,
    suppressedCount: isProtected ? input.suggestions.length : 0,
    suggestions: isProtected ? [] : input.suggestions,
  };
}

export function reconcileSignalWithPortfolioAction<T extends PolicySuggestion & {
  action: RecommendationAction;
  currentWeight: number;
  targetWeight: number;
  signalType: 'buy' | 'sell' | 'hold' | null;
  signalScore: number | null;
  reason: string;
  portfolioOverride?: PortfolioOverride;
}>(input: T): T & Pick<PolicySuggestion, 'decisionCategory' | 'signalContext' | 'suppressedReason'> {
  const positiveSignal = input.signalType === 'buy' || (input.signalScore ?? 0) >= 60;
  const signalContext = input.signalScore != null
    ? `Signallage: ${input.signalType === 'sell' ? 'Verkauf' : input.signalType === 'hold' ? 'Halten' : 'Kauf'} (${Math.round(input.signalScore)}/100)`
    : 'Signallage: nicht verfügbar';

  if (positiveSignal && (input.action === 'decrease' || input.action === 'exit')) {
    if (input.portfolioOverride === 'max_position_weight') {
      return {
        ...input,
        reason: `Klumpenrisiko: Gewicht ${(input.currentWeight * 100).toFixed(1)}% liegt über dem verbindlichen Positionslimit. ${input.reason}`,
        decisionCategory: 'risk_rebalance',
        signalContext,
      };
    }
    if (input.portfolioOverride === 'data_integrity' || input.portfolioOverride === 'hard_risk_limit') {
      return {
        ...input,
        decisionCategory: 'risk_rebalance',
        signalContext,
      };
    }
    return {
      ...input,
      action: 'hold',
      targetWeight: input.currentWeight,
      decisionCategory: 'hold',
      signalContext,
      suppressedReason: 'Reduzierung unterdrückt: Die Signallage ist positiv und es liegt kein übergeordnetes Risiko- oder Datenintegritätslimit vor.',
      reason: 'Position halten: positives Signal ohne übergeordneten Rebalancing-Grund.',
    };
  }

  return {
    ...input,
    decisionCategory: input.action === 'exit' ? 'exit_signal' : input.action === 'hold' ? 'hold' : 'signal_rebalance',
    signalContext,
  };
}
