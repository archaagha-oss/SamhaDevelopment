import { describe, it, expect } from "vitest";
import {
  rankByEngagement,
  isDeliverable,
  type PreferenceRow,
} from "../services/communicationPreferenceService";

function makePref(overrides: Partial<PreferenceRow> = {}): PreferenceRow {
  return {
    id: "p1",
    preferredChannel: null,
    emailOptOut: false,
    whatsappOptOut: false,
    smsOptOut: false,
    emailSent: 0,
    whatsappSent: 0,
    smsSent: 0,
    emailReplies: 0,
    whatsappReplies: 0,
    smsReplies: 0,
    emailOpens: 0,
    emailClicks: 0,
    whatsappReads: 0,
    lastEmailReplyAt: null,
    lastWhatsappReplyAt: null,
    lastSmsReplyAt: null,
    ...overrides,
  };
}

describe("isDeliverable", () => {
  const baseInput = { hasEmail: true, hasPhone: true };

  it("requires the underlying contact info", () => {
    expect(isDeliverable("EMAIL", { hasEmail: false, hasPhone: true }, null)).toBe(false);
    expect(isDeliverable("WHATSAPP", { hasEmail: true, hasPhone: false }, null)).toBe(false);
    expect(isDeliverable("SMS", { hasEmail: true, hasPhone: false }, null)).toBe(false);
  });

  it("respects per-channel opt-outs", () => {
    expect(isDeliverable("EMAIL",    baseInput, makePref({ emailOptOut: true    }))).toBe(false);
    expect(isDeliverable("WHATSAPP", baseInput, makePref({ whatsappOptOut: true }))).toBe(false);
    expect(isDeliverable("SMS",      baseInput, makePref({ smsOptOut: true      }))).toBe(false);
    expect(isDeliverable("EMAIL",    baseInput, makePref())).toBe(true);
  });
});

describe("rankByEngagement", () => {
  it("returns empty when no signals exist", () => {
    expect(rankByEngagement(makePref())).toEqual([]);
  });

  it("prefers the channel with a recent reply", () => {
    const pref = makePref({
      lastWhatsappReplyAt: new Date(),
      whatsappReplies: 1,
      whatsappSent: 1,
    });
    expect(rankByEngagement(pref)[0]).toBe("WHATSAPP");
  });

  it("ignores replies older than 30 days; falls through to ratio tier", () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const pref = makePref({
      // Stale WhatsApp reply — should NOT short-circuit ranking
      lastWhatsappReplyAt: fortyDaysAgo,
      whatsappReplies: 1,
      whatsappSent: 10,        // ratio = 3/10 = 0.3
      // Email has stronger ratio
      emailSent: 10,
      emailReplies: 10,        // ratio = 30/10 = 3.0
    });
    expect(rankByEngagement(pref)[0]).toBe("EMAIL");
  });

  it("ranks by reply ratio when no recent reply exists", () => {
    const pref = makePref({
      emailSent: 10,
      emailReplies: 5,    // ratio 0.5 + small open weight
      whatsappSent: 10,
      whatsappReplies: 1, // ratio 0.1
      smsSent: 10,
      smsReplies: 0,      // ratio 0 — filtered out
    });
    const ranked = rankByEngagement(pref);
    expect(ranked[0]).toBe("EMAIL");
    expect(ranked[1]).toBe("WHATSAPP");
    expect(ranked).not.toContain("SMS");
  });

  it("weights clicks higher than opens (Apple Mail Privacy)", () => {
    // Email has high opens but no clicks/replies; WhatsApp has reads.
    const pref = makePref({
      emailSent: 10,
      emailReplies: 0,
      emailOpens: 10,    // weight 0.2 each → 2.0
      emailClicks: 0,
      whatsappSent: 10,
      whatsappReplies: 0,
      whatsappReads: 10, // weight 0.5 each → 5.0
    });
    const ranked = rankByEngagement(pref);
    expect(ranked[0]).toBe("WHATSAPP");
  });
});
