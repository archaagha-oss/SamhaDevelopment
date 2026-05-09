// Brand defaults — single source of truth.
//
// These hex values mirror the runtime CSS tokens in `index.css`
// (--brand-h: 217 91%  →  #2563eb, --brand2-h: 262 83%  →  #7c3aed).
// Anywhere code needs a hex literal for the default brand (server fallback,
// validator default, color-picker placeholder, etc.) it must import from here
// instead of inlining the literal — otherwise a rebrand requires hunting
// through every file that ever needed a fallback.

export const DEFAULT_PRIMARY_HEX = "#2563eb";
export const DEFAULT_SECONDARY_HEX = "#7c3aed";
