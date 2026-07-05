"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { captureApiError } from "@/lib/observability/sentry";

/**
 * When /relic?sentry_test=1 is opened, throws once so Sentry client ingestion
 * can be verified in the dashboard.
 */
export default function SentryClientDebugTrigger() {
  const searchParams = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (searchParams.get("sentry_test") !== "1") return;

    fired.current = true;
    const error = new Error(
      "Sentry client test error (intentional) — Relic Ring Protocol debug",
    );
    captureApiError(error, { source: "/relic?sentry_test=1" });
    throw error;
  }, [searchParams]);

  return null;
}
