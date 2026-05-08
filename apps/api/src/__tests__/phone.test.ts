import { describe, it, expect } from "vitest";
import { normalizePhone, isValidPhone } from "../lib/phone";

describe("normalizePhone (UAE default)", () => {
  it("normalizes UAE local-format mobiles", () => {
    expect(normalizePhone("0501234567")).toBe("+971501234567");
    expect(normalizePhone("050 123 4567")).toBe("+971501234567");
    expect(normalizePhone("971501234567")).toBe("+971501234567");
    expect(normalizePhone("+971501234567")).toBe("+971501234567");
  });

  it("returns null for invalid or empty input", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("+1")).toBeNull();
  });

  it("respects an explicit country override", () => {
    expect(normalizePhone("+14155238886", "US")).toBe("+14155238886");
  });
});

describe("isValidPhone", () => {
  it("returns true only when normalize succeeds", () => {
    expect(isValidPhone("0501234567")).toBe(true);
    expect(isValidPhone("not-a-phone")).toBe(false);
    expect(isValidPhone(null)).toBe(false);
  });
});
