import { describe, it, expect } from 'vitest';
import { calculateStockScore, type StockMetrics } from './scoring';

const base: StockMetrics = {
  sharpeRatio: 1.2,
  pegRatio: 1.4,
  peRatio: 18,
  beta: 1.1,
};

describe('scoring – growth momentum subscore', () => {
  it('includes a Momentum (YTD) subscore for growth stocks', () => {
    const s = calculateStockScore('TEST', { ...base, ytdPerformance: 20 }, 'growth');
    const momentum = s.subScores.find((x) => x.metric === 'Momentum (YTD)');
    expect(momentum).toBeDefined();
    expect(momentum?.value).toBe(20);
    expect(momentum?.weight).toBeCloseTo(0.15, 9);
  });

  it('rewards higher YTD momentum with a higher total score', () => {
    const low = calculateStockScore('LOW', { ...base, ytdPerformance: -10 }, 'growth');
    const high = calculateStockScore('HIGH', { ...base, ytdPerformance: 40 }, 'growth');
    expect(high.totalScore).toBeGreaterThan(low.totalScore);
  });

  it('handles missing YTD gracefully (momentum subscore present, value null)', () => {
    const s = calculateStockScore('NOYTD', { ...base }, 'growth');
    const momentum = s.subScores.find((x) => x.metric === 'Momentum (YTD)');
    expect(momentum).toBeDefined();
    expect(momentum?.value).toBeNull();
  });
});
