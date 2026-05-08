import { describe, it, expect } from "vitest";
import { detectStopIntent } from "../services/inboundProcessor";

describe("detectStopIntent", () => {
  it("matches single STOP keywords", () => {
    expect(detectStopIntent("STOP")).toBe(true);
    expect(detectStopIntent("stop")).toBe(true);
    expect(detectStopIntent("Stop")).toBe(true);
    expect(detectStopIntent("UNSUBSCRIBE")).toBe(true);
    expect(detectStopIntent("cancel")).toBe(true);
    expect(detectStopIntent("END")).toBe(true);
    expect(detectStopIntent("quit")).toBe(true);
  });

  it("matches Arabic STOP keywords", () => {
    expect(detectStopIntent("إيقاف")).toBe(true);
    expect(detectStopIntent("إلغاء")).toBe(true);
    expect(detectStopIntent("اوقف")).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    expect(detectStopIntent("  stop  ")).toBe(true);
    expect(detectStopIntent("\tSTOP\n")).toBe(true);
  });

  it("does NOT trigger on conversational use of stop words", () => {
    // Avoid false positives on natural conversation
    expect(detectStopIntent("I'd like to stop seeing units please")).toBe(false);
    expect(detectStopIntent("Please cancel my appointment")).toBe(false);
    expect(detectStopIntent("This is the end of my budget")).toBe(false);
  });

  it("returns false for null / empty input", () => {
    expect(detectStopIntent(null)).toBe(false);
    expect(detectStopIntent(undefined)).toBe(false);
    expect(detectStopIntent("")).toBe(false);
    expect(detectStopIntent("   ")).toBe(false);
  });
});
