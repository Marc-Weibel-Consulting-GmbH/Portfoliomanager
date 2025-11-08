/**
 * Simple in-memory cache for API responses with TTL
 * Reduces API rate limiting issues by caching responses
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class ApiCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > entry.ttl) {
      // Expired, remove from cache
      this.cache.delete(key);
      return null;
    }

    console.log(`[Cache] HIT: ${key} (age: ${Math.round(age / 1000)}s)`);
    return entry.data as T;
  }

  /**
   * Store data in cache with TTL
   */
  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
    console.log(`[Cache] SET: ${key} (TTL: ${Math.round(ttlMs / 1000)}s)`);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    console.log('[Cache] Cleared all entries');
  }

  /**
   * Remove expired entries (garbage collection)
   */
  cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of Array.from(this.cache.entries())) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[Cache] Cleanup: removed ${removed} expired entries`);
    }
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const apiCache = new ApiCache();

// Run cleanup every 10 minutes
setInterval(() => {
  apiCache.cleanup();
}, 10 * 60 * 1000);

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  FUNDAMENTALS: 60 * 60 * 1000, // 1 hour
  QUOTE: 5 * 60 * 1000, // 5 minutes
  HISTORICAL: 24 * 60 * 60 * 1000, // 24 hours
  SEARCH: 30 * 60 * 1000, // 30 minutes
};
