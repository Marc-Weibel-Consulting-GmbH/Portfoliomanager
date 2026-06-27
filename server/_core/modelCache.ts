/**
 * Bytes cache for ML model artifacts (ONNX) — shared across instances via Redis,
 * with a graceful in-memory fallback when Redis is not configured or down.
 *
 * Supports two Redis backends:
 *   1. UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN → @upstash/redis REST (serverless-friendly)
 *   2. REDIS_URL → ioredis TCP (legacy, for self-hosted Redis)
 *   3. In-memory fallback (single instance / local dev)
 *
 * The DB (modelArtifacts) is the source of truth; this only caches the ONNX bytes
 * of the active model so every request/instance doesn't re-read them.
 */

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

/** Minimal Upstash REST client surface (so the cache is testable without network). */
export interface UpstashLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { ex?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

/**
 * Upstash REST-backed cache (@upstash/redis). HTTPS/serverless-friendly. Bytes are
 * stored base64-encoded. Falls back to in-memory on any error.
 */
export class UpstashRestBytesCache implements BytesCache {
  constructor(private client: UpstashLike, private fallback: BytesCache = new InMemoryBytesCache()) {}

  async get(key: string): Promise<Buffer | null> {
    try {
      const v = await this.client.get(key);
      return v ? Buffer.from(v, "base64") : null;
    } catch {
      return this.fallback.get(key);
    }
  }

  async set(key: string, value: Buffer, ttlSeconds?: number): Promise<void> {
    try {
      const b64 = value.toString("base64");
      await this.client.set(key, b64, ttlSeconds && ttlSeconds > 0 ? { ex: ttlSeconds } : undefined);
    } catch {
      await this.fallback.set(key, value, ttlSeconds);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch {
      await this.fallback.del(key);
    }
  }
}

/**
 * Direct Upstash REST fetch cache (no @upstash/redis dependency needed).
 * Stores buffers as base64 strings. Falls back to in-memory on any error.
 */
export class UpstashBytesCache implements BytesCache {
  private fallback: BytesCache;

  constructor(
    private url: string,
    private token: string,
    fallback?: BytesCache
  ) {
    this.fallback = fallback ?? new InMemoryBytesCache();
  }

  private async call(command: unknown[]): Promise<unknown> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });
    if (!res.ok) throw new Error(`Upstash HTTP ${res.status}: ${await res.text()}`);
    const json = await res.json() as { result: unknown };
    return json.result;
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const result = await this.call(['GET', key]) as string | null;
      if (!result) return null;
      return Buffer.from(result, 'base64');
    } catch (err) {
      console.warn('[modelCache] Redis GET failed, using fallback:', (err as Error).message);
      return this.fallback.get(key);
    }
  }

  async set(key: string, value: Buffer, ttlSeconds?: number): Promise<void> {
    try {
      const b64 = value.toString('base64');
      if (ttlSeconds && ttlSeconds > 0) {
        await this.call(['SET', key, b64, 'EX', ttlSeconds]);
      } else {
        await this.call(['SET', key, b64]);
      }
    } catch (err) {
      console.warn('[modelCache] Redis SET failed, using fallback:', (err as Error).message);
      await this.fallback.set(key, value, ttlSeconds);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.call(['DEL', key]);
    } catch (err) {
      console.warn('[modelCache] Redis DEL failed, using fallback:', (err as Error).message);
      await this.fallback.del(key);
    }
  }
}

let singleton: BytesCache | null = null;

/**
 * Returns the process-wide model cache. Selection order:
 *   1. UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN → @upstash/redis REST (serverless)
 *   2. REDIS_URL → ioredis TCP (legacy self-hosted Redis)
 *   3. in-memory (single instance / local dev)
 * Imports are lazy so unused clients are never loaded.
 */
export async function getModelCache(): Promise<BytesCache> {
  if (singleton) return singleton;

  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const redisUrl = process.env.REDIS_URL;

  // Prefer Upstash REST (serverless-compatible)
  if (restUrl && restToken) {
    try {
      const { Redis } = await import("@upstash/redis");
      const client = new Redis({ url: restUrl, token: restToken, automaticDeserialization: false });
      singleton = new UpstashRestBytesCache(client as unknown as UpstashLike);
      console.log("[modelCache] Using Upstash REST cache →", restUrl.split('//')[1]);
      return singleton;
    } catch (e) {
      console.error("[modelCache] Upstash REST init failed, trying ioredis:", (e as Error)?.message);
    }
  }

  // Fallback: ioredis TCP (for self-hosted Redis or Upstash rediss:// URL)
  if (redisUrl) {
    try {
      const { default: IORedis } = await import("ioredis");
      const redis = new IORedis(redisUrl, { lazyConnect: false, maxRetriesPerRequest: 2 });
      redis.on("error", (e) => console.error("[modelCache] ioredis error:", e?.message));
      // Wrap ioredis in UpstashRestBytesCache-compatible interface
      const iface: UpstashLike = {
        get: async (k) => redis.get(k),
        set: async (k, v, opts) => opts?.ex ? redis.set(k, v, "EX", opts.ex) : redis.set(k, v),
        del: async (k) => redis.del(k),
      };
      singleton = new UpstashRestBytesCache(iface);
      console.log("[modelCache] Using ioredis cache (REDIS_URL)");
      return singleton;
    } catch (e) {
      console.error("[modelCache] ioredis init failed, using in-memory:", (e as Error)?.message);
    }
  }

  singleton = new InMemoryBytesCache();
  console.log("[modelCache] Using in-memory cache (no Redis configured)");
  return singleton;
}

/** Test-only reset of the singleton. */
export function __resetModelCacheForTests() {
  singleton = null;
}
