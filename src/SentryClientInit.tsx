"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center font-sans text-zinc-200">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="max-w-md text-sm text-zinc-400">{error.message}</p>
        <button
          type="button"
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-zinc-950"
          onClick={() => reset()}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
