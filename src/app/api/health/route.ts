import { handleApiRoute } from "@/lib/api/route-handler";
import { getChimeraHealthSnapshot } from "@/lib/chimera/health";
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
 *
 * Phase 3 extensions: chimera_reachable, models_loaded, last_tick.
 */
export async function GET() {
  return handleApiRoute("/api/health", "GET", async () => {
    try {
      getEngine();
      const chimera = await getChimeraHealthSnapshot();
      return Response.json({
        status: "ok",
        version: APP_VERSION,
        config_path: universeConfigPath(),
        config_hash: universeConfigHash(),
        engine_loaded: true,
        models_loaded: chimera.models_loaded,
        chimera_reachable: chimera.chimera_reachable,
        last_tick: chimera.last_tick,
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
          models_loaded: false,
          chimera_reachable: false,
          last_tick: null,
          error: message,
        },
        { status: 503 },
      );
    }
  });
}
