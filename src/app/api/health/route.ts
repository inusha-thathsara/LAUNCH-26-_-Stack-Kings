import { readFileSync } from "node:fs";
import { join } from "node:path";

import { handleApiRoute } from "@/lib/api/route-handler";
import { captureApiError } from "@/lib/observability/sentry";
import {
  getEngine,
  universeConfigHash,
  universeConfigPath,
} from "@/lib/relic/server/universe";

export const runtime = "nodejs";

function readAppVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Liveness/readiness probe for container orchestration and deploy verification.
 */
export async function GET() {
  return handleApiRoute("/api/health", "GET", async () => {
    try {
      getEngine();
      return Response.json({
        status: "ok",
        version: readAppVersion(),
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
          version: readAppVersion(),
          config_path: universeConfigPath(),
          engine_loaded: false,
          error: message,
        },
        { status: 503 },
      );
    }
  });
}
