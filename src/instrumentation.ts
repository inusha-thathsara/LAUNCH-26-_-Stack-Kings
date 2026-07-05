export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSentryServer } = await import("@/lib/observability/sentry");
    initSentryServer();
  }
}

export const onRequestError = async (
  error: unknown,
  request: { path: string; method: string },
) => {
  const { captureApiError } = await import("@/lib/observability/sentry");
  captureApiError(error, { path: request.path, method: request.method });
};
