import axios from "axios";
import { toast } from "sonner";

/**
 * Configures the global axios singleton.
 * - In dev, Vite proxies /api → http://localhost:3000, so an empty baseURL is fine.
 * - In prod, set VITE_API_URL (e.g. "https://api.samha.app") and we'll prefix it.
 */
const baseURL = import.meta.env.VITE_API_URL ?? "";
if (baseURL) {
  axios.defaults.baseURL = baseURL;
}

axios.defaults.headers.common["X-Client"] = "samha-web";

let lastNetworkErrorAt = 0;
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const code   = err?.code;

    // Show a single toast for network/server errors, throttled to once per 5s
    // so a burst of concurrent failures doesn't spam the UI.
    const now = Date.now();
    if ((!status || status >= 500 || code === "ERR_NETWORK") && now - lastNetworkErrorAt > 5000) {
      lastNetworkErrorAt = now;
      const msg = !status
        ? "Network error — check your connection"
        : `Server error (${status}) — please try again`;
      toast.error(msg);
    }
    return Promise.reject(err);
  }
);

export {};
