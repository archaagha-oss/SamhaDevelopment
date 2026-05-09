/**
 * Centralised formatters. Use these everywhere instead of inline toLocaleString.
 */

export function formatAED(value: number | null | undefined, opts: { decimals?: number; compact?: boolean } = {}): string {
  if (value == null || isNaN(Number(value))) return "—";
  const n = Number(value);
  if (opts.compact && Math.abs(n) >= 1_000_000) {
    return `AED ${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (opts.compact && Math.abs(n) >= 1_000) {
    return `AED ${(n / 1_000).toFixed(0)}K`;
  }
  return `AED ${n.toLocaleString("en-AE", {
    minimumFractionDigits: opts.decimals ?? 0,
    maximumFractionDigits: opts.decimals ?? 0,
  })}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("en-AE");
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60)        return "just now";
  if (diff < 3600)      return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400)    return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86_400 * 7) return `${Math.floor(diff / 86_400)}d ago`;
  return formatDate(d);
}

export function formatPct(value: number | null | undefined, decimals = 1): string {
  if (value == null || isNaN(Number(value))) return "—";
  return `${Number(value).toFixed(decimals).replace(/\.0+$/, "")}%`;
}
