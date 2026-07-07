import { handleApiRoute } from "@/lib/api/route-handler";
import { captureApiError } from "@/lib/observability/sentry";

export const runtime = "nodejs";

/**
 * Intentional error endpoint for verifying Sentry server-side ingestion.
 * Visit: GET /api/debug/sentry?throw=1
 */
export async function GET(request: Request) {
  return handleApiRoute("/api/debug/sentry", "GET", async () => {
    const url = new URL(request.url);
    if (url.searchParams.get("throw") !== "1") {
      return Response.json({
        ok: true,
        message:
          "Sentry server debug route. Add ?throw=1 to capture and throw a test error.",
        client_test:
          "Open /relic?sentry_test=1 in the browser to trigger a client-side test error.",
      });
    }

    const error = new Error(
      "Sentry server test error (intentional) — Relic Ring Protocol debug",
    );
    captureApiError(error, { source: "GET /api/debug/sentry?throw=1" });
    throw error;
  });
}
