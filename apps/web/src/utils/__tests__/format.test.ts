import { describe, it, expect } from "vitest";
import { formatRelative, formatTimestamp } from "../format";

const NOW = new Date("2026-06-01T12:00:00Z");

describe("formatRelative", () => {
  it("returns empty string for null / undefined / empty", () => {
    expect(formatRelative(null, NOW)).toBe("");
    expect(formatRelative(undefined, NOW)).toBe("");
    expect(formatRelative("", NOW)).toBe("");
  });

  it("handles 'just now' (<60s)", () => {
    expect(formatRelative(new Date(NOW.getTime() - 30_000), NOW)).toBe("just now");
  });

  it("handles minutes-ago", () => {
    expect(formatRelative(new Date(NOW.getTime() - 5 * 60_000), NOW)).toBe("5m ago");
  });

  it("handles hours-ago", () => {
    expect(formatRelative(new Date(NOW.getTime() - 3 * 3_600_000), NOW)).toBe("3h ago");
  });

  it("handles 'yesterday'", () => {
    expect(formatRelative(new Date(NOW.getTime() - 36 * 3_600_000), NOW)).toBe("yesterday");
  });

  it("handles days-ago", () => {
    expect(formatRelative(new Date(NOW.getTime() - 12 * 86_400_000), NOW)).toBe("12d ago");
  });

  it("falls back to absolute date for ≥30d old", () => {
    const result = formatRelative(new Date("2026-01-15T00:00:00Z"), NOW);
    // Locale-dependent format but should contain "Jan" and "2026".
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/2026/);
  });

  it("handles future timestamps", () => {
    expect(formatRelative(new Date(NOW.getTime() + 5 * 60_000), NOW)).toBe("in 5m");
    expect(formatRelative(new Date(NOW.getTime() + 86_400_000), NOW)).toBe("tomorrow");
    expect(formatRelative(new Date(NOW.getTime() + 7 * 86_400_000), NOW)).toBe("in 7d");
  });

  it("returns empty string for invalid date input", () => {
    expect(formatRelative("not a date", NOW)).toBe("");
  });
});

describe("formatTimestamp (hybrid)", () => {
  it("uses relative format for ≤60min", () => {
    expect(formatTimestamp(new Date(NOW.getTime() - 30 * 60_000), null, NOW)).toBe("30m ago");
  });

  it("uses absolute format for >60min", () => {
    const result = formatTimestamp(new Date(NOW.getTime() - 90 * 60_000), null, NOW);
    // Should contain the date in DD/MM/YYYY or similar, NOT "1h ago"
    expect(result).not.toMatch(/ago/);
    expect(result).toMatch(/\d{2}/);
  });

  it("returns empty for null / undefined", () => {
    expect(formatTimestamp(null, null, NOW)).toBe("");
    expect(formatTimestamp(undefined, null, NOW)).toBe("");
  });
});
