import { describe, it, expect } from 'vitest';
import {
  persistAndMaybePromote,
  loadActiveModelBytes,
  activeCacheKey,
  type ArtifactRepo,
  type ArtifactRow,
} from './modelStore';
import { InMemoryBytesCache } from '../_core/modelCache';
import type { FeatureSpec } from './modelRegistry';

const spec: FeatureSpec = { features: [{ name: 'x', mean: 0, std: 1 }] };

function fakeRepo(): ArtifactRepo & { rows: ArtifactRow[] } {
  const rows: any[] = [];
  let id = 0;
  return {
    rows,
    async list(kind) { return rows.filter((r) => r.kind === kind); },
    async insert(row) { const newId = ++id; rows.push({ ...row, id: newId }); return newId; },
    async setStatus(rowId, status, promotedAt) {
      const r = rows.find((x) => x.id === rowId);
      if (r) { r.status = status; if (promotedAt) r.promotedAt = true; }
    },
  };
}

const gate = { minHitRate: 0.55, maxOverfitRatio: 1.6, minAlpha: 0 };
const onnx = new Uint8Array([1, 2, 3, 4]);

describe('modelStore', () => {
  it('promotes a candidate that clears the gate and caches its bytes', async () => {
    const repo = fakeRepo();
    const cache = new InMemoryBytesCache();
    const res = await persistAndMaybePromote(
      { repo, cache },
      { kind: 'gb_signal', onnxBytes: onnx, featureSpec: spec, metrics: { hitRate: 0.6, overfitRatio: 1.2, alpha: 0.05 } },
      gate,
    );
    expect(res).toEqual({ version: 1, promoted: true });
    expect(repo.rows[0].status).toBe('active');
    expect(Array.from((await cache.get(activeCacheKey('gb_signal')))!)).toEqual([1, 2, 3, 4]);
  });

  it('keeps a failing candidate as candidate (not promoted)', async () => {
    const repo = fakeRepo();
    const cache = new InMemoryBytesCache();
    const res = await persistAndMaybePromote(
      { repo, cache },
      { kind: 'gb_signal', onnxBytes: onnx, featureSpec: spec, metrics: { hitRate: 0.5, overfitRatio: 1.2, alpha: 0.05 } },
      gate,
    );
    expect(res.promoted).toBe(false);
    expect(repo.rows[0].status).toBe('candidate');
    expect(await cache.get(activeCacheKey('gb_signal'))).toBeNull();
  });

  it('archives the previous active when a new one is promoted; version increments', async () => {
    const repo = fakeRepo();
    const cache = new InMemoryBytesCache();
    const good = { hitRate: 0.6, overfitRatio: 1.2, alpha: 0.05 };
    const r1 = await persistAndMaybePromote({ repo, cache }, { kind: 'gb_signal', onnxBytes: onnx, featureSpec: spec, metrics: good }, gate);
    const r2 = await persistAndMaybePromote({ repo, cache }, { kind: 'gb_signal', onnxBytes: new Uint8Array([9]), featureSpec: spec, metrics: good }, gate);
    expect(r1.version).toBe(1);
    expect(r2.version).toBe(2);
    expect(repo.rows.find((r) => r.version === 1)!.status).toBe('archived');
    expect(repo.rows.find((r) => r.version === 2)!.status).toBe('active');
  });

  it('loadActiveModelBytes reads cache, else DB (and warms cache)', async () => {
    const repo = fakeRepo();
    const cache = new InMemoryBytesCache();
    // Promote one so an active row exists, then clear cache to force DB path.
    await persistAndMaybePromote({ repo, cache }, { kind: 'gb_signal', onnxBytes: onnx, featureSpec: spec, metrics: { hitRate: 0.6, overfitRatio: 1.2, alpha: 0.05 } }, gate);
    await cache.del(activeCacheKey('gb_signal'));

    const bytes = await loadActiveModelBytes({ repo, cache }, 'gb_signal');
    expect(Array.from(bytes!)).toEqual([1, 2, 3, 4]);
    // cache warmed
    expect(await cache.get(activeCacheKey('gb_signal'))).not.toBeNull();
  });

  it('loadActiveModelBytes returns null when nothing promoted', async () => {
    const repo = fakeRepo();
    const cache = new InMemoryBytesCache();
    expect(await loadActiveModelBytes({ repo, cache }, 'gb_signal')).toBeNull();
  });
});
