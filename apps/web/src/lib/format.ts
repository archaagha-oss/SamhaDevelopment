/**
 * Canonical formatters.
 *
 * Use these instead of inline `n.toLocaleString(...)` or
 * `Intl.NumberFormat(...)` so that money and number rendering stays
 * consistent across every page. Print pages may keep their own formatters
 * for legal-document fidelity, but in-app surfaces should adopt these.
 */

const AE_LOCALE = "en-AE";

export interface FormatAEDOptions {
  /** Number of fraction digits. Default 0 (no fils). Pass 2 for reconciliation contexts. */
  fractionDigits?: 0 | 2;
  /** "AED 1.5M" / "AED 250K" — useful in KPI tiles. Falls back to full when < 10,000. */
  compact?: boolean;
  /** Render the value without the leading "AED " (e.g. inside a table column with a separate header). */
  bare?: boolean;
}

/**
 * Format a money amount in AED.
 *
 *   formatAED(1500000)                    → "AED 1,500,000"
 *   formatAED(1500000.50, { fractionDigits: 2 }) → "AED 1,500,000.50"
 *   formatAED(1500000, { compact: true }) → "AED 1.5M"
 *   formatAED(1500000, { bare: true })    → "1,500,000"
 *
 * Accepts numbers, Decimal-like objects (anything with toString()), and
 * nullish — null/undefined renders as "—".
 */
export function formatAED(
  value: number | string | null | undefined,
  options: FormatAEDOptions = {}
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";

  const { fractionDigits = 0, compact = false, bare = false } = options;
  const prefix = bare ? "" : "AED ";

  if (compact && Math.abs(n) >= 10_000) {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1_000_000_000) return `${prefix}${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${prefix}${sign}${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${prefix}${sign}${(abs / 1_000).toFixed(0)}K`;
  }

  return (
    prefix +
    n.toLocaleString(AE_LOCALE, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
  );
}

/**
 * Format a non-currency number with locale-aware thousand separators.
 *
 *   formatNumber(15000) → "15,000"
 */
export function formatNumber(
  value: number | string | null | undefined,
  fractionDigits = 0
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(AE_LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * Parse a user-entered money string back to a number. Accepts:
 *   "1,500,000"   → 1500000
 *   "1500000"     → 1500000
 *   "AED 1.5M"    → 1500000
 *   "  "          → null
 * Returns null when input cannot be parsed (caller should treat as invalid).
 */
export function parseAEDInput(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const s = input.trim().replace(/^AED\s*/i, "").replace(/,/g, "");
  if (!s) return null;

  // Compact suffix support
  const m = /^(-?\d+(?:\.\d+)?)([KkMmBb])?$/.exec(s);
  if (!m) return null;
  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = m[2]?.toUpperCase();
  const mult = suffix === "K" ? 1_000 : suffix === "M" ? 1_000_000 : suffix === "B" ? 1_000_000_000 : 1;
  return base * mult;
}
