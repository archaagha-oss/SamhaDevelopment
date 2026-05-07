import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, setUnauthorizedHandler } from "../lib/api";

export type Role =
  | "ADMIN"
  | "SALES_AGENT"
  | "OPERATIONS"
  | "FINANCE"
  | "DEVELOPER";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string | null;
  department?: string | null;
  mustChangePassword: boolean;
  isActive: boolean;
  lastLoginAt?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "anonymous";
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<{ user: AuthUser }>("/api/auth/me");
      setUser(data.user);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus("anonymous");
    });
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ user: AuthUser }>("/api/auth/login", {
      email,
      password,
    });
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await api.post("/api/auth/change-password", { currentPassword, newPassword });
      await refresh();
    },
    [refresh]
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, logout, refresh, changePassword }),
    [user, status, login, logout, refresh, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
