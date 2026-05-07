import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, } from "react";
import { api, setUnauthorizedHandler } from "../lib/api";
const AuthContext = createContext(undefined);
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [status, setStatus] = useState("loading");
    const refresh = useCallback(async () => {
        try {
            const { data } = await api.get("/api/auth/me");
            setUser(data.user);
            setStatus("authenticated");
        }
        catch {
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
    const login = useCallback(async (email, password) => {
        const { data } = await api.post("/api/auth/login", {
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
        }
        finally {
            setUser(null);
            setStatus("anonymous");
        }
    }, []);
    const changePassword = useCallback(async (currentPassword, newPassword) => {
        await api.post("/api/auth/change-password", { currentPassword, newPassword });
        await refresh();
    }, [refresh]);
    const value = useMemo(() => ({ user, status, login, logout, refresh, changePassword }), [user, status, login, logout, refresh, changePassword]);
    return _jsx(AuthContext.Provider, { value: value, children: children });
}
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
}
