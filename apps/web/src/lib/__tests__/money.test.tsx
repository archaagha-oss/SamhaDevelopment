import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { formatDirham, formatDirhamCompact } from "@/lib/money";

// Pure-output tests for the dirham formatters.
//
// Coverage goals:
//   1. null/undefined → em-dash (no crash, no symbol).
//   2. zero renders the symbol + "0".
//   3. integer formatting uses thousands separators (en-AE).
//   4. decimals option respects the minimum/maximum fraction digits.
//   5. compact: ≥1M → "1.25M", ≥1k → "240k", < 1k → raw int.
//   6. aria-label wraps the value group so screen readers announce "UAE dirham".

describe("formatDirham", () => {
  it("renders an em-dash for null/undefined/NaN", () => {
    const { container: nullCt } = render(<>{formatDirham(null)}</>);
    expect(nullCt.textContent).toBe("—");
    const { container: undCt } = render(<>{formatDirham(undefined)}</>);
    expect(undCt.textContent).toBe("—");
    const { container: nanCt } = render(<>{formatDirham(Number.NaN)}</>);
    expect(nanCt.textContent).toBe("—");
  });

  it("renders zero with the dirham symbol", () => {
    render(<div data-testid="z">{formatDirham(0)}</div>);
    const node = screen.getByTestId("z");
    expect(node.textContent).toContain("0");
    // The DirhamSign renders an inline <svg>; assert presence so we know the
    // symbol is wired up (regression catcher if the import drifts).
    expect(node.querySelector("svg")).not.toBeNull();
  });

  it("formats integers with thousands separators", () => {
    render(<div data-testid="big">{formatDirham(1_250_000)}</div>);
    const text = screen.getByTestId("big").textContent ?? "";
    // en-AE uses ASCII comma as group separator.
    expect(text).toContain("1,250,000");
  });

  it("respects the decimals option", () => {
    render(<div data-testid="d">{formatDirham(1234.5, { decimals: 2 })}</div>);
    expect(screen.getByTestId("d").textContent).toContain("1,234.50");
  });

  it("exposes an aria-label so screen readers announce the unit", () => {
    render(<div data-testid="a">{formatDirham(500_000)}</div>);
    const label = screen
      .getByTestId("a")
      .querySelector("[aria-label]")
      ?.getAttribute("aria-label");
    expect(label).toBe("500,000 UAE dirham");
  });
});

describe("formatDirhamCompact", () => {
  it("formats values >= 1M with two-decimal M suffix (trailing zeros stripped)", () => {
    render(<div data-testid="m1">{formatDirhamCompact(1_250_000)}</div>);
    expect(screen.getByTestId("m1").textContent).toContain("1.25M");

    render(<div data-testid="m2">{formatDirhamCompact(2_000_000)}</div>);
    // 2.00M → "2M" after trailing-zero strip.
    expect(screen.getByTestId("m2").textContent).toContain("2M");
  });

  it("formats values >= 1k with k suffix and rounding", () => {
    render(<div data-testid="k1">{formatDirhamCompact(240_000)}</div>);
    expect(screen.getByTestId("k1").textContent).toContain("240k");

    render(<div data-testid="k2">{formatDirhamCompact(1_500)}</div>);
    expect(screen.getByTestId("k2").textContent).toContain("2k");
  });

  it("renders raw rounded integer under 1,000", () => {
    render(<div data-testid="lo">{formatDirhamCompact(850)}</div>);
    // No "k" or "M" suffix, just digits.
    expect(screen.getByTestId("lo").textContent).toContain("850");
    expect(screen.getByTestId("lo").textContent).not.toContain("k");
    expect(screen.getByTestId("lo").textContent).not.toContain("M");
  });

  it("returns em-dash for null/undefined", () => {
    const { container: c1 } = render(<>{formatDirhamCompact(null)}</>);
    expect(c1.textContent).toBe("—");
    const { container: c2 } = render(<>{formatDirhamCompact(undefined)}</>);
    expect(c2.textContent).toBe("—");
  });
});
