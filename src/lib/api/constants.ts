/** Maximum payload string length accepted by POST /api/transmit (10 KB). */
export const MAX_PAYLOAD_CHARS = 10 * 1024;

/** Maximum number of blocked node ids per transmission request. */
export const MAX_BLOCKED_NODES = 50;

/** Maximum number of blocked edge pairs per transmission request. */
export const MAX_BLOCKED_EDGES = 100;

/** In-memory rate limit: requests per client key per window. */
export const RATE_LIMIT_MAX_REQUESTS = 120;

/** Rate-limit sliding window in milliseconds (1 minute). */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/** Cache-Control max-age for GET /api/universe (seconds). */
export const UNIVERSE_CACHE_MAX_AGE_SEC = 3600;
