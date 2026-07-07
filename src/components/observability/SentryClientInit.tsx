"use client";

import { useEffect } from "react";

import { initSentryClient } from "@/lib/observability/sentry";

/** Mount once in the root layout to enable client-side error tracking. */
export default function SentryClientInit() {
  useEffect(() => {
    initSentryClient();
  }, []);
  return null;
}
