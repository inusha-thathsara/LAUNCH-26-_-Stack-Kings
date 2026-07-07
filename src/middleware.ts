import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { logApiRequest } from "@/lib/api/logging";
import { checkRateLimit } from "@/lib/api/rate-limit";

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function middleware(request: NextRequest) {
  const route = request.nextUrl.pathname;
  const method = request.method;
  const start = Date.now();

  if (!checkRateLimit(clientKey(request))) {
    logApiRequest({
      route,
      method,
      status: 429,
      duration_ms: Date.now() - start,
      error: "rate_limited",
    });
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        code: "RATE_LIMITED",
      },
      { status: 429 },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
