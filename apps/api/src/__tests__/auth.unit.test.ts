import { describe, it, expect, beforeAll } from "vitest";

// Set required env BEFORE importing modules that read it
process.env.JWT_SECRET = process.env.JWT_SECRET || "x".repeat(48);
process.env.DATABASE_URL = process.env.DATABASE_URL || "mysql://test:test@localhost:3306/test";
process.env.NODE_ENV = "test";

import {
  hashPassword,
  verifyPassword,
  passwordMeetsPolicy,
  generateTempPassword,
} from "../lib/password";
import { signSessionToken, verifySessionToken } from "../lib/jwt";

describe("password helpers", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("Hunter2-strong");
    expect(hash).not.toBe("Hunter2-strong");
    expect(await verifyPassword("Hunter2-strong", hash)).toBe(true);
    expect(await verifyPassword("wrong-password-9", hash)).toBe(false);
  });

  it("rejects passwords that do not meet policy", () => {
    expect(passwordMeetsPolicy("short").ok).toBe(false);
    expect(passwordMeetsPolicy("alllowercase").ok).toBe(false); // no number
    expect(passwordMeetsPolicy("12345678").ok).toBe(false); // no letter
    expect(passwordMeetsPolicy("abcd1234").ok).toBe(true);
  });

  it("generates 16-char temp passwords from a safe alphabet", () => {
    const a = generateTempPassword();
    const b = generateTempPassword();
    expect(a).toHaveLength(16);
    expect(b).toHaveLength(16);
    expect(a).not.toBe(b);
    expect(/^[A-Za-z0-9]+$/.test(a)).toBe(true);
  });
});

describe("JWT session tokens", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "x".repeat(48);
    process.env.JWT_EXPIRES_IN = "1h";
  });

  it("round-trips a valid payload", () => {
    const token = signSessionToken({ sub: "u_1", role: "ADMIN", email: "a@b.co" });
    const decoded = verifySessionToken(token);
    expect(decoded?.sub).toBe("u_1");
    expect(decoded?.role).toBe("ADMIN");
    expect(decoded?.email).toBe("a@b.co");
  });

  it("rejects tampered tokens", () => {
    const token = signSessionToken({ sub: "u_1", role: "ADMIN", email: "a@b.co" });
    const tampered = token.slice(0, -2) + (token.endsWith("a") ? "b" : "a") + token.slice(-1);
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifySessionToken("not-a-jwt")).toBeNull();
    expect(verifySessionToken("")).toBeNull();
  });
});
