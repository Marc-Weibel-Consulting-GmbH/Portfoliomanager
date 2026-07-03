/**
 * Simple in-memory sliding-window rate limiter (D-08 / A-04).
 *
 * LIMITATION: state lives in process memory, i.e. limits are enforced
 * per server instance and reset on restart/redeploy. For a single-instance
 * deployment (current setup) this is sufficient; with horizontal scaling
 * a shared store (e.g. Redis) would be needed.
 */

export interface RateLimitRule {
  /** Max attempts within the window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

export const LOGIN_RATE_LIMIT: RateLimitRule = { limit: 10, windowMs: 15 * 60 * 1000 }; // 10 / 15 min
export const REGISTER_RATE_LIMIT: RateLimitRule = { limit: 5, windowMs: 60 * 60 * 1000 }; // 5 / h

export const RATE_LIMIT_MESSAGE =
  "Zu viele Versuche. Bitte warten Sie einen Moment und versuchen Sie es später erneut.";

// key (route:ip) -> timestamps of attempts within the current window
const attempts = new Map<string, number[]>();

/**
 * Records an attempt for `key` and returns true if the rate limit is exceeded.
 * Sliding window: only attempts within the last `windowMs` count.
 */
export function isRateLimited(key: string, rule: RateLimitRule): boolean {
  const now = Date.now();
  const cutoff = now - rule.windowMs;
  const recent = (attempts.get(key) ?? []).filter(t => t > cutoff);

  if (recent.length >= rule.limit) {
    attempts.set(key, recent);
    return true;
  }

  recent.push(now);
  attempts.set(key, recent);

  // Opportunistic cleanup so the map cannot grow unbounded.
  if (attempts.size > 10_000) {
    for (const [k, times] of attempts) {
      if (times.every(t => t <= cutoff)) attempts.delete(k);
    }
  }

  return false;
}

/** Best-effort client IP (honors x-forwarded-for behind the proxy). */
export function getClientIp(req: {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (first) return first.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "unknown";
}

/** Test helper: clears all rate-limit state. */
export function resetRateLimits(): void {
  attempts.clear();
}
