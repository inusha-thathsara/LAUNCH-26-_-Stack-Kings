export interface ApiLogEntry {
  level: "info" | "error";
  type: "api_request";
  route: string;
  method: string;
  status: number;
  duration_ms: number;
  timestamp: string;
  error?: string;
}

/** Emit a single-line JSON log entry for API requests (stdout in production). */
export function logApiRequest(entry: Omit<ApiLogEntry, "level" | "type" | "timestamp">): void {
  const payload: ApiLogEntry = {
    level: entry.status >= 500 ? "error" : "info",
    type: "api_request",
    timestamp: new Date().toISOString(),
    ...entry,
  };
  const line = JSON.stringify(payload);
  if (payload.level === "error") {
    console.error(line);
  } else {
    console.info(line);
  }
}
