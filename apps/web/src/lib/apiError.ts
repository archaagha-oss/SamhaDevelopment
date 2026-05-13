// Extract the most specific user-facing message from an axios error.
//
// The API returns errors in three shapes:
//   1. Zod validation:  { error: "Validation failed", details: ["field: msg", ...] }
//   2. Custom error:    { error: "Phone already in use by another lead", code: "DUPLICATE_PHONE" }
//   3. Generic:         { error: "Failed to do X" }
//
// We surface the most specific first. For Zod errors we use the first detail
// (forms usually have one bad field at a time); the rest can be exposed in
// tooltips if needed later.

interface ApiErrorPayload {
  error?: string;
  details?: string[];
  code?: string;
}

interface AxiosLikeError {
  response?: { data?: ApiErrorPayload };
  message?: string;
}

export function extractApiError(err: unknown, fallback = "Something went wrong"): string {
  const e = err as AxiosLikeError;
  const data = e?.response?.data;
  if (data?.details && data.details.length > 0) return data.details[0];
  if (data?.error) return data.error;
  if (e?.message) return e.message;
  return fallback;
}
