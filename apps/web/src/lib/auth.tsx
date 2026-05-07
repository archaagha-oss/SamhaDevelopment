import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string | null;
  department?: string | null;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "unauthenticated";
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// In-memory access token. Deliberately not persisted to localStorage to
// reduce XSS exposure. The httpOnly refresh cookie restores sessions on reload.
let accessToken: string | null = null;
const setAccessToken = (t: string | null) => {
  accessToken = t;
};

axios.defaults.withCredentials = true;

axios.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;
async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await axios.post(
        "/api/auth/refresh",
        {},
        { _skipAuthRetry: true } as any
      );
      const token = res.data?.accessToken as string | undefined;
      if (token) {
        setAccessToken(token);
        return token;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

axios.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean; _skipAuthRetry?: boolean })
      | undefined;
    if (
      !original ||
      original._retried ||
      original._skipAuthRetry ||
      error.response?.status !== 401
    ) {
      throw error;
    }

    const url = original.url || "";
    if (url.includes("/api/auth/login") || url.includes("/api/auth/refresh")) {
      throw error;
    }

    const newToken = await refreshAccessToken();
    if (!newToken) {
      setAccessToken(null);
      window.dispatchEvent(new Event("samha:auth:expired"));
      throw error;
    }

    original._retried = true;
    original.headers = original.headers || {};
    (original.headers as any).Authorization = `Bearer ${newToken}`;
    return axios.request(original);
  }
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");

  const refreshMe = useCallback(async () => {
    try {
      const res = await axios.get("/api/auth/me");
      setUser(res.data);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    (async () => {
      const token = await refreshAccessToken();
      if (token) {
        await refreshMe();
      } else {
        setStatus("unauthenticated");
      }
    })();

    const onExpired = () => {
      setUser(null);
      setStatus("unauthenticated");
    };
    window.addEventListener("samha:auth:expired", onExpired);
    return () => window.removeEventListener("samha:auth:expired", onExpired);
  }, [refreshMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await axios.post(
      "/api/auth/login",
      { email, password },
      { _skipAuthRetry: true } as any
    );
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await axios.post("/api/auth/logout", {}, { _skipAuthRetry: true } as any);
    } catch {
      // ignore
    }
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo(
    () => ({ user, status, login, logout, refreshMe }),
    [user, status, login, logout, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
