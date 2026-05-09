import axios from "axios";
import { fetchSessionToken } from "./auth";

/**
 * Global axios interceptors. Attaches the Clerk session JWT to every outbound
 * request when one is available. The matching backend middleware verifies the
 * token via `clerkMiddleware()` (see apps/api/src/index.ts).
 *
 * We mutate the default axios instance rather than exporting a new one — this
 * way every existing `import axios from "axios"` call site picks up the
 * interceptor for free, no per-file refactor.
 */
let installed = false;

export function installApiInterceptors(): void {
  if (installed) return;
  installed = true;

  axios.interceptors.request.use(async (config) => {
    // Skip the auth header for absolute URLs that aren't our API.
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
}
