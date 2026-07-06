import { handleApiRoute } from "@/lib/api/route-handler";
import { captureApiError } from "@/lib/observability/sentry";
import { APP_VERSION } from "@/lib/version";
import {
  getEngine,
  universeConfigHash,
  universeConfigPath,
} from "@/lib/relic/server/universe";

export const runtime = "nodejs";

/**
 * Liveness/readiness probe for container orchestration and deploy verification.
 */
export async function GET() {
  return handleApiRoute("/api/health", "GET", async () => {
    try {
      getEngine();
      return Response.json({
        status: "ok",
        version: APP_VERSION,
        config_path: universeConfigPath(),
        config_hash: universeConfigHash(),
        engine_loaded: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      captureApiError(error, { route: "/api/health" });
      return Response.json(
        {
          status: "degraded",
          version: APP_VERSION,
          config_path: universeConfigPath(),
          engine_loaded: false,
          error: message,
        },
        { status: 503 },
      );
    }
  });
}
