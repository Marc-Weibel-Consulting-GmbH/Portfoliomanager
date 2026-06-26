import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { featuresAt, SIGNAL_FEATURE_NAMES } from './signalFeatures';

// Parity lock: the TS extractor must reproduce the Python features_at outputs
// (analytics_service/ml_training.py) used at training time.
const fixture = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'feature_parity.json'), 'utf8'),
) as {
  prices: number[];
  featureNames: string[];
  samples: { index: number; features: Record<string, number> }[];
};

describe('signalFeatures TS↔Python parity', () => {
  it('uses the same feature order as Python', () => {
    expect([...SIGNAL_FEATURE_NAMES]).toEqual(fixture.featureNames);
  });

  it('reproduces Python features_at for every fixture sample', () => {
    for (const s of fixture.samples) {
      const ts = featuresAt(fixture.prices, s.index);
      expect(ts).not.toBeNull();
      for (const name of fixture.featureNames) {
        expect(ts![name]).toBeCloseTo(s.features[name], 9);
      }
    }
  });

  it('returns null before enough history (i < 50)', () => {
    expect(featuresAt(fixture.prices, 10)).toBeNull();
  });
});
