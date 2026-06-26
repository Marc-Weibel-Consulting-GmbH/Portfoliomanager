import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSession, predictFeatures, predictVector } from './onnxPredict';
import { normalizeFeatureVector, type FeatureSpec } from './modelRegistry';

// Loads the ONNX fixture exported by analytics_service/ml_training.py and checks
// that TS inference (onnxruntime-node) reproduces the labels the sklearn model
// produced at export time — i.e. the end-to-end serving contract holds.
const fixtureDir = join(__dirname, '__fixtures__');
const fixture = JSON.parse(readFileSync(join(fixtureDir, 'gb_signal.fixture.json'), 'utf8')) as {
  featureSpec: FeatureSpec;
  samples: { raw: Record<string, number>; expectedLabel: number }[];
};

describe('onnxPredict (onnxruntime-node serving)', () => {
  let session: Awaited<ReturnType<typeof createSession>>;

  beforeAll(async () => {
    const bytes = readFileSync(join(fixtureDir, 'gb_signal.onnx'));
    session = await createSession(new Uint8Array(bytes));
  });

  it('loads the model and exposes input/output names', () => {
    expect(session.inputNames.length).toBeGreaterThan(0);
    expect(session.outputNames.length).toBeGreaterThan(0);
  });

  it('reproduces the sklearn labels for every fixture sample (export==serving)', async () => {
    for (const s of fixture.samples) {
      const pred = await predictFeatures(session, s.raw, fixture.featureSpec);
      expect(pred.label).toBe(s.expectedLabel);
      expect(pred.confidence).toBeGreaterThan(0);
      expect(pred.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('normalization + inference are consistent via the explicit vector path', async () => {
    const s = fixture.samples[0];
    const vec = normalizeFeatureVector(s.raw, fixture.featureSpec);
    const pred = await predictVector(session, vec);
    expect(pred.label).toBe(s.expectedLabel);
  });
});
