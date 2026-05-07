/**
 * Money utilities — single-currency AED, integer fils (1 AED = 100 fils).
 *
 * All financial math should flow through these helpers. Float arithmetic on
 * AED amounts (the existing `Float` columns) accumulates fractional drift
 * across thousands of milestones; fils-as-BigInt is exact.
 *
 * Conversion policy:
 *  - Inbound: aedToFils(1234.56) → 123456n
 *  - Outbound (display): filsToAed(123456n) → 1234.56
 *  - Banker's rounding (round half to even) on division to minimize bias.
 */

export const FILS_PER_AED = 100n;

/**
 * Convert an AED amount to integer fils.
 * Accepts number, string, or bigint; rejects non-finite numbers.
 */
export function aedToFils(aed: number | string | bigint): bigint {
  if (typeof aed === "bigint") {
    return aed * FILS_PER_AED;
  }
  const n = typeof aed === "string" ? Number(aed) : aed;
  if (!Number.isFinite(n)) {
    throw new Error(`aedToFils: not a finite number: ${aed}`);
  }
  // Round to nearest fils, half-to-even.
  // Multiply via toFixed(2) string to avoid float-binary drift on .005 values.
  const fixed = n.toFixed(2);
  const [intPart, fracPart = "00"] = fixed.split(".");
  const sign = intPart.startsWith("-") ? -1n : 1n;
  const absInt = BigInt((intPart.startsWith("-") ? intPart.slice(1) : intPart));
  const frac = BigInt(fracPart.padEnd(2, "0").slice(0, 2));
  return sign * (absInt * FILS_PER_AED + frac);
}

/**
 * Convert integer fils to AED for display only.
 * Returns a number — never use for further math; use BigInt fils throughout.
 */
export function filsToAed(fils: bigint | number): number {
  const big = typeof fils === "bigint" ? fils : BigInt(fils);
  // Two-decimal AED display
  const negative = big < 0n;
  const abs = negative ? -big : big;
  const aedPart = abs / FILS_PER_AED;
  const filsPart = abs % FILS_PER_AED;
  const num = Number(aedPart) + Number(filsPart) / 100;
  return negative ? -num : num;
}

/**
 * Apply a percentage to a fils amount, rounding half-to-even.
 * percentage is a number like 4 (for 4%) or 0.5 (for 0.5%).
 */
export function applyPercent(fils: bigint, percentage: number): bigint {
  if (!Number.isFinite(percentage)) {
    throw new Error(`applyPercent: not a finite percentage: ${percentage}`);
  }
  // Scale percentage to integer to keep math exact: percentage * 1e6 → bigint
  const scaled = BigInt(Math.round(percentage * 1_000_000));
  // result = fils * scaled / 100_000_000 ; round half-to-even
  return divRoundHalfEven(fils * scaled, 100_000_000n);
}

/**
 * Divide a / b with banker's rounding (round half to even).
 * Both inputs must be bigint; b must be non-zero.
 */
export function divRoundHalfEven(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error("divRoundHalfEven: divide by zero");
  const sign = (a < 0n) !== (b < 0n) ? -1n : 1n;
  const absA = a < 0n ? -a : a;
  const absB = b < 0n ? -b : b;

  const quot = absA / absB;
  const rem = absA % absB;
  const twiceRem = rem * 2n;

  let result = quot;
  if (twiceRem > absB) {
    result = quot + 1n;
  } else if (twiceRem === absB) {
    // half — round to even
    if (quot % 2n !== 0n) result = quot + 1n;
  }
  return sign * result;
}

/**
 * Sum a list of fils values.
 */
export function sumFils(values: Array<bigint | null | undefined>): bigint {
  let total = 0n;
  for (const v of values) {
    if (v != null) total += v;
  }
  return total;
}

/**
 * Format fils as "AED 1,234.56" for display.
 */
export function formatAed(fils: bigint | number | null | undefined): string {
  if (fils == null) return "AED 0.00";
  const aed = filsToAed(fils);
  return `AED ${aed.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
