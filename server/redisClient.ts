/**
 * Redis Client (Upstash)
 * 
 * Provides a serverless-compatible Redis client via @upstash/redis REST API.
 * Falls back gracefully to in-memory Map when Redis is not configured.
 * 
 * Usage:
 *   import { redis, redisPing } from './redisClient';
 *   await redis.set('key', 'value', { ex: 3600 }); // TTL in seconds
 *   const val = await redis.get<string>('key');
 */

import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;

/**
 * Get the Redis client instance (lazy init).
 * Returns null if UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set.
 */
export function getRedis(): Redis | null {
  if (_redis) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('[Redis] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set — running without Redis cache');
    return null;
  }

  try {
    _redis = new Redis({ url, token });
    console.log('[Redis] Client initialized →', url.replace(/\/\/.*@/, '//***@'));
  } catch (err) {
    console.error('[Redis] Failed to initialize client:', err);
    return null;
  }

  return _redis;
}

/** Convenience re-export — may be null if not configured */
export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const client = getRedis();
    if (!client) {
      // Return a no-op async function for any method call
      return async (..._args: unknown[]) => null;
    }
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

/**
 * Test the Redis connection. Returns true if successful.
 */
export async function redisPing(): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;
  try {
    const result = await client.ping();
    return result === 'PONG';
  } catch (err) {
    console.error('[Redis] Ping failed:', err);
    return false;
  }
}

// ─── Typed Cache Helpers ──────────────────────────────────────────────────────

const DEFAULT_TTL = 60 * 60; // 1 hour

/**
 * Get a cached value. Returns null on miss or Redis unavailable.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    return await client.get<T>(key);
  } catch {
    return null;
  }
}

/**
 * Set a cached value with optional TTL (seconds). Default: 1 hour.
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds = DEFAULT_TTL): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.set(key, value, { ex: ttlSeconds });
  } catch (err) {
    console.warn('[Redis] cacheSet failed for key', key, err);
  }
}

/**
 * Delete a cached key.
 */
export async function cacheDel(key: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.del(key);
  } catch (err) {
    console.warn('[Redis] cacheDel failed for key', key, err);
  }
}

/**
 * Get or compute a value (cache-aside pattern).
 * If the key exists in cache, returns it. Otherwise calls `compute`, stores the result, and returns it.
 */
export async function cacheGetOrSet<T>(
  key: string,
  compute: () => Promise<T>,
  ttlSeconds = DEFAULT_TTL
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const value = await compute();
  await cacheSet(key, value, ttlSeconds);
  return value;
}

// ─── ML-specific Cache Keys ───────────────────────────────────────────────────

export const ML_CACHE_KEYS = {
  /** Active model artifact metadata */
  activeModel: (userId: number) => `ml:model:active:${userId}`,
  /** Candidate model artifact (before promotion) */
  candidateModel: (userId: number) => `ml:model:candidate:${userId}`,
  /** Feature vector for a portfolio */
  features: (portfolioId: number) => `ml:features:${portfolioId}`,
  /** Training job state */
  trainingJob: (jobId: string) => `ml:job:${jobId}`,
  /** Prediction cache for a portfolio + date */
  prediction: (portfolioId: number, date: string) => `ml:pred:${portfolioId}:${date}`,
  /** Market regime label for a date */
  marketRegime: (date: string) => `ml:regime:${date}`,
} as const;
