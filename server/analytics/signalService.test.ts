import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { predictSignal, type ActiveModel, type SignalResult } from './signalService';
import { createSession } from './onnxPredict';
import type { FeatureSpec } from './modelRegistry';

const fxDir = join(__dirname, '__fixtures__');
const onnxFix = JSON.parse(readFileSync(join(fxDir, 'gb_signal.fixture.json'), 'utf8')) as { featureSpec: FeatureSpec };
const parity = JSON.parse(readFileSync(join(fxDir, 'feature_parity.json'), 'utf8')) as { prices: number[] };

const rfFallback = (): SignalResult => ({ source: 'rf', signal: 'hold', confidence: 0.5 });

describe('predictSignal', () => {
  let active: ActiveModel;

  beforeAll(async () => {
    const bytes = readFileSync(join(fxDir, 'gb_signal.onnx'));
    active = { session: await createSession(new Uint8Array(bytes)), featureSpec: onnxFix.featureSpec, version: 7 };
  });

  it('uses the GB model when one is active', async () => {
    const res = await predictSignal(async () => active, rfFallback, 'gb_signal', parity.prices);
    expect(res.source).toBe('gb');
    expect(['buy', 'sell']).toContain(res.signal);
    expect(res.modelVersion).toBe(7);
    expect(res.confidence).toBeGreaterThan(0);
  });

  it('falls back to RF when no active model', async () => {
    const res = await predictSignal(async () => null, rfFallback, 'gb_signal', parity.prices);
    expect(res.source).toBe('rf');
    expect(res.signal).toBe('hold');
  });

  it('falls back to RF when there is not enough price history', async () => {
    const res = await predictSignal(async () => active, rfFallback, 'gb_signal', parity.prices.slice(0, 10));
    expect(res.source).toBe('rf');
  });
});
