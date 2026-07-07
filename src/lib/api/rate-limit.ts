import { apiErrorResponse } from "./errors";
import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from "./constants";

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

/**
 * Derive a client key for rate limiting from proxy headers, falling back to a
 * shared bucket when no client hint is present (e.g. local/test requests).
 */
export function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "anonymous";
}

/**
 * Enforce the rate limit for a request. Returns a 429 Response when the client
 * has exceeded the window, or null when the request may proceed.
 */
export function enforceRateLimit(request: Request): Response | null {
  const clientKey = getClientKey(request);
  if (!checkRateLimit(clientKey)) {
    return apiErrorResponse(
      429,
      "RATE_LIMITED",
      "Too many requests. Please slow down and try again shortly.",
    );
  }
  return null;
}
