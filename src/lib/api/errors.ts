export type ApiErrorCode =
  | "INVALID_JSON"
  | "VALIDATION_ERROR"
  | "PAYLOAD_TOO_LARGE"
  | "BLOCKED_LIST_TOO_LARGE"
  | "ENGINE_ERROR"
  | "RATE_LIMITED";

export interface ApiErrorBody {
  error: string;
  code: ApiErrorCode;
}

export function apiErrorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
): Response {
  return Response.json({ error: message, code } satisfies ApiErrorBody, {
    status,
  });
}
