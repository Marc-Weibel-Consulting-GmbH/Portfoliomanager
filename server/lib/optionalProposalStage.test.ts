import { describe, expect, it, vi } from 'vitest';
import { getRemainingOptionalProposalBudgetMs, runOptionalProposalStage } from './optionalProposalStage';

describe('runOptionalProposalStage', () => {
  it('liefert das Ergebnis einer rechtzeitig beendeten optionalen Stufe', async () => {
    await expect(runOptionalProposalStage('Titeltexte', Promise.resolve('fertig'), 25)).resolves.toEqual({
      status: 'completed',
      value: 'fertig',
    });
  });

  it('meldet eine Verzögerung ohne den deterministischen Vorschlag zu verwerfen', async () => {
    vi.useFakeTimers();
    const pending = new Promise<string>(() => undefined);
    const resultPromise = runOptionalProposalStage('Synthese', pending, 25);

    await vi.advanceTimersByTimeAsync(25);

    await expect(resultPromise).resolves.toEqual({
      status: 'timed_out',
      stage: 'Synthese',
    });
    vi.useRealTimers();
  });

  it('gibt für weitere optionale Stufen nur die verbleibende Gesamtfrist zurück', () => {
    expect(getRemainingOptionalProposalBudgetMs(120_000, 89_000)).toBe(31_000);
    expect(getRemainingOptionalProposalBudgetMs(120_000, 120_000)).toBe(0);
    expect(getRemainingOptionalProposalBudgetMs(120_000, 120_001)).toBe(0);
  });
});
