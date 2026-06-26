import { describe, it, expect, vi } from 'vitest';
import { runTrainingJob, DEFAULT_TRAINING_OPTIONS, type TrainingJobDeps, type TrainServiceResponse } from './mlTrainingJob';

const spec = { features: [{ name: 'ret_1d', mean: 0, std: 1 }] };
const series = (n: number) => ({ dates: Array.from({ length: n }, (_, i) => `2024-01-${i}`), prices: Array.from({ length: n }, () => 100) });

function deps(over: Partial<TrainingJobDeps> = {}): TrainingJobDeps {
  return {
    getUniverse: async () => ['A', 'B', 'C', 'D', 'E', 'F'],
    getSeries: async (tks) => Object.fromEntries(tks.map((t) => [t, series(200)])),
    callTrainService: async (): Promise<TrainServiceResponse> => ({
      kind: 'gb_signal', metrics: { hitRate: 0.6, overfitRatio: 1.2, alpha: 0.1 },
      featureSpec: spec, passedGate: true, onnxBase64: Buffer.from([1, 2, 3]).toString('base64'), notes: [],
    }),
    persist: async () => ({ version: 1, promoted: true }),
    ...over,
  };
}

describe('runTrainingJob', () => {
  it('trains, persists and reports promotion on the happy path', async () => {
    const persist = vi.fn(async (_out: any, _gate: any) => ({ version: 3, promoted: true }));
    const res = await runTrainingJob(deps({ persist }));
    expect(res.status).toBe('trained');
    expect(res.version).toBe(3);
    expect(res.promoted).toBe(true);
    expect(persist).toHaveBeenCalledOnce();
    // onnx bytes decoded from base64 and handed to persist
    const arg = persist.mock.calls[0]![0] as any;
    expect(Array.from(arg.onnxBytes)).toEqual([1, 2, 3]);
    expect(arg.universeSize).toBe(6);
  });

  it('skips when too few usable tickers (short history filtered out)', async () => {
    const persist = vi.fn();
    const res = await runTrainingJob(deps({
      getSeries: async (tks) => Object.fromEntries(tks.map((t) => [t, series(50)])), // < minSeriesLength
      persist: persist as any,
    }));
    expect(res.status).toBe('skipped');
    expect(persist).not.toHaveBeenCalled();
  });

  it('reports failed when the service returns no model', async () => {
    const res = await runTrainingJob(deps({
      callTrainService: async () => ({ kind: 'gb_signal', metrics: { hitRate: 0.4 }, featureSpec: spec, passedGate: false, onnxBase64: null, notes: ['gate'] }),
    }));
    expect(res.status).toBe('failed');
  });

  it('persists but does not promote when gate fails (promoted=false propagates)', async () => {
    const res = await runTrainingJob(deps({
      callTrainService: async () => ({ kind: 'gb_signal', metrics: { hitRate: 0.5, overfitRatio: 1.2, alpha: 0 }, featureSpec: spec, passedGate: false, onnxBase64: Buffer.from([9]).toString('base64'), notes: [] }),
      persist: async () => ({ version: 2, promoted: false }),
    }));
    expect(res.status).toBe('trained');
    expect(res.promoted).toBe(false);
  });

  it('only passes tickers with sufficient history to the trainer', async () => {
    const callTrainService = vi.fn(deps().callTrainService);
    await runTrainingJob(deps({
      getSeries: async () => ({ A: series(200), B: series(200), C: series(200), D: series(200), E: series(200), F: series(10) }),
      callTrainService,
    }));
    const payload = callTrainService.mock.calls[0]![0] as any;
    expect(Object.keys(payload.seriesByTicker).sort()).toEqual(['A', 'B', 'C', 'D', 'E']); // F dropped
  });
});
