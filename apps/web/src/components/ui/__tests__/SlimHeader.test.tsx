import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import SlimHeader, { SlimHeaderSentinel } from "../SlimHeader";

// Minimal IntersectionObserver mock — captures the most-recent callback so
// tests can drive visibility deterministically.
type IOCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
let lastCallback: IOCallback | null = null;

class MockIntersectionObserver {
  constructor(cb: IOCallback) {
    lastCallback = cb;
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  lastCallback = null;
  (globalThis as any).IntersectionObserver = MockIntersectionObserver;
});

describe("SlimHeader", () => {
  it("starts hidden (aria-hidden + off-screen translate)", () => {
    render(
      <>
        <SlimHeader primary={<span>Lead-001</span>} />
        <SlimHeaderSentinel />
      </>,
    );
    const banner = screen.getByRole("banner", { hidden: true });
    expect(banner).toHaveAttribute("aria-hidden", "true");
    expect(banner).toHaveAttribute("data-visible", "false");
  });

  it("becomes visible once the sentinel scrolls out of the viewport", () => {
    render(
      <>
        <SlimHeader primary={<span>Lead-001</span>} />
        <SlimHeaderSentinel />
      </>,
    );

    expect(lastCallback).toBeTypeOf("function");
    act(() => {
      lastCallback?.([{ isIntersecting: false }]);
    });

    const banner = screen.getByRole("banner");
    expect(banner).toHaveAttribute("data-visible", "true");
    expect(banner).toHaveAttribute("aria-hidden", "false");
  });

  it("renders primary, badges, and actions slots (even while hidden)", () => {
    render(
      <>
        <SlimHeader
          primary={<span>Lead-001 · Mohamed</span>}
          badges={<span>NEW</span>}
          actions={<button>Next</button>}
        />
        <SlimHeaderSentinel />
      </>,
    );
    expect(screen.getByText(/Lead-001/)).toBeInTheDocument();
    expect(screen.getByText("NEW")).toBeInTheDocument();
    // Hidden via aria-hidden until the sentinel scrolls out; pass { hidden: true }
    // to RTL so it still finds it.
    expect(screen.getByRole("button", { name: /next/i, hidden: true })).toBeInTheDocument();
  });

  it("renders the back button by default and calls onBack when clicked", () => {
    const onBack = vi.fn();
    render(
      <>
        <SlimHeader primary={<span>X</span>} onBack={onBack} />
        <SlimHeaderSentinel />
      </>,
    );
    // Drive the sentinel out so the header becomes visible / interactable.
    act(() => {
      lastCallback?.([{ isIntersecting: false }]);
    });
    const backBtn = screen.getByRole("button", { name: /back/i });
    backBtn.click();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("hides the back button when hideBack=true", () => {
    render(
      <>
        <SlimHeader primary={<span>X</span>} hideBack />
        <SlimHeaderSentinel />
      </>,
    );
    expect(screen.queryByRole("button", { name: /back/i })).toBeNull();
  });
});
