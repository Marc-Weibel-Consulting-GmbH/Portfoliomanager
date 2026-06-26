import { describe, it, expect } from 'vitest';
import { InMemoryBytesCache, UpstashBytesCache, UpstashRestBytesCache, type BytesCache } from './modelCache';

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

describe('UpstashRestBytesCache fallback', () => {
  // Simulate a Redis client that always throws -> must fall back to in-memory.
  const brokenClient = {
    get: async () => { throw new Error('down'); },
    set: async () => { throw new Error('down'); },
    del: async () => { throw new Error('down'); },
  };

  it('falls back to in-memory when client throws', async () => {
    const fallback: BytesCache = new InMemoryBytesCache();
    const c = new UpstashRestBytesCache(brokenClient, fallback);
    await c.set('k', Buffer.from([9]));
    // value landed in the fallback despite client throwing
    expect(Array.from((await c.get('k'))!)).toEqual([9]);
  });
});

describe('UpstashBytesCache fallback', () => {
  it('falls back to in-memory when Upstash throws', async () => {
    // Use an invalid URL so fetch will throw
    const fallback: BytesCache = new InMemoryBytesCache();
    const c = new UpstashBytesCache('http://invalid-upstash-url', 'bad-token', fallback);
    await c.set('k', Buffer.from([9]));
    // value landed in the fallback despite Upstash throwing
    expect(Array.from((await c.get('k'))!)).toEqual([9]);
  });
});

describe('UpstashBytesCache with real Redis', () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  it.skipIf(!url || !token)('can ping Upstash Redis', async () => {
    const res = await fetch(url!, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['PING']),
    });
    expect(res.ok).toBe(true);
    const json = await res.json() as { result: string };
    expect(json.result).toBe('PONG');
  });

  it.skipIf(!url || !token)('stores and retrieves bytes via Upstash', async () => {
    const c = new UpstashBytesCache(url!, token!);
    const testKey = `test:modelcache:${Date.now()}`;
    const testData = Buffer.from([42, 43, 44]);
    await c.set(testKey, testData, 60);
    const result = await c.get(testKey);
    expect(result).not.toBeNull();
    expect(Array.from(result!)).toEqual([42, 43, 44]);
    await c.del(testKey);
  }, 15_000);
});
