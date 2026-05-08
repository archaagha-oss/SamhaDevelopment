import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
const DEFAULTS = {
    organizationId: "",
    companyName: "Samha CRM",
    logoUrl: null,
    primaryColor: "#2563eb",
    timezone: "Asia/Dubai",
    currency: "AED",
    dateFormat: "DD/MM/YYYY",
    defaultFromEmail: null,
    defaultFromName: null,
    whatsappNumber: null,
    smsProvider: null,
    emailProvider: null,
    smtpHost: null,
    smtpPort: null,
    smtpUsername: null,
    smtpPasswordSet: false,
    paymentInstructions: null,
    emailTemplates: {},
    notificationPrefs: {},
};
const SettingsContext = createContext(null);
export const SETTINGS_QUERY_KEY = ["app-settings"];
export function SettingsProvider({ children }) {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: SETTINGS_QUERY_KEY,
        queryFn: async () => {
            const r = await axios.get("/api/settings");
            return r.data;
        },
        staleTime: 5 * 60 * 1000,
    });
    const settings = data ?? DEFAULTS;
    // Apply brand color to a CSS variable so any element can read it via
    // `var(--brand-primary)` (e.g. Tailwind arbitrary values, inline styles).
    useEffect(() => {
        const color = settings.primaryColor && /^#[0-9a-fA-F]{6}$/.test(settings.primaryColor)
            ? settings.primaryColor
            : "#2563eb";
        document.documentElement.style.setProperty("--brand-primary", color);
    }, [settings.primaryColor]);
    // Reflect company name in document title.
    useEffect(() => {
        if (settings.companyName)
            document.title = settings.companyName;
    }, [settings.companyName]);
    const value = useMemo(() => ({
        settings,
        isLoading,
        refresh: async () => {
            await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
        },
    }), [settings, isLoading, queryClient]);
    return _jsx(SettingsContext.Provider, { value: value, children: children });
}
export function useSettings() {
    const ctx = useContext(SettingsContext);
    if (!ctx) {
        // Allow consumers to render outside the provider (e.g. print-only routes
        // that mount before the shell). Return defaults rather than throwing.
        return { settings: DEFAULTS, isLoading: false, refresh: async () => { } };
    }
    return ctx;
}
