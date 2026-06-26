import { describe, it, expect } from 'vitest';
import { InMemoryBytesCache, RedisBytesCache, type BytesCache } from './modelCache';

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
