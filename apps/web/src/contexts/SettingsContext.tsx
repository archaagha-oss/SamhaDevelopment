import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

export interface AppSettings {
  id?: string;
  organizationId: string;

  companyName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;

  timezone: string;
  currency: string;
  dateFormat: string;

  defaultFromEmail: string | null;
  defaultFromName: string | null;
  whatsappNumber: string | null;
  smsProvider: string | null;
  emailProvider: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUsername: string | null;
  smtpPasswordSet: boolean;

  paymentInstructions: string | null;
  emailTemplates: Record<string, string>;
  notificationPrefs: Record<string, unknown>;
}

const DEFAULTS: AppSettings = {
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

interface SettingsContextValue {
  settings: AppSettings;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SETTINGS_QUERY_KEY = ["app-settings"] as const;

export function SettingsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const r = await axios.get<AppSettings>("/api/settings");
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
    if (settings.companyName) document.title = settings.companyName;
  }, [settings.companyName]);

  const value = useMemo<SettingsContextValue>(() => ({
    settings,
    isLoading,
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
    },
  }), [settings, isLoading, queryClient]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    // Allow consumers to render outside the provider (e.g. print-only routes
    // that mount before the shell). Return defaults rather than throwing.
    return { settings: DEFAULTS, isLoading: false, refresh: async () => {} };
  }
  return ctx;
}
