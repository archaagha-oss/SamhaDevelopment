import { Prisma } from "@prisma/client";

/**
 * Make Prisma's Decimal serialise as a JSON number rather than a JSON object
 * (`{"d":[12345],"e":2,"s":1}`) or a string.
 *
 * Why: this codebase migrates money columns from Float to Decimal(15, 2) (see
 * `prisma/migrations/manual/2026-05-09_money_to_decimal.sql`). Without this
 * patch, every JSON response would change shape and the React frontend would
 * silently break — every `payment.amount` would become an object.
 *
 * How: install the patch at process boot by importing this module once. It
 * mutates `Decimal.prototype.toJSON` so JSON.stringify (used by Express
 * `res.json()`) emits the value as a number. We deliberately use Number()
 * rather than parseFloat — Decimals up to ~15 significant digits round-trip
 * exactly through Number.
 *
 * Caveats:
 *   - Numbers above Number.MAX_SAFE_INTEGER (~9.007e15) lose precision when
 *     converted; that's outside the AED retail real-estate range.
 *   - If you ever need to ship raw Decimal precision over the wire (e.g. an
 *     accounting export), bypass JSON and serialise the Decimal explicitly.
 */
export function installDecimalJsonSerialization(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const D = (Prisma as any).Decimal;
  if (!D || !D.prototype) return;

  // Idempotent — re-importing the module won't double-install.
  if ((D.prototype as any).__samhaJsonPatched) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  D.prototype.toJSON = function toJSON(this: any) {
    return Number(this.toString());
  };
  (D.prototype as any).__samhaJsonPatched = true;
}
