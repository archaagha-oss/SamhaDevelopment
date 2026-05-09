import axios, { AxiosError } from "axios";
import { toast } from "sonner";
import { fetchSessionToken, isClerkEnabled } from "./auth";

/**
 * Global axios interceptors. One-stop shop for cross-cutting API behaviour:
 *
 *  - Outbound: attach the Clerk session JWT (when one exists) to every
 *    `/api/*` call. The matching backend middleware verifies the token via
 *    `clerkMiddleware()` (see apps/api/src/index.ts).
 *
 *  - Inbound: surface a single canonical UX for the three error classes
 *    every page used to re-implement:
 *      * 401  → cache-clear + bounce to /sign-in (preserving `?next=…`)
 *      * 403  → bounce to /forbidden
 *      * No response (offline / DNS / fetch aborted) → toast with retry
 *
 * Page-level handlers can still inspect the error — we re-reject so existing
 * try/catch + `toast.error(err.response?.data?.error)` blocks keep working.
 * The interceptor only adds a baseline; it doesn't replace per-page errors
 * for 4xx with a parsed body.
 *
 * We mutate the default axios instance rather than exporting a new one — this
 * way every existing `import axios from "axios"` call site picks up the
 * behaviour for free, no per-file refactor.
 */
let installed = false;

// Module-scoped flag prevents the same network-error toast from stacking when
// a page issues several parallel requests (e.g. dashboard with 4 KPIs).
let networkErrorToastShownAt = 0;
const NETWORK_TOAST_DEDUPE_MS = 4000;

export function installApiInterceptors(): void {
  if (installed) return;
  installed = true;

  axios.interceptors.request.use(async (config) => {
    const url = config.url ?? "";
    const isApi = url.startsWith("/api/") || url.startsWith("api/");
    if (!isApi) return config;

    const token = await fetchSessionToken();
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }
    return config;
  });

  axios.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      const url = (error.config?.url as string | undefined) ?? "";
      const isApi = url.startsWith("/api/") || url.startsWith("api/");
      if (!isApi) return Promise.reject(error);

      // No response = offline / network failure / aborted / DNS / CORS.
      if (!error.response) {
        const now = Date.now();
        if (now - networkErrorToastShownAt > NETWORK_TOAST_DEDUPE_MS) {
          networkErrorToastShownAt = now;
          toast.error("Can't reach the server", {
            id: "network-error",
            description: navigator.onLine
              ? "The request didn't go through. Check your connection and try again."
              : "You appear to be offline. Your changes will be retried when you reconnect.",
          });
        }
        return Promise.reject(error);
      }

      const status = error.response.status;

      if (status === 401) {
        // Session expired or missing. Bounce to sign-in (only when Clerk is
        // wired — in dev-mock mode the API doesn't return 401 anyway).
        if (isClerkEnabled() && typeof window !== "undefined") {
          const path = window.location.pathname + window.location.search;
          // Avoid a redirect loop if we're already on sign-in.
          if (!path.startsWith("/sign-in")) {
            const next = encodeURIComponent(path);
            window.location.assign(`/sign-in?next=${next}`);
          }
        }
        return Promise.reject(error);
      }

      if (status === 403) {
        if (typeof window !== "undefined") {
          const path = window.location.pathname;
          if (path !== "/forbidden") {
            window.location.assign("/forbidden");
          }
        }
        return Promise.reject(error);
      }

      // Everything else (400, 404, 409, 422, 500…) is left to the page-level
      // handler that already toasts a context-specific message.
      return Promise.reject(error);
    }
  );
}
