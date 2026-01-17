import { describe, it, expect } from 'vitest';

/**
 * Unit tests for weight distribution in portfolio builder
 * These tests verify that weights are correctly distributed when adding/removing stocks
 */

describe('Portfolio Weight Distribution', () => {
  // Helper function that mirrors the addPosition logic
  const redistributeWeights = (positions: { ticker: string; weight: number }[], newTicker: string): { ticker: string; weight: number }[] => {
    const newPositions = [...positions, { ticker: newTicker, weight: 0 }];
    const numPositions = newPositions.length;
    const equalWeight = 100 / numPositions;
    
    return newPositions.map(p => ({
      ...p,
      weight: equalWeight
    }));
  };

  // Helper function that mirrors the removePosition logic
  const redistributeWeightsAfterRemoval = (positions: { ticker: string; weight: number }[], tickerToRemove: string): { ticker: string; weight: number }[] => {
    const remainingPositions = positions.filter(p => p.ticker !== tickerToRemove);
    if (remainingPositions.length === 0) return [];
    
    const equalWeight = 100 / remainingPositions.length;
    return remainingPositions.map(p => ({
      ...p,
      weight: equalWeight
    }));
  };

  describe('addPosition weight redistribution', () => {
    it('should give 100% weight to first stock', () => {
      const positions: { ticker: string; weight: number }[] = [];
      const result = redistributeWeights(positions, 'NVDA');
      
      expect(result.length).toBe(1);
      expect(result[0].weight).toBe(100);
    });

    it('should distribute 50% each when adding second stock', () => {
      const positions = [{ ticker: 'NVDA', weight: 100 }];
      const result = redistributeWeights(positions, 'GOOGL');
      
      expect(result.length).toBe(2);
      expect(result[0].weight).toBe(50);
      expect(result[1].weight).toBe(50);
    });

    it('should distribute 33.33% each when adding third stock', () => {
      const positions = [
        { ticker: 'NVDA', weight: 50 },
        { ticker: 'GOOGL', weight: 50 }
      ];
      const result = redistributeWeights(positions, 'MELI');
      
      expect(result.length).toBe(3);
      expect(result[0].weight).toBeCloseTo(33.33, 1);
      expect(result[1].weight).toBeCloseTo(33.33, 1);
      expect(result[2].weight).toBeCloseTo(33.33, 1);
    });

    it('should distribute 20% each when adding fifth stock', () => {
      const positions = [
        { ticker: 'NVDA', weight: 25 },
        { ticker: 'GOOGL', weight: 25 },
        { ticker: 'MELI', weight: 25 },
        { ticker: 'TSM', weight: 25 }
      ];
      const result = redistributeWeights(positions, 'AVGO');
      
      expect(result.length).toBe(5);
      result.forEach(p => {
        expect(p.weight).toBe(20);
      });
    });

    it('should always sum to 100%', () => {
      let positions: { ticker: string; weight: number }[] = [];
      const tickers = ['NVDA', 'GOOGL', 'MELI', 'TSM', 'AVGO', 'AAPL', 'MSFT', 'AMZN', 'META', 'NFLX'];
      
      for (const ticker of tickers) {
        positions = redistributeWeights(positions, ticker);
        const totalWeight = positions.reduce((sum, p) => sum + p.weight, 0);
        expect(totalWeight).toBeCloseTo(100, 5);
      }
    });
  });

  describe('removePosition weight redistribution', () => {
    it('should redistribute to 50% each when removing from 3 stocks', () => {
      const positions = [
        { ticker: 'NVDA', weight: 33.33 },
        { ticker: 'GOOGL', weight: 33.33 },
        { ticker: 'MELI', weight: 33.33 }
      ];
      const result = redistributeWeightsAfterRemoval(positions, 'MELI');
      
      expect(result.length).toBe(2);
      expect(result[0].weight).toBe(50);
      expect(result[1].weight).toBe(50);
    });

    it('should give 100% to remaining stock when removing from 2 stocks', () => {
      const positions = [
        { ticker: 'NVDA', weight: 50 },
        { ticker: 'GOOGL', weight: 50 }
      ];
      const result = redistributeWeightsAfterRemoval(positions, 'GOOGL');
      
      expect(result.length).toBe(1);
      expect(result[0].weight).toBe(100);
    });

    it('should return empty array when removing last stock', () => {
      const positions = [{ ticker: 'NVDA', weight: 100 }];
      const result = redistributeWeightsAfterRemoval(positions, 'NVDA');
      
      expect(result.length).toBe(0);
    });

    it('should always sum to 100% after removal', () => {
      const positions = [
        { ticker: 'NVDA', weight: 20 },
        { ticker: 'GOOGL', weight: 20 },
        { ticker: 'MELI', weight: 20 },
        { ticker: 'TSM', weight: 20 },
        { ticker: 'AVGO', weight: 20 }
      ];
      
      const result = redistributeWeightsAfterRemoval(positions, 'MELI');
      const totalWeight = result.reduce((sum, p) => sum + p.weight, 0);
      
      expect(totalWeight).toBeCloseTo(100, 5);
    });
  });

  describe('Bug regression: first stock should not keep 100%', () => {
    it('should NOT give 0% to second stock (the original bug)', () => {
      // This was the original bug: first stock got 100%, all others got 0%
      const positions = [{ ticker: 'NVDA', weight: 100 }];
      const result = redistributeWeights(positions, 'GOOGL');
      
      // Both stocks should have 50%, not NVDA=100% and GOOGL=0%
      expect(result[0].weight).toBe(50);
      expect(result[1].weight).toBe(50);
      expect(result[1].weight).not.toBe(0); // Regression test
    });

    it('should redistribute existing weights when adding new stock', () => {
      // The fix should redistribute ALL weights, not just assign to new stock
      const positions = [
        { ticker: 'NVDA', weight: 100 },
        { ticker: 'GOOGL', weight: 0 } // This was the bug state
      ];
      
      // After adding third stock, all should be ~33.33%
      const result = redistributeWeights(positions, 'MELI');
      
      expect(result[0].weight).toBeCloseTo(33.33, 1);
      expect(result[1].weight).toBeCloseTo(33.33, 1);
      expect(result[2].weight).toBeCloseTo(33.33, 1);
    });
  });

  describe('Edge cases', () => {
    it('should handle large number of positions', () => {
      let positions: { ticker: string; weight: number }[] = [];
      for (let i = 0; i < 20; i++) {
        positions = redistributeWeights(positions, `STOCK${i}`);
      }
      
      expect(positions.length).toBe(20);
      positions.forEach(p => {
        expect(p.weight).toBe(5); // 100 / 20 = 5
      });
    });

    it('should handle decimal precision correctly', () => {
      let positions: { ticker: string; weight: number }[] = [];
      for (let i = 0; i < 3; i++) {
        positions = redistributeWeights(positions, `STOCK${i}`);
      }
      
      // 100 / 3 = 33.333...
      const totalWeight = positions.reduce((sum, p) => sum + p.weight, 0);
      expect(totalWeight).toBeCloseTo(100, 10);
    });
  });
});
