import * as React from "react";
import { cn } from "@/lib/utils";

// UAE dirham currency symbol — the 2024 Central Bank of the UAE design
// (Latin "D" with two horizontal stripes; the stripes echo the bars on the
// UAE flag and have soft, calligraphic ends inspired by Thuluth / Diwani
// scripts).
//
// Path data is the official CBUAE artwork — single self-contained <path>,
// no mask required. Source: user-supplied SVG (matches the Wikimedia file
// File:UAE_Dirham_Symbol.svg).
//
// Why inline (vs <img>)?  The glyph must inherit the parent's text colour so
// it lands cleanly on every surface — light cards, dark sidebars, destructive
// chips, etc. — and a remote CDN would add a network hop.
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
        viewBox="0 0 131 114"
        width="1em"
        height="1em"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("inline-block align-[-0.125em]", className)}
        {...ariaProps}
        {...rest}
      >
        <path d="M130.254 54.8906L129.264 53.9766C127.664 52.4531 125.76 51.6914 123.703 51.6914H113.039C113.191 53.5195 113.268 55.3477 113.268 57.3281C113.268 59.3086 113.191 61.1367 113.039 63.041H120.275C125.76 63.041 130.254 68.2207 130.254 74.6953V77.5898L129.264 76.5996C127.664 75.1523 125.76 74.3906 123.703 74.3906H111.439C105.574 100.061 85.084 114 52.7871 114H11.3496C11.3496 114 16.9863 109.658 16.9863 95.1094V74.3906H10.0547C4.49414 74.3906 0 69.1348 0 62.7363V59.8418L1.06641 60.7559C2.58984 62.2031 4.49414 63.041 6.55078 63.041H16.9863V51.6914H10.0547C4.49414 51.6914 0 46.4355 0 40.0371V37.1426L1.06641 38.1328C2.58984 39.5801 4.49414 40.3418 6.55078 40.3418H16.9863V20.4609C16.9863 5.45508 11.3496 0.732422 11.3496 0.732422H52.7871C84.1699 0.732422 105.193 14.5195 111.363 40.3418H120.275C125.76 40.3418 130.254 45.5215 130.254 51.9961V54.8906ZM51.2637 6.36914H33.9727V40.3418H92.0918C88.1309 16.7285 74.6484 6.36914 51.2637 6.36914ZM93.4629 57.3281C93.4629 55.3477 93.3867 53.5195 93.3105 51.6914H33.9727V63.041H93.3105C93.3867 61.1367 93.4629 59.3086 93.4629 57.3281ZM33.9727 108.287H51.416C76.1719 107.678 88.3594 95.7949 92.0918 74.3906H33.9727V108.287Z" />
      </svg>
    );
  },
);

export { DirhamSign };
export default DirhamSign;
