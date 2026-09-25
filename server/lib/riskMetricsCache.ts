type CachedRiskEntry = {
  value: unknown;
  expiresAt: number;
};

const entries = new Map<string, CachedRiskEntry>();
const MAX_ENTRIES = 100;

/**
 * Lightweight process-local cache for expensive, read-only historical risk
 * series. It deliberately does not depend on Redis or any remote service, so a
 * risk KPI can never stay in a loading state because a cache backend is slow.
 */
export function getCachedRiskMetrics<T>(key: string): T | null {
  const entry = entries.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    entries.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCachedRiskMetrics<T>(key: string, value: T, ttlMs: number): void {
  if (entries.size >= MAX_ENTRIES && !entries.has(key)) {
    const oldest = entries.entries().next().value as [string, CachedRiskEntry] | undefined;
    if (oldest) entries.delete(oldest[0]);
  }
  entries.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Removes a user's portfolio risk snapshots after a confirmed mutation. */
export function invalidateCachedRiskMetricsForUser(userId: number): void {
  const prefix = `risk:${userId}:`;
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}

/** Test-only reset. */
export function __resetRiskMetricsCache(): void {
  entries.clear();
}
