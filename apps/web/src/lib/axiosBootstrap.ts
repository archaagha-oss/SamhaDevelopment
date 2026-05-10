import axios, { type InternalAxiosRequestConfig } from "axios";

/**
 * Global axios setup. Imported once from main.tsx.
 *
 * - Sets baseURL from VITE_API_URL when defined; otherwise relies on Vite's
 *   dev proxy (`/api/*` → http://localhost:3000) or same-origin serving in
 *   production.
 * - Attaches an Idempotency-Key header to every state-changing request that
 *   targets a known idempotent endpoint. Without this, a network retry on
 *   POST /api/deals or /api/payments/:id/partial would create a duplicate
 *   record. With this, the server (idempotency middleware on the API) replays
 *   the cached response.
 * - The same key is reused if the caller passes a `requestId` config field —
 *   mutation hooks doing optimistic retries should set this so all attempts
 *   share one key.
 */

const API_BASE = (import.meta as any).env?.VITE_API_URL;
if (API_BASE) {
  axios.defaults.baseURL = API_BASE;
}

// Routes that are safe to send Idempotency-Key on. The server middleware is
// active for these paths today; adding more is harmless (server ignores the
// header unless its middleware is also wired).
//
// Exported for unit tests in `__tests__/idempotencyKey.test.ts`. The runtime
// behaviour is unchanged; we just made the predicate importable.
export const IDEMPOTENT_POST_PATTERNS: RegExp[] = [
  /^\/?api\/deals\/?$/,
  /^\/?api\/deals\/[^/]+\/payments\/?$/,
  /^\/?api\/payments\/[^/]+\/partial\/?$/,
];

export function shouldAttachIdempotencyKey(
  config: Pick<InternalAxiosRequestConfig, "method" | "url">,
): boolean {
  if ((config.method || "").toUpperCase() !== "POST") return false;
  const url = config.url || "";
  return IDEMPOTENT_POST_PATTERNS.some((pat) => pat.test(url));
}

function generateKey(): string {
  // crypto.randomUUID is available in modern browsers and Node 19+.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older environments — 16 random bytes hex.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

axios.interceptors.request.use((config) => {
  if (shouldAttachIdempotencyKey(config)) {
    const reused = (config as any).requestId as string | undefined;
    const key = reused || generateKey();
    config.headers.set("Idempotency-Key", key);
    (config as any).requestId = key;
  }
  return config;
});

export {};
