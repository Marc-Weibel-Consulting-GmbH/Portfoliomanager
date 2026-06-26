/**
 * Bytes cache for ML model artifacts (ONNX) — shared across instances via Redis,
 * with a graceful in-memory fallback when REDIS_URL is not set or Redis is down.
 *
 * The DB (modelArtifacts) is the source of truth; this only caches the ONNX bytes
 * of the active model so every request/instance doesn't re-read them. Multi-
 * instance deployments set REDIS_URL so all instances share the cache.
 */
import type Redis from "ioredis";

export interface BytesCache {
  get(key: string): Promise<Buffer | null>;
  set(key: string, value: Buffer, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

interface Entry {
  value: Buffer;
  expiresAt: number | null; // epoch ms, null = no expiry
}

/** Process-local cache with TTL. Used as the default and as the Redis fallback. */
export class InMemoryBytesCache implements BytesCache {
  private store = new Map<string, Entry>();
  constructor(private now: () => number = () => Date.now()) {}

  async get(key: string): Promise<Buffer | null> {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt !== null && this.now() >= e.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return e.value;
  }

  async set(key: string, value: Buffer, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds && ttlSeconds > 0 ? this.now() + ttlSeconds * 1000 : null,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

/** Redis-backed cache; falls back to the in-memory cache on any Redis error. */
export class RedisBytesCache implements BytesCache {
  constructor(private redis: Redis, private fallback: BytesCache = new InMemoryBytesCache()) {}

  async get(key: string): Promise<Buffer | null> {
    try {
      return await this.redis.getBuffer(key);
    } catch {
      return this.fallback.get(key);
    }
  }

  async set(key: string, value: Buffer, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds && ttlSeconds > 0) await this.redis.set(key, value, "EX", ttlSeconds);
      else await this.redis.set(key, value);
    } catch {
      await this.fallback.set(key, value, ttlSeconds);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch {
      await this.fallback.del(key);
    }
  }
}

let singleton: BytesCache | null = null;

/**
 * Returns the process-wide model cache. Uses Redis when REDIS_URL is configured,
 * otherwise an in-memory cache. Import is lazy so non-Redis deployments never load
 * ioredis.
 */
export async function getModelCache(): Promise<BytesCache> {
  if (singleton) return singleton;
  const url = process.env.REDIS_URL;
  if (!url) {
    singleton = new InMemoryBytesCache();
    return singleton;
  }
  try {
    const { default: IORedis } = await import("ioredis");
    const redis = new IORedis(url, { lazyConnect: false, maxRetriesPerRequest: 2 });
    redis.on("error", (e) => console.error("[modelCache] Redis error:", e?.message));
    singleton = new RedisBytesCache(redis);
  } catch (e) {
    console.error("[modelCache] Redis init failed, using in-memory:", (e as Error)?.message);
    singleton = new InMemoryBytesCache();
  }
  return singleton;
}

/** Test-only reset of the singleton. */
export function __resetModelCacheForTests() {
  singleton = null;
}
