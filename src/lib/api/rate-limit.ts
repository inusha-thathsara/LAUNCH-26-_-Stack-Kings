import {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from "./constants";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Reset all buckets (for tests). */
export function resetRateLimitStore(): void {
  buckets.clear();
}

/**
 * Simple in-memory fixed-window rate limiter keyed by client id (e.g. IP).
 * Suitable for single-instance deployments; use a shared store in production
 * clusters.
 */
export function checkRateLimit(clientKey: string): boolean {
  const now = Date.now();
  const existing = buckets.get(clientKey);

  if (!existing || now >= existing.resetAt) {
    buckets.set(clientKey, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  existing.count += 1;
  return true;
}
