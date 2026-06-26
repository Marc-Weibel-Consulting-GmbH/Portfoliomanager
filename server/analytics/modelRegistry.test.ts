import { describe, it, expect } from 'vitest';
import {
  normalizeFeatureVector,
  selectActiveArtifact,
  nextVersion,
  passesPromotionGate,
  type FeatureSpec,
} from './modelRegistry';

const spec: FeatureSpec = {
  features: [
    { name: 'rsi', mean: 50, std: 10 },
    { name: 'momentum', mean: 0, std: 0.2 },
    { name: 'pe', mean: 20, std: 5 },
  ],
};

describe('modelRegistry', () => {
  describe('normalizeFeatureVector', () => {
    it('standardizes features in spec order', () => {
      const v = normalizeFeatureVector({ rsi: 60, momentum: 0.1, pe: 25 }, spec);
      expect(v).toEqual([1, 0.5, 1]);
    });
    it('falls back to mean (normalized 0) for missing/NaN features', () => {
      const v = normalizeFeatureVector({ rsi: 60 }, spec);
      expect(v).toEqual([1, 0, 0]);
    });
    it('treats std=0 as 1 to avoid division by zero', () => {
      const s: FeatureSpec = { features: [{ name: 'x', mean: 5, std: 0 }] };
      expect(normalizeFeatureVector({ x: 9 }, s)).toEqual([4]);
    });
  });

  describe('selectActiveArtifact', () => {
    const arts = [
      { kind: 'gb_signal', version: 1, status: 'archived' },
      { kind: 'gb_signal', version: 2, status: 'active' },
      { kind: 'ranking', version: 1, status: 'active' },
    ];
    it('returns the active artifact for a kind', () => {
      expect(selectActiveArtifact(arts, 'gb_signal')?.version).toBe(2);
    });
    it('returns null when none active', () => {
      expect(selectActiveArtifact(arts, 'ensemble_weights')).toBeNull();
    });
    it('prefers highest version if multiple active (defensive)', () => {
      const dup = [
        { kind: 'gb_signal', version: 3, status: 'active' },
        { kind: 'gb_signal', version: 5, status: 'active' },
      ];
      expect(selectActiveArtifact(dup, 'gb_signal')?.version).toBe(5);
    });
  });

  describe('nextVersion', () => {
    it('increments the max version per kind', () => {
      expect(nextVersion([{ kind: 'gb_signal', version: 2, status: 'active' }], 'gb_signal')).toBe(3);
    });
    it('starts at 1 for a new kind', () => {
      expect(nextVersion([], 'gb_signal')).toBe(1);
    });
  });

  describe('passesPromotionGate', () => {
    const gate = { minHitRate: 0.55, maxOverfitRatio: 2.0, minAlpha: 0 };
    it('passes when all metrics clear thresholds', () => {
      expect(passesPromotionGate({ hitRate: 0.6, overfitRatio: 1.5, alpha: 0.02 }, gate)).toBe(true);
    });
    it('fails on weak hit rate', () => {
      expect(passesPromotionGate({ hitRate: 0.5, overfitRatio: 1.5, alpha: 0.02 }, gate)).toBe(false);
    });
    it('fails on overfit', () => {
      expect(passesPromotionGate({ hitRate: 0.6, overfitRatio: 3.0, alpha: 0.02 }, gate)).toBe(false);
    });
    it('fails closed when a required metric is missing', () => {
      expect(passesPromotionGate({ hitRate: 0.6 }, gate)).toBe(false);
    });
  });
});
