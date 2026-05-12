import * as React from "react";
import { cn } from "@/lib/utils";

// UAE dirham currency symbol — the 2024 Central Bank of the UAE design
// (Latin "D" with two horizontal stripes; the stripes echo the bars on the
// UAE flag and have soft, calligraphic ends inspired by Thuluth / Diwani
// scripts).
//
// Why inline (vs <img>)?  The glyph must inherit the parent's text colour so
// it lands cleanly on every surface — light cards, dark sidebars, destructive
// chips, etc. The Wikimedia hosted asset is locked to fill="black" and would
// also require a network hop.
//
// Visual reconstruction. The Wikimedia upload page (linked from the
// component's header comment) wasn't reachable from this environment so the
// path data below is a faithful reconstruction of the symbol per the CBUAE
// design guidelines. If a pixel-exact match is needed, paste the official
// path data into the single <path> below — every call site (formatDirham,
// inline icons, KPI strips) flows through this component.
//
// Accessibility:
//   - Standalone usage:  role="img" aria-label="UAE dirham" (announced).
//   - Inside a labelled value (e.g. formatDirham wraps the whole thing in
//     aria-label="1,250,000 UAE dirham"):  pass aria-hidden to suppress
//     the inner glyph from being announced twice.

export interface DirhamSignProps
  extends Omit<React.SVGProps<SVGSVGElement>, "children"> {
  className?: string;
}

const DirhamSign = React.forwardRef<SVGSVGElement, DirhamSignProps>(
  function DirhamSign({ className, ...rest }, ref) {
    // Unique mask id per instance — multiple icons can co-exist without
    // collisions (e.g. two side-by-side KPI cards).
    const maskId = React.useId();

    // If the caller passes aria-hidden, drop our aria-label so screen
    // readers don't double-announce.
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
        viewBox="0 0 100 100"
        width="1em"
        height="1em"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("inline-block align-[-0.125em]", className)}
        {...ariaProps}
        {...rest}
      >
        <defs>
          {/*
            The two horizontal stripes are CUT OUT of the bold D rather than
            painted over it, so the symbol works on any background colour.
            Black in a mask = transparent; white = keep.
          */}
          <mask id={maskId} maskUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="white" />
            <line
              x1="0" y1="32" x2="100" y2="32"
              stroke="black" strokeWidth="9" strokeLinecap="round"
            />
            <line
              x1="0" y1="68" x2="100" y2="68"
              stroke="black" strokeWidth="9" strokeLinecap="round"
            />
          </mask>
        </defs>

        {/* Bold D — vertical stem on the left, rounded bowl on the right.
            The two stripes appear as gaps cut by the mask above. */}
        <path
          d="M24 14H50A36 36 0 0 1 50 86H24Z"
          mask={`url(#${maskId})`}
        />

        {/* Left tabs — the parts of the stripes that extend past the D's
            stem. Drawn outside the masked region so the rounded calligraphic
            cap on the left stays visible. */}
        <line
          x1="10" y1="32" x2="28" y2="32"
          stroke="currentColor" strokeWidth="9" strokeLinecap="round"
        />
        <line
          x1="10" y1="68" x2="28" y2="68"
          stroke="currentColor" strokeWidth="9" strokeLinecap="round"
        />
      </svg>
    );
  },
);

export { DirhamSign };
export default DirhamSign;
