import { readFileSync } from "node:fs";
import { join } from "node:path";

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
export function GET() {
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
}
