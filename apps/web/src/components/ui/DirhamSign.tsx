import * as React from "react";
import { cn } from "@/lib/utils";

// UAE dirham currency symbol.
//
// The 2023 UAE Central Bank symbol is in the public domain
// (Wikimedia: File:Dirham_Sign.svg). Network access was unavailable when this
// component was first scaffolded, so the visual below is a *placeholder*: a
// rounded rectangle housing the traditional Arabic abbreviation "د.إ".
// Functionally it gets the same job done — pairs with the value, scales with
// `currentColor`, sits at `1em` next to text — and a follow-up should swap
// the path data for the official 2023 glyph without touching any callers.
//
// Why inline (vs <img>)?  We want it to inherit the parent's text colour, so
// it works on light/dark/destructive/success backgrounds without per-context
// asset overrides.
//
// Accessibility:
//   - Standalone usage:  role="img" aria-label="UAE dirham" (announced).
//   - Inside a labelled value (e.g. formatDirham wraps the whole thing in
//     aria-label="1,250,000 UAE dirham"):  pass `aria-hidden` to suppress
//     the inner glyph from being announced twice.

export interface DirhamSignProps
  extends Omit<React.SVGProps<SVGSVGElement>, "children"> {
  className?: string;
}

const DirhamSign = React.forwardRef<SVGSVGElement, DirhamSignProps>(
  function DirhamSign({ className, ...rest }, ref) {
    // If the parent passes aria-hidden, drop our aria-label so screen readers
    // don't see conflicting hints. Same for an explicit aria-label override.
    const hidden =
      rest["aria-hidden"] === true ||
      rest["aria-hidden"] === "true";
    const ariaProps = hidden
      ? { "aria-hidden": true as const }
      : rest["aria-label"]
        ? {}
        : { role: "img" as const, "aria-label": "UAE dirham" };

    return (
      <svg
        ref={ref}
        viewBox="0 0 344 240"
        width="1em"
        height="1em"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("inline-block align-[-0.125em]", className)}
        {...ariaProps}
        {...rest}
      >
        {/* Placeholder glyph — Arabic abbreviation د.إ in a rounded box.
            See header comment for follow-up note. */}
        <rect
          x="8"
          y="8"
          width="328"
          height="224"
          rx="32"
          ry="32"
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
        />
        <text
          x="172"
          y="170"
          textAnchor="middle"
          fontFamily="'Noto Sans Arabic', 'Segoe UI', sans-serif"
          fontSize="160"
          fontWeight="700"
          fill="currentColor"
        >
          د.إ
        </text>
      </svg>
    );
  },
);

export { DirhamSign };
export default DirhamSign;
