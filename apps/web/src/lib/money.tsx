import * as React from "react";
import { DirhamSign } from "@/components/ui/DirhamSign";
import { cn } from "@/lib/utils";

// Currency rendering helpers.
//
// The CRM displays AED values in ~200 places. Historically those were inline
// `AED ${value.toLocaleString()}` template-strings, which ship the ISO code as
// raw text — fine for legal/print, ugly for product surfaces, and impossible
// to swap for the new 2023 dirham glyph.
//
// `formatDirham()` returns a JSX <span> with the official symbol followed by
// the formatted number. It's wrapped with `aria-label="<value> UAE dirham"`
// so screen readers announce the unit correctly, and the inner DirhamSign is
// `aria-hidden` to avoid double announcement.
//
// `formatDirhamCompact()` is the kanban/card variant that renders "1.25M",
// "240k", or the raw number under 1k. Same a11y wrapper.
//
// Both helpers are pure (no DB, no context) and locale-aware via
// `toLocaleString("en-AE", …)`.

export interface FormatDirhamOptions {
  /** Fraction digits — default 0 (whole AED). */
  decimals?: number;
  /** Extra classes for the wrapping <span>. */
  className?: string;
}

/**
 * Format a dirham value as `<DirhamSign /> 1,250,000`.
 *
 * Pass `null`/`undefined` to render an em-dash placeholder. Wrapped in a
 * <span> with an aria-label so screen readers announce the unit.
 */
export function formatDirham(
  value: number | null | undefined,
  opts: FormatDirhamOptions = {},
): JSX.Element {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className={opts.className}>—</span>;
  }
  const decimals = opts.decimals ?? 0;
  const formatted = value.toLocaleString("en-AE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span
      className={cn("inline-flex items-baseline gap-1", opts.className)}
      aria-label={`${formatted} UAE dirham`}
    >
      <DirhamSign aria-hidden className="size-[0.9em] shrink-0 self-center" />
      <span>{formatted}</span>
    </span>
  );
}

/**
 * Compact dirham formatter for tight surfaces (kanban cards, sparklines).
 *
 *   ≥ 1,000,000 → "1.25M"
 *   ≥ 1,000     → "240k"
 *   < 1,000     → "850"
 */
export function formatDirhamCompact(
  value: number | null | undefined,
  opts: { className?: string } = {},
): JSX.Element {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className={opts.className}>—</span>;
  }
  const abs = Math.abs(value);
  let text: string;
  if (abs >= 1_000_000) {
    text = `${(value / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  } else if (abs >= 1_000) {
    text = `${Math.round(value / 1_000)}k`;
  } else {
    text = `${Math.round(value)}`;
  }
  return (
    <span
      className={cn("inline-flex items-baseline gap-1", opts.className)}
      aria-label={`${text} UAE dirham`}
    >
      <DirhamSign aria-hidden className="size-[0.9em] shrink-0 self-center" />
      <span>{text}</span>
    </span>
  );
}
