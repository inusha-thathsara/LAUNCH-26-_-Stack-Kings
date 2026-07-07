import * as Sentry from "@sentry/nextjs";

let serverInitialized = false;
let clientInitialized = false;

const tracesSampleRate =
  process.env.NODE_ENV === "production" ? 0.1 : 1.0;

/** Initialize Sentry on the server (Node.js). No-op when SENTRY_DSN is unset. */
export function initSentryServer(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || serverInitialized) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    tracesSampleRate,
  });
  serverInitialized = true;
}

/** Initialize Sentry in the browser. No-op when NEXT_PUBLIC_SENTRY_DSN is unset. */
export function initSentryClient(): void {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || clientInitialized) return;

  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    tracesSampleRate,
  });
  clientInitialized = true;
}

/** Report an error to Sentry when configured; always safe to call. */
export function captureApiError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export { Sentry };
