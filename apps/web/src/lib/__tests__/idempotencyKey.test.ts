import { describe, it, expect } from "vitest";
import {
  IDEMPOTENT_POST_PATTERNS,
  shouldAttachIdempotencyKey,
} from "@/lib/axiosBootstrap";

// Pure unit test of the URL-pattern matching logic. We import the predicate
// directly (it was made `export` solely for this test — runtime behaviour is
// unchanged). We pass a minimal { method, url } object since the predicate
// only needs those two fields.
//
// Coverage rationale: a regression here would silently let duplicate POSTs
// through on retry, creating duplicate deals or payments. That's worth a
// belt-and-braces test even though the patterns are short.

describe("shouldAttachIdempotencyKey", () => {
  it("attaches on POST /api/deals (with and without trailing slash, with and without leading slash)", () => {
    for (const url of [
      "/api/deals",
      "/api/deals/",
      "api/deals",
      "api/deals/",
    ]) {
      expect(
        shouldAttachIdempotencyKey({ method: "POST", url }),
      ).toBe(true);
    }
  });

  it("attaches on POST /api/deals/:id/payments", () => {
    expect(
      shouldAttachIdempotencyKey({
        method: "POST",
        url: "/api/deals/abc-123/payments",
      }),
    ).toBe(true);
    expect(
      shouldAttachIdempotencyKey({
        method: "POST",
        url: "/api/deals/abc-123/payments/",
      }),
    ).toBe(true);
  });

  it("attaches on POST /api/payments/:id/partial", () => {
    expect(
      shouldAttachIdempotencyKey({
        method: "POST",
        url: "/api/payments/pay_42/partial",
      }),
    ).toBe(true);
  });

  it("ignores non-POST methods on the same paths", () => {
    for (const method of ["GET", "PUT", "PATCH", "DELETE", "HEAD"]) {
      expect(
        shouldAttachIdempotencyKey({ method, url: "/api/deals" }),
      ).toBe(false);
    }
  });

  it("is case-insensitive on the method", () => {
    expect(
      shouldAttachIdempotencyKey({ method: "post", url: "/api/deals" }),
    ).toBe(true);
  });

  it("does not attach on unrelated POST endpoints", () => {
    for (const url of [
      "/api/leads",
      "/api/users",
      "/api/deals/abc/notes",
      "/api/deals/abc/payments/sub",
      "/api/payments/pay_1",
      "/api/payments/pay_1/partial/extra",
      "",
    ]) {
      expect(
        shouldAttachIdempotencyKey({ method: "POST", url }),
      ).toBe(false);
    }
  });

  it("handles missing method/url defensively", () => {
    expect(
      shouldAttachIdempotencyKey({ method: undefined, url: "/api/deals" }),
    ).toBe(false);
    expect(
      shouldAttachIdempotencyKey({ method: "POST", url: undefined }),
    ).toBe(false);
  });

  it("exposes the pattern list so callers can audit coverage", () => {
    // Smoke-check the published patterns — if a future refactor renames or
    // removes one, the test will surface it loudly.
    expect(IDEMPOTENT_POST_PATTERNS).toHaveLength(3);
    expect(IDEMPOTENT_POST_PATTERNS.every((p) => p instanceof RegExp)).toBe(
      true,
    );
  });
});
