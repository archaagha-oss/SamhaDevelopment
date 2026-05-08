import { describe, it, expect } from "vitest";
import {
  detectPortal,
  parsePortalLeadEmail,
} from "../services/portalLeadParserService";

describe("detectPortal", () => {
  it("detects Bayut from subject", () => {
    expect(detectPortal("New Lead from Bayut", "noreply@bayut.com", "")).toBe("BAYUT");
  });
  it("detects Property Finder from from-address", () => {
    expect(detectPortal("New Inquiry", "leads@propertyfinder.ae", "")).toBe("PROPERTY_FINDER");
  });
  it("detects Dubizzle from body", () => {
    expect(detectPortal("Lead", "noreply@example.com", "Sent via dubizzle.com")).toBe("DUBIZZLE");
  });
  it("falls back to UNKNOWN", () => {
    expect(detectPortal("Hi", "x@x.com", "nothing relevant")).toBe("UNKNOWN");
  });
});

describe("parsePortalLeadEmail", () => {
  it("parses a Bayut lead with UAE local phone", () => {
    const body = [
      "Name: Ahmed Al Mansouri",
      "Mobile: 0501234567",
      "Email: ahmed@example.com",
      "Property Reference: 12-03",
      "Message: I'm interested in this unit",
    ].join("\n");
    const result = parsePortalLeadEmail({
      subject: "[Bayut] New Lead",
      fromAddress: "noreply@bayut.com",
      body,
    });
    expect(result.portal).toBe("BAYUT");
    expect(result.firstName).toBe("Ahmed");
    expect(result.lastName).toBe("Al Mansouri");
    expect(result.phone).toBe("+971501234567");
    expect(result.email).toBe("ahmed@example.com");
    expect(result.propertyReference).toBe("12-03");
    expect(result.message).toBe("I'm interested in this unit");
  });

  it("parses a Property Finder lead", () => {
    const body = [
      "Name: Sara Khan",
      "Phone: +971 55 999 8888",
      "Email: sara@example.com",
      "Reference: ABC-12",
      "Inquiry: Looking for 2BR sea view",
    ].join("\n");
    const result = parsePortalLeadEmail({
      subject: "Property Finder Lead",
      fromAddress: "no-reply@propertyfinder.ae",
      body,
    });
    expect(result.portal).toBe("PROPERTY_FINDER");
    expect(result.firstName).toBe("Sara");
    expect(result.lastName).toBe("Khan");
    expect(result.phone).toBe("+971559998888");
    expect(result.message).toBe("Looking for 2BR sea view");
  });

  it("returns UNKNOWN portal when nothing matches", () => {
    const result = parsePortalLeadEmail({
      subject: "Newsletter",
      fromAddress: "news@example.com",
      body: "Just a newsletter",
    });
    expect(result.portal).toBe("UNKNOWN");
    expect(result.phone).toBe("");
  });
});
