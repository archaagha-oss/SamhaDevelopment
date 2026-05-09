import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { DEFAULT_PRIMARY_HEX, DEFAULT_SECONDARY_HEX } from "@/constants/brand";

export interface AppSettings {
  id?: string;
  organizationId: string;

  companyName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;

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

  // Twilio (operator config — non-secret)
  twilioWhatsappFrom: string | null;
  twilioMessagingServiceSid: string | null;
  twilioWhatsappContentSidBeforeDue: string | null;
  twilioWhatsappContentSidOnDue: string | null;
  twilioWhatsappContentSidOverdue7: string | null;
  twilioWhatsappContentSidOverdue30: string | null;

  // Inbound email
  inboundEmailDomain: string | null;
  sendgridInboundTokenSet: boolean;

  paymentInstructions: string | null;
  emailTemplates: Record<string, string>;
  notificationPrefs: NotificationPrefs;

  // UI theme — actual rendered theme is "system" → resolves at runtime to OS preference.
  theme: "light" | "dark" | "system";

  // Feature flags — operator-controlled toggles. Missing keys fall back to catalog default.
  featureFlags: Record<string, boolean>;
}

export interface NotificationPrefs {
  /** Channel-level master switches. */
  channels?: {
    inApp?: boolean;
    email?: boolean;
    sms?: boolean;
    whatsapp?: boolean;
  };
  /** Event-level preferences keyed by event type. */
  events?: Record<string, { inApp?: boolean; email?: boolean; sms?: boolean; whatsapp?: boolean }>;
  /** Quiet hours (no notifications between these times — 24h "HH:MM"). */
  quietHours?: { enabled: boolean; start: string; end: string };
}

const DEFAULTS: AppSettings = {
  organizationId: "",
  companyName: "Samha CRM",
  logoUrl: null,
  primaryColor: DEFAULT_PRIMARY_HEX,
  secondaryColor: DEFAULT_SECONDARY_HEX,
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
  twilioWhatsappFrom: null,
  twilioMessagingServiceSid: null,
  twilioWhatsappContentSidBeforeDue: null,
  twilioWhatsappContentSidOnDue: null,
  twilioWhatsappContentSidOverdue7: null,
  twilioWhatsappContentSidOverdue30: null,
  inboundEmailDomain: null,
  sendgridInboundTokenSet: false,
  paymentInstructions: null,
  emailTemplates: {},
  notificationPrefs: {},
  theme: "system",
  featureFlags: {},
};

interface SettingsContextValue {
  settings: AppSettings;
  isLoading: boolean;
  refresh: () => Promise<void>;
  /** Resolve a feature flag — falls back to the `fallback` argument when not present. */
  isFeatureEnabled: (key: string, fallback?: boolean) => boolean;
}

/**
 * Apply the chosen theme to <html data-theme=…>. "system" subscribes to the OS
 * preference and updates the attribute live; the listener cleans itself up
 * when called again with a different theme.
 */
let mqUnsub: (() => void) | null = null;
export function applyTheme(theme: "light" | "dark" | "system"): void {
  const root = document.documentElement;
  // Tear down any previous matchMedia listener.
  if (mqUnsub) { mqUnsub(); mqUnsub = null; }

  if (theme === "system") {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => root.setAttribute("data-theme", mq.matches ? "dark" : "light");
    apply();
    mq.addEventListener("change", apply);
    mqUnsub = () => mq.removeEventListener("change", apply);
    return;
  }
  root.setAttribute("data-theme", theme);
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

// Apply a hex color to the design-system brand axis (--brand-h / --brand-s).
// Falls back to default blue if the hex is invalid. Also sets --brand-primary
// for legacy direct-hex consumers (e.g. Sidebar's tenant accent).
export function applyBrandFromHex(hex: string | null | undefined): void {
  const valid = hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : DEFAULT_PRIMARY_HEX;
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", valid);
  const hsl = hexToHsl(valid);
  if (hsl) {
    root.style.setProperty("--brand-h", String(hsl.h));
    root.style.setProperty("--brand-s", `${hsl.s}%`);
  }
}

// Apply a hex color to the secondary brand axis (--brand2-h / --brand2-s).
// Drives the accent-2 semantic, the violet "active" stage, and chart-2.
export function applyBrand2FromHex(hex: string | null | undefined): void {
  const valid = hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : DEFAULT_SECONDARY_HEX;
  const root = document.documentElement;
  root.style.setProperty("--brand-secondary", valid);
  const hsl = hexToHsl(valid);
  if (hsl) {
    root.style.setProperty("--brand2-h", String(hsl.h));
    root.style.setProperty("--brand2-s", `${hsl.s}%`);
  }
}

// Convert a `#rrggbb` hex to HSL components (h: 0–360, s/l: 0–100).
export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = hex.match(/^#([0-9a-fA-F]{6})$/);
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 0xff) / 255;
  const g = ((int >> 8) & 0xff) / 255;
  const b = (int & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

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

  // Apply brand colors to the design-system axes. The whole token-based theme
  // rotates around these values; see design-system/MASTER.md and BRAND.md.
  useEffect(() => {
    applyBrandFromHex(settings.primaryColor);
  }, [settings.primaryColor]);

  useEffect(() => {
    applyBrand2FromHex(settings.secondaryColor);
  }, [settings.secondaryColor]);

  // Reflect company name in document title.
  useEffect(() => {
    if (settings.companyName) document.title = settings.companyName;
  }, [settings.companyName]);

  // Apply theme. "system" follows the OS preference live via matchMedia.
  useEffect(() => {
    applyTheme(settings.theme ?? "system");
  }, [settings.theme]);

  const isFeatureEnabled = useMemo(() => {
    return (key: string, fallback = false) =>
      key in (settings.featureFlags ?? {}) ? !!settings.featureFlags[key] : fallback;
  }, [settings.featureFlags]);

  const value = useMemo<SettingsContextValue>(() => ({
    settings,
    isLoading,
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
    },
    isFeatureEnabled,
  }), [settings, isLoading, queryClient, isFeatureEnabled]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    // Allow consumers to render outside the provider (e.g. print-only routes
    // that mount before the shell). Return defaults rather than throwing.
    return {
      settings: DEFAULTS,
      isLoading: false,
      refresh: async () => {},
      isFeatureEnabled: (_k, fallback = false) => fallback,
    };
  }
  return ctx;
}
