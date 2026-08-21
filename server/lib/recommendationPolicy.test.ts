import { describe, expect, it } from 'vitest';
import {
  AI_PORTFOLIO_PROTECTION_DAYS,
  applyRecommendationProtection,
  reconcileSignalWithPortfolioAction,
} from './recommendationPolicy';

describe('KI-Portfolio-Schutzfrist', () => {
  it('schützt ein KI-Portfolio auch nach dem Wechsel von demo zu live für die volle Beobachtungsfrist', () => {
    const createdAt = new Date('2026-08-19T07:07:04.000Z');
    const now = new Date('2026-08-21T12:00:00.000Z');

    const result = applyRecommendationProtection({
      createdAt,
      isAiOptimized: true,
      portfolioType: 'live',
      now,
      suggestions: [{ ticker: 'NOVN.SW', action: 'decrease', currentWeight: 0.07, targetWeight: 0.038, reason: 'Schwaches Momentum' }],
    });

    expect(AI_PORTFOLIO_PROTECTION_DAYS).toBeGreaterThanOrEqual(7);
    expect(result.isProtected).toBe(true);
    expect(result.suggestions).toEqual([]);
    expect(result.suppressedCount).toBe(1);
  });

  it('lässt nach Ablauf der Schutzfrist reguläre Vorschläge zu', () => {
    const result = applyRecommendationProtection({
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      isAiOptimized: true,
      portfolioType: 'live',
      now: new Date('2026-08-21T12:00:00.000Z'),
      suggestions: [{ ticker: 'NOVN.SW', action: 'decrease', currentWeight: 0.07, targetWeight: 0.038, reason: 'Schwaches Momentum' }],
    });

    expect(result.isProtected).toBe(false);
    expect(result.suggestions).toHaveLength(1);
  });
});

describe('Signal- und Handelsrichtungs-Konsistenz', () => {
  it('unterdrückt eine normale Reduzierung bei positivem Signal statt widersprüchliche Texte zu erzeugen', () => {
    const result = reconcileSignalWithPortfolioAction({
      action: 'decrease',
      currentWeight: 0.069,
      targetWeight: 0.028,
      signalType: 'buy',
      signalScore: 60,
      reason: 'Schwaches Momentum (-3.4%)',
    });

    expect(result.action).toBe('hold');
    expect(result.suppressedReason).toContain('positiv');
  });

  it('erlaubt eine Reduzierung trotz positivem Signal nur mit explizitem Klumpenrisiko-Override', () => {
    const result = reconcileSignalWithPortfolioAction({
      action: 'decrease',
      currentWeight: 0.18,
      targetWeight: 0.10,
      signalType: 'buy',
      signalScore: 72,
      reason: 'Gewicht über dem verbindlichen Maximalgewicht',
      portfolioOverride: 'max_position_weight',
    });

    expect(result.action).toBe('decrease');
    expect(result.decisionCategory).toBe('risk_rebalance');
    expect(result.reason).toContain('Klumpenrisiko');
  });
});
