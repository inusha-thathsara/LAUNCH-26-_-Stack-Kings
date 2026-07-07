import { captureApiError } from "@/lib/observability/sentry";

import { logApiRequest } from "./logging";

/**
 * Wrap an API route handler with structured request logging and Sentry capture
 * on unexpected throws.
 */
export async function handleApiRoute(
  route: string,
  method: string,
  handler: () => Promise<Response>,
): Promise<Response> {
  const start = Date.now();
  try {
    const response = await handler();
    logApiRequest({
      route,
      method,
      status: response.status,
      duration_ms: Date.now() - start,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logApiRequest({
      route,
      method,
      status: 500,
      duration_ms: Date.now() - start,
      error: message,
    });
    captureApiError(error, { route, method });
    throw error;
  }
}
