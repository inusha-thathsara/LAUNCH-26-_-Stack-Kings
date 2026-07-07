import { handleApiRoute } from "@/lib/api/route-handler";
import { captureApiError } from "@/lib/observability/sentry";
import { APP_VERSION } from "@/lib/version";
import {
  getEngine,
  universeConfigHash,
  universeConfigPath,
} from "@/lib/relic/server/universe";
import { chimeraClient, getLastTick } from "@/lib/chimera/client";

export const runtime = "nodejs";

/**
 * Liveness/readiness probe for container orchestration and deploy verification.
 * Phase 2 extensions: chimera_reachable, models_loaded, last_tick.
 */
export async function GET() {
  return handleApiRoute("/api/health", "GET", async () => {
    let engineLoaded = false;
    let modelsLoaded = false;
    let configHash = "";

    try {
      getEngine();
      engineLoaded = true;
      modelsLoaded = true;
      configHash = universeConfigHash();
    } catch (error) {
      captureApiError(error, { route: "/api/health" });
      const message = error instanceof Error ? error.message : "Unknown error";
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

    // Phase 2: probe Chimera reachability (non-blocking)
    let chimeraReachable = false;
    try {
      await chimeraClient.getLinks();
      chimeraReachable = true;
    } catch {
      // Chimera unreachable — degraded but not fatal
    }

    return Response.json({
      status: "ok",
      version: APP_VERSION,
      config_path: universeConfigPath(),
      config_hash: configHash,
      engine_loaded: engineLoaded,
      models_loaded: modelsLoaded,
      chimera_reachable: chimeraReachable,
      last_tick: getLastTick(),
    });
  });
}
