/**
 * perfCache — Redis-backed JSON cache for heavy performance endpoints.
 *
 * Uses Upstash REST (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) when
 * available, falls back to an in-process Map so local dev always works.
 *
 * Usage:
 *   const cached = await perfCache.get<MyType>(key);
 *   if (cached) return cached;
 *   const result = await expensiveComputation();
 *   await perfCache.set(key, result, ttlSeconds);
 *   return result;
 */

interface InMemoryEntry {
  value: string;
  expiresAt: number;
}

const inMemory = new Map<string, InMemoryEntry>();

function inMemoryGet(key: string): string | null {
  const entry = inMemory.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    inMemory.delete(key);
    return null;
  }
  return entry.value;
}

function inMemorySet(key: string, value: string, ttlSeconds: number): void {
  // Evict oldest if too large
  if (inMemory.size >= 200) {
    const oldest = Array.from(inMemory.entries()).sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) inMemory.delete(oldest[0]);
  }
  inMemory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

async function upstashCall(url: string, token: string, command: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const json = await res.json() as { result: unknown };
  return json.result;
}

async function redisGet(key: string): Promise<string | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return inMemoryGet(key);
  try {
    const result = await upstashCall(url, token, ['GET', key]);
    return (result as string | null) ?? null;
  } catch (e) {
    console.warn('[perfCache] Redis GET failed, using in-memory:', (e as Error).message);
    return inMemoryGet(key);
  }
}

async function redisSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  inMemorySet(key, value, ttlSeconds); // always update in-memory as L1
  if (!url || !token) return;
  try {
    await upstashCall(url, token, ['SET', key, value, 'EX', ttlSeconds]);
  } catch (e) {
    console.warn('[perfCache] Redis SET failed:', (e as Error).message);
  }
}

async function redisDel(pattern: string): Promise<void> {
  // Delete from in-memory
  for (const k of Array.from(inMemory.keys())) {
    if (k.startsWith(pattern)) inMemory.delete(k);
  }
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  try {
    // SCAN + DEL for pattern-based invalidation
    const keys = await upstashCall(url, token, ['KEYS', `${pattern}*`]) as string[];
    if (keys && keys.length > 0) {
      await Promise.all(keys.map(k => upstashCall(url!, token!, ['DEL', k])));
    }
  } catch (e) {
    console.warn('[perfCache] Redis DEL pattern failed:', (e as Error).message);
  }
}

export const perfCache = {
  /**
   * Get a cached JSON value. Returns null on miss or error.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await redisGet(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  /**
   * Store a JSON value with TTL in seconds.
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await redisSet(key, JSON.stringify(value), ttlSeconds);
    } catch (e) {
      console.warn('[perfCache] set error:', (e as Error).message);
    }
  },

  /**
   * Invalidate all keys that start with the given prefix.
   * Use this when portfolio data changes.
   */
  async invalidate(prefix: string): Promise<void> {
    await redisDel(prefix);
  },
};

/** TTL constants for performance caches */
export const PERF_CACHE_TTL = {
  MULTI_PERIOD: 30 * 60,   // 30 min — covers all portfolios, expensive
  HISTORICAL: 15 * 60,     // 15 min — per portfolio+period chart data
  RISK_METRICS: 20 * 60,   // 20 min — risk metrics per portfolio
};
