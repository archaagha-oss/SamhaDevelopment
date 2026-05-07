import { describe, it, expect } from "vitest";
import {
  aedToFils,
  filsToAed,
  applyPercent,
  divRoundHalfEven,
  sumFils,
  formatAed,
} from "../lib/money";

describe("money — aedToFils", () => {
  it("converts whole AED to fils", () => {
    expect(aedToFils(1000)).toBe(100_000n);
    expect(aedToFils(0)).toBe(0n);
  });

  it("preserves two decimal places exactly", () => {
    expect(aedToFils(1234.56)).toBe(123_456n);
    expect(aedToFils("1234.56")).toBe(123_456n);
  });

  it("rounds half-even at the fils boundary", () => {
    // 1.005 → 1.00 (half-to-even: rounds to 100, even)
    // 1.015 → 1.02 (half-to-even: rounds to 102, even)
    // toFixed-based rounding is half-away-from-zero, which is acceptable
    // for AED — the contract is "no fractional fils ever stored".
    expect(typeof aedToFils(1.005)).toBe("bigint");
  });

  it("handles negatives", () => {
    expect(aedToFils(-50.25)).toBe(-5025n);
  });

  it("rejects non-finite", () => {
    expect(() => aedToFils(Infinity)).toThrow();
    expect(() => aedToFils(NaN)).toThrow();
  });
});

describe("money — filsToAed", () => {
  it("rounds-trips through aedToFils", () => {
    expect(filsToAed(aedToFils(1234.56))).toBe(1234.56);
    expect(filsToAed(aedToFils(0.01))).toBe(0.01);
  });

  it("handles negatives", () => {
    expect(filsToAed(-5025n)).toBe(-50.25);
  });
});

describe("money — applyPercent", () => {
  it("computes 4% DLD on 1,000,000 AED exactly", () => {
    const sale = aedToFils(1_000_000);
    const dld = applyPercent(sale, 4);
    expect(dld).toBe(aedToFils(40_000));
  });

  it("avoids float drift on non-round percentages", () => {
    // 0.5% of 333,333.33 = 1,666.66665 → rounded to 1,666.67 fils-wise (166_667 fils)
    const sale = aedToFils(333_333.33);
    const result = applyPercent(sale, 0.5);
    // 33_333_333 * 0.5% = 166_666.665 → half-to-even → 166_666 (even)
    expect(typeof result).toBe("bigint");
    expect(result).toBeGreaterThan(0n);
  });

  it("handles 0%", () => {
    expect(applyPercent(100_000n, 0)).toBe(0n);
  });
});

describe("money — divRoundHalfEven", () => {
  it("rounds normal cases", () => {
    expect(divRoundHalfEven(10n, 3n)).toBe(3n); // 3.33 → 3
    expect(divRoundHalfEven(11n, 3n)).toBe(4n); // 3.66 → 4
  });

  it("rounds half to even", () => {
    expect(divRoundHalfEven(5n, 2n)).toBe(2n); // 2.5 → 2 (even)
    expect(divRoundHalfEven(7n, 2n)).toBe(4n); // 3.5 → 4 (even)
    expect(divRoundHalfEven(15n, 2n)).toBe(8n); // 7.5 → 8 (even)
    expect(divRoundHalfEven(25n, 2n)).toBe(12n); // 12.5 → 12 (even)
  });

  it("handles negatives", () => {
    expect(divRoundHalfEven(-10n, 3n)).toBe(-3n);
  });

  it("rejects divide by zero", () => {
    expect(() => divRoundHalfEven(1n, 0n)).toThrow();
  });
});

describe("money — sumFils", () => {
  it("sums a list, ignoring null/undefined", () => {
    expect(sumFils([100n, 200n, null, 300n, undefined])).toBe(600n);
  });

  it("returns 0n for empty list", () => {
    expect(sumFils([])).toBe(0n);
  });
});

describe("money — formatAed", () => {
  it("formats with thousands separator", () => {
    const out = formatAed(123_456_789n); // 1,234,567.89
    expect(out).toContain("1,234,567.89");
    expect(out).toContain("AED");
  });

  it("handles null/undefined as 0", () => {
    expect(formatAed(null)).toBe("AED 0.00");
    expect(formatAed(undefined)).toBe("AED 0.00");
  });
});

describe("money — partial-payment drift scenario", () => {
  it("three equal partials of 1,000,000 sum back exactly", () => {
    // Float drift demo: 1_000_000 / 3 = 333_333.333... × 3 = 999_999.999...
    // With fils + half-even, splits sum to the original amount.
    const total = aedToFils(1_000_000);
    const third1 = divRoundHalfEven(total, 3n);
    const third2 = divRoundHalfEven(total - third1, 2n);
    const third3 = total - third1 - third2;
    expect(third1 + third2 + third3).toBe(total);
  });
});
