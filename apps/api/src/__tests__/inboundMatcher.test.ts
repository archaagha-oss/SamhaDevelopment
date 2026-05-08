import { describe, it, expect } from "vitest";
import { extractReplyToken } from "../services/inboundMatcher";

describe("extractReplyToken", () => {
  it("extracts the activity id from a clean reply-token address", () => {
    expect(extractReplyToken("reply+ckxyz123@inbound.samha.ae")).toBe("ckxyz123");
  });

  it("handles 'Display Name <reply+id@domain>' shapes", () => {
    expect(extractReplyToken('"Samha" <reply+abcdefg@inbound.samha.ae>')).toBe("abcdefg");
  });

  it("returns null when there's no token prefix", () => {
    expect(extractReplyToken("agent@samha.ae")).toBeNull();
    expect(extractReplyToken("noreply@samha.ae")).toBeNull();
    expect(extractReplyToken("reply@samha.ae")).toBeNull();
  });

  it("returns null on empty / null / undefined input", () => {
    expect(extractReplyToken(null)).toBeNull();
    expect(extractReplyToken(undefined)).toBeNull();
    expect(extractReplyToken("")).toBeNull();
  });

  it("is case-insensitive on the 'reply+' prefix", () => {
    expect(extractReplyToken("REPLY+abc123@inbound.samha.ae")).toBe("abc123");
  });
});
