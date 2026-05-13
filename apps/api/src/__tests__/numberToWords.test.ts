import { describe, it, expect } from "vitest";
import {
  numberToWordsEn,
  numberToWordsAr,
  aedInWordsEn,
  aedInWordsAr,
} from "../lib/numberToWords";

describe("numberToWordsEn", () => {
  it("renders edge values", () => {
    expect(numberToWordsEn(0)).toBe("zero");
    expect(numberToWordsEn(1)).toBe("one");
    expect(numberToWordsEn(19)).toBe("nineteen");
    expect(numberToWordsEn(20)).toBe("twenty");
    expect(numberToWordsEn(21)).toBe("twenty-one");
    expect(numberToWordsEn(100)).toBe("one hundred");
    expect(numberToWordsEn(1000)).toBe("one thousand");
  });

  it("renders an AED-typical SPA amount", () => {
    expect(numberToWordsEn(1_250_000)).toBe(
      "one million two hundred fifty thousand"
    );
    expect(numberToWordsEn(26_320)).toBe(
      "twenty-six thousand three hundred twenty"
    );
  });

  it("aedInWordsEn wraps in the SPA-standard envelope", () => {
    expect(aedInWordsEn(1_250_000)).toBe(
      "Dirhams One million two hundred fifty thousand only"
    );
  });
});

describe("numberToWordsAr", () => {
  it("renders ones, teens, tens", () => {
    expect(numberToWordsAr(0)).toBe("صفر");
    expect(numberToWordsAr(1)).toBe("واحد");
    expect(numberToWordsAr(10)).toBe("عشرة");
    expect(numberToWordsAr(11)).toBe("أحد عشر");
    expect(numberToWordsAr(20)).toBe("عشرون");
    expect(numberToWordsAr(21)).toBe("واحد وعشرون");
  });

  it("renders hundreds with the correct duals", () => {
    expect(numberToWordsAr(100)).toBe("مائة");
    expect(numberToWordsAr(200)).toBe("مائتان");
    expect(numberToWordsAr(305)).toBe("ثلاثمائة وخمسة");
  });

  it("renders thousands with paucity-plural and dual forms", () => {
    expect(numberToWordsAr(1_000)).toBe("ألف");
    expect(numberToWordsAr(2_000)).toBe("ألفان");
    expect(numberToWordsAr(3_000)).toBe("ثلاثة آلاف");
    // 11 → accusative-singular scale word
    expect(numberToWordsAr(11_000)).toBe("أحد عشر ألفًا");
  });

  it("renders an AED-typical SPA amount with millions+thousands", () => {
    // 1,250,000 → "million" (singular) + "two hundred fifty thousand"
    // Scale word for 250 is singular "ألف" (100+ takes singular form),
    // not the accusative "ألفًا" which is reserved for counts 11-99.
    expect(numberToWordsAr(1_250_000)).toBe(
      "مليون و مائتان وخمسون ألف"
    );
  });

  it("aedInWordsAr wraps in the SPA-standard envelope", () => {
    expect(aedInWordsAr(1_000)).toBe(
      "فقط ألف درهم إماراتي لا غير"
    );
  });
});
