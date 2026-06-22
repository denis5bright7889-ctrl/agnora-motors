// Minimal in-process rate limiter. Keyed (e.g. by IP, by email) → 5 attempts
// per 60s sliding window. Good enough to slow down credential stuffing on a
// single instance. For multi-region deployments, swap the Map for Redis.
//
// Intentionally NOT a separate package — no deps, no config to misconfigure.

interface Window { hits: number; resetAt: number }

const buckets = new Map<string, Window>();
const WINDOW_MS = 60_000;
const LIMIT     = 5;

export interface RateLimitResult {
  ok:        boolean;
  remaining: number;
  retryInMs: number;
}

export function checkRateLimit(key: string, limit = LIMIT, windowMs = WINDOW_MS): RateLimitResult {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { hits: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryInMs: 0 };
  }
  if (cur.hits >= limit) {
    return { ok: false, remaining: 0, retryInMs: cur.resetAt - now };
  }
  cur.hits += 1;
  return { ok: true, remaining: limit - cur.hits, retryInMs: 0 };
}

/** Manually reset a bucket — used after a successful login so the user
 * isn't penalised by their own mistyped attempts. */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
