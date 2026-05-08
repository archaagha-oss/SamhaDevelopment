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
