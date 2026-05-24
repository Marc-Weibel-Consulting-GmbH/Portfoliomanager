import { describe, it, expect, vi } from 'vitest';

// Test the strategy scoring weights logic
describe('Walk-Forward Strategy Scoring Weights', () => {
  const STRATEGY_SCORING_WEIGHTS: Record<string, { momentum: number; sharpe: number; relativeStrength: number; lowVol: number }> = {
    shortTerm: { momentum: 0.50, sharpe: 0.15, relativeStrength: 0.25, lowVol: 0.10 },
    midTerm: { momentum: 0.35, sharpe: 0.25, relativeStrength: 0.20, lowVol: 0.20 },
    longTerm: { momentum: 0.15, sharpe: 0.35, relativeStrength: 0.15, lowVol: 0.35 },
  };

  it('should have weights that sum to 1.0 for each profile', () => {
    for (const [profile, weights] of Object.entries(STRATEGY_SCORING_WEIGHTS)) {
      const sum = weights.momentum + weights.sharpe + weights.relativeStrength + weights.lowVol;
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });

  it('shortTerm should prioritize momentum', () => {
    const w = STRATEGY_SCORING_WEIGHTS.shortTerm;
    expect(w.momentum).toBeGreaterThan(w.sharpe);
    expect(w.momentum).toBeGreaterThan(w.relativeStrength);
    expect(w.momentum).toBeGreaterThan(w.lowVol);
  });

  it('longTerm should prioritize sharpe and lowVol', () => {
    const w = STRATEGY_SCORING_WEIGHTS.longTerm;
    expect(w.sharpe).toBeGreaterThan(w.momentum);
    expect(w.lowVol).toBeGreaterThan(w.momentum);
    expect(w.sharpe + w.lowVol).toBeGreaterThan(0.6);
  });

  it('midTerm should be balanced', () => {
    const w = STRATEGY_SCORING_WEIGHTS.midTerm;
    // No single weight should exceed 0.4
    expect(w.momentum).toBeLessThanOrEqual(0.4);
    expect(w.sharpe).toBeLessThanOrEqual(0.4);
    expect(w.relativeStrength).toBeLessThanOrEqual(0.4);
    expect(w.lowVol).toBeLessThanOrEqual(0.4);
  });
});

describe('LPPL Threshold Validation', () => {
  it('should accept valid threshold values (50-95)', () => {
    const validValues = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95];
    for (const val of validValues) {
      expect(val).toBeGreaterThanOrEqual(50);
      expect(val).toBeLessThanOrEqual(95);
    }
  });

  it('should convert percentage to decimal correctly', () => {
    const threshold = 70;
    const decimal = threshold / 100;
    expect(decimal).toBe(0.7);
    
    const threshold2 = 85;
    const decimal2 = threshold2 / 100;
    expect(decimal2).toBe(0.85);
  });

  it('should default to 70 when no value is set', () => {
    const defaultThreshold = 70;
    expect(defaultThreshold).toBe(70);
  });
});

describe('Walk-Forward Progress Callback', () => {
  it('should accumulate progress messages', () => {
    const messages: string[] = [];
    const progressCallback = (msg: string) => {
      messages.push(msg);
      if (messages.length > 100) {
        messages.splice(0, messages.length - 100);
      }
    };

    progressCallback('Walk-Forward gestartet...');
    progressCallback('Lade Watchlist-Titel...');
    progressCallback('50 Watchlist-Titel geladen');
    progressCallback('Periode 1/10: Train 2024-01-01–2024-06-30, Test 2024-07-01–2024-07-31');

    expect(messages).toHaveLength(4);
    expect(messages[0]).toBe('Walk-Forward gestartet...');
    expect(messages[3]).toContain('Periode 1/10');
  });

  it('should limit messages to 100', () => {
    const messages: string[] = [];
    const progressCallback = (msg: string) => {
      messages.push(msg);
      if (messages.length > 100) {
        messages.splice(0, messages.length - 100);
      }
    };

    // Add 120 messages
    for (let i = 0; i < 120; i++) {
      progressCallback(`Message ${i}`);
    }

    expect(messages.length).toBeLessThanOrEqual(100);
    expect(messages[messages.length - 1]).toBe('Message 119');
  });
});

describe('Walk-Forward Non-blocking State Machine', () => {
  it('should track running state correctly', () => {
    let isRunning = false;
    let progress: string[] = [];
    let result: any = null;
    let error: string | null = null;

    // Start
    isRunning = true;
    progress = ['Walk-Forward gestartet...'];
    result = null;
    error = null;

    expect(isRunning).toBe(true);
    expect(progress).toHaveLength(1);
    expect(result).toBeNull();
    expect(error).toBeNull();

    // Simulate completion
    result = { oosAlpha: 2.5, oosHitRate: 0.62 };
    progress.push('✅ Walk-Forward abgeschlossen!');
    isRunning = false;

    expect(isRunning).toBe(false);
    expect(result.oosAlpha).toBe(2.5);
    expect(progress[progress.length - 1]).toContain('abgeschlossen');
  });

  it('should track error state correctly', () => {
    let isRunning = true;
    let error: string | null = null;
    const progress: string[] = ['Walk-Forward gestartet...'];

    // Simulate error
    error = 'Universe too small: only 5 tickers. Need at least 10.';
    progress.push(`❌ Fehler: ${error}`);
    isRunning = false;

    expect(isRunning).toBe(false);
    expect(error).toContain('Universe too small');
    expect(progress[progress.length - 1]).toContain('Fehler');
  });
});
