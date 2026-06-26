import { describe, it, expect } from 'vitest';
import { InMemoryBytesCache, RedisBytesCache, UpstashRestBytesCache, type BytesCache, type UpstashLike } from './modelCache';

describe('InMemoryBytesCache', () => {
  it('stores and retrieves bytes', async () => {
    const c = new InMemoryBytesCache();
    await c.set('k', Buffer.from([1, 2, 3]));
    expect(Array.from((await c.get('k'))!)).toEqual([1, 2, 3]);
  });

  it('returns null for missing keys', async () => {
    expect(await new InMemoryBytesCache().get('nope')).toBeNull();
  });

  it('expires entries after the TTL', async () => {
    let t = 1000;
    const c = new InMemoryBytesCache(() => t);
    await c.set('k', Buffer.from('x'), 10); // expires at 1000 + 10s
    t = 1000 + 9_999;
    expect(await c.get('k')).not.toBeNull();
    t = 1000 + 10_001;
    expect(await c.get('k')).toBeNull();
  });

  it('deletes entries', async () => {
    const c = new InMemoryBytesCache();
    await c.set('k', Buffer.from('x'));
    await c.del('k');
    expect(await c.get('k')).toBeNull();
  });
});

describe('RedisBytesCache fallback', () => {
  // Simulate a Redis client that always throws -> must fall back to in-memory.
  const brokenRedis = {
    getBuffer: async () => { throw new Error('down'); },
    set: async () => { throw new Error('down'); },
    del: async () => { throw new Error('down'); },
  } as any;

  it('falls back to in-memory when Redis throws', async () => {
    const fallback: BytesCache = new InMemoryBytesCache();
    const c = new RedisBytesCache(brokenRedis, fallback);
    await c.set('k', Buffer.from([9]));
    // value landed in the fallback despite Redis throwing
    expect(Array.from((await c.get('k'))!)).toEqual([9]);
  });
});

describe('UpstashRestBytesCache', () => {
  function fakeUpstash(): UpstashLike & { store: Map<string, string>; lastEx?: number } {
    const store = new Map<string, string>();
    return {
      store,
      async get(k) { return store.get(k) ?? null; },
      async set(k, v, opts) { store.set(k, v); (this as any).lastEx = opts?.ex; },
      async del(k) { store.delete(k); },
    };
  }

  it('round-trips bytes as base64 through the REST client', async () => {
    const client = fakeUpstash();
    const c = new UpstashRestBytesCache(client);
    await c.set('m', Buffer.from([10, 20, 30]), 3600);
    // stored value is base64, not raw
    expect(client.store.get('m')).toBe(Buffer.from([10, 20, 30]).toString('base64'));
    expect(client.lastEx).toBe(3600);
    expect(Array.from((await c.get('m'))!)).toEqual([10, 20, 30]);
  });

  it('returns null for missing keys and deletes', async () => {
    const c = new UpstashRestBytesCache(fakeUpstash());
    expect(await c.get('none')).toBeNull();
    await c.set('x', Buffer.from([1]));
    await c.del('x');
    expect(await c.get('x')).toBeNull();
  });

  it('falls back to in-memory when the REST client throws', async () => {
    const broken = {
      get: async () => { throw new Error('http 500'); },
      set: async () => { throw new Error('http 500'); },
      del: async () => { throw new Error('http 500'); },
    } as UpstashLike;
    const c = new UpstashRestBytesCache(broken, new InMemoryBytesCache());
    await c.set('k', Buffer.from([7]));
    expect(Array.from((await c.get('k'))!)).toEqual([7]);
  });
});
