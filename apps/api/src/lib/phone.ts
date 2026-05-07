/**
 * Phone number normalization to E.164.
 *
 * UAE numbers come in messy variants: +971 5x, 0501234567, 971501234567, etc.
 * libphonenumber-js handles all of these with a country hint.
 */

import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

const DEFAULT_COUNTRY: CountryCode = "AE";

export function normalizePhone(
  raw: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_COUNTRY
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
    if (!parsed?.isValid()) return null;
    return parsed.number; // E.164, e.g. "+971501234567"
  } catch {
    return null;
  }
}

export function isValidPhone(raw: string | null | undefined, defaultCountry: CountryCode = DEFAULT_COUNTRY): boolean {
  return normalizePhone(raw, defaultCountry) !== null;
}
