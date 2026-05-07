import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  withCredentials: true,
});

// Default global axios to send cookies too — many components still call axios
// directly via the bare import. Centralising here avoids touching every file.
axios.defaults.withCredentials = true;
if (import.meta.env.VITE_API_URL) {
  axios.defaults.baseURL = import.meta.env.VITE_API_URL;
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

const handle401 = (error: unknown) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const status = (error as any)?.response?.status;
  if (status === 401 && onUnauthorized) {
    onUnauthorized();
  }
  return Promise.reject(error);
};

api.interceptors.response.use((r) => r, handle401);
axios.interceptors.response.use((r) => r, handle401);
