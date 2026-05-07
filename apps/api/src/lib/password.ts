import bcrypt from "bcryptjs";
import crypto from "crypto";

const BCRYPT_COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generateTempPassword(): string {
  // 16 chars, URL-safe, no ambiguous characters
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";
  const bytes = crypto.randomBytes(16);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export function passwordMeetsPolicy(plain: string): { ok: true } | { ok: false; reason: string } {
  if (plain.length < 8) return { ok: false, reason: "Password must be at least 8 characters" };
  if (plain.length > 200) return { ok: false, reason: "Password is too long" };
  if (!/[A-Za-z]/.test(plain)) return { ok: false, reason: "Password must contain a letter" };
  if (!/[0-9]/.test(plain)) return { ok: false, reason: "Password must contain a number" };
  return { ok: true };
}
