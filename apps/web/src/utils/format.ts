import type { AppSettings } from "../contexts/SettingsContext";

const CURRENCY_LOCALE: Record<string, string> = {
  AED: "en-AE",
  SAR: "en-SA",
  QAR: "en-QA",
  KWD: "en-KW",
  BHD: "en-BH",
  OMR: "en-OM",
  USD: "en-US",
  EUR: "en-GB",
  GBP: "en-GB",
};

export function formatCurrency(
  value: number | null | undefined,
  settings?: Pick<AppSettings, "currency"> | null,
  options: { decimals?: number; showSymbol?: boolean } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const currency = settings?.currency ?? "AED";
  const locale = CURRENCY_LOCALE[currency] ?? "en";
  const decimals = options.decimals ?? 0;
  const formatted = value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return options.showSymbol === false ? formatted : `${currency} ${formatted}`;
}

export function formatDate(
  value: Date | string | number | null | undefined,
  settings?: Pick<AppSettings, "dateFormat" | "timezone"> | null,
): string {
  if (value === null || value === undefined || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const fmt = settings?.dateFormat ?? "DD/MM/YYYY";
  const tz = settings?.timezone ?? undefined;

  // Use Intl in the configured timezone so the displayed date matches the org.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day:   "2-digit",
    month: "2-digit",
    year:  "numeric",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dd = get("day"), mm = get("month"), yyyy = get("year");

  switch (fmt) {
    case "MM/DD/YYYY": return `${mm}/${dd}/${yyyy}`;
    case "YYYY-MM-DD": return `${yyyy}-${mm}-${dd}`;
    case "DD/MM/YYYY":
    default:           return `${dd}/${mm}/${yyyy}`;
  }
}

export function formatDateTime(
  value: Date | string | number | null | undefined,
  settings?: Pick<AppSettings, "dateFormat" | "timezone"> | null,
): string {
  const date = formatDate(value, settings);
  if (!date) return "";
  const d = value instanceof Date ? value : new Date(value as any);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: settings?.timezone ?? undefined,
    hour:   "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${date} ${time}`;
}

/**
 * Compact relative-time formatter for lists / kanban cards.
 *
 * Returns "just now" / "Xm ago" (under 1h), "Xh ago" (under 1d),
 * "yesterday", "Xd ago" (under 30d), or the absolute date for older.
 *
 * Per UX_AUDIT_2 §R4 this is the right choice for list contexts. Detail
 * pages should call `formatDateTime()` instead — `formatTimestamp()` below
 * is the carve-out that lets activity-feed entries stay relative when
 * they're very recent (≤60min) and switch to absolute beyond that.
 */
export function formatRelative(
  value: Date | string | number | null | undefined,
  now: Date = new Date(),
): string {
  if (value === null || value === undefined || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const diffMs = now.getTime() - d.getTime();
  const future = diffMs < 0;
  const absMs = Math.abs(diffMs);
  const m = Math.floor(absMs / 60_000);
  const h = Math.floor(absMs / 3_600_000);
  const days = Math.floor(absMs / 86_400_000);

  if (absMs < 60_000) return future ? "in a moment" : "just now";
  if (m < 60)        return future ? `in ${m}m` : `${m}m ago`;
  if (h < 24)        return future ? `in ${h}h` : `${h}h ago`;
  if (days === 1)    return future ? "tomorrow" : "yesterday";
  if (days < 30)     return future ? `in ${days}d` : `${days}d ago`;

  // Beyond a month — show absolute date (no time).
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Hybrid timestamp formatter for activity feeds inside detail pages.
 *
 * - ≤ 60 minutes old → "just now" / "Xm ago" (relative, CRM convention)
 * - otherwise        → `formatDateTime(value, settings)` (absolute)
 *
 * Use this in `ConversationThread`, `DealActivityPanel`, and any other
 * timeline that lives inside a detail page (UX_AUDIT_2 §R4).
 */
export function formatTimestamp(
  value: Date | string | number | null | undefined,
  settings?: Pick<AppSettings, "dateFormat" | "timezone"> | null,
  now: Date = new Date(),
): string {
  if (value === null || value === undefined || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = now.getTime() - d.getTime();
  if (diffMs >= 0 && diffMs < 60 * 60_000) {
    return formatRelative(value, now);
  }
  return formatDateTime(value, settings);
}
