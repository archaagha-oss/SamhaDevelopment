/**
 * Number-to-words for SPA legal text.
 *
 * Two locales:
 *   numberToWordsEn  — English, mirrors apps/web/src/utils/numberToWords.ts
 *                      (kept duplicated so the API has no web-package import).
 *   numberToWordsAr  — Arabic, masculine form, suitable for "Dirham" amounts.
 *
 * Range. 0 through 999,999,999,999. Decimals are truncated — fils are not
 * rendered on the SPA.
 *
 * The Arabic helper handles the legally-relevant rules for SPA documents:
 *   - dual forms for 2 / 200 / 2000 / 2,000,000 (مائتان / ألفان / مليونان)
 *   - "وَ" conjunctions between thousands/millions and the remainder
 *   - units-before-tens ordering (واحد وعشرون = 21)
 *   - plural "آلاف" for 3–10 thousands, "ألفًا" for 11–99, "ألف" for 100+
 *     (and the analogous chain for millions / billions)
 *
 * It is intentionally NOT a full grammatical Arabic number engine — gender
 * agreement with the noun being counted is partial. For Dirhams (masculine),
 * the output is grammatically correct in the cases an SPA actually uses.
 */

// ── English ──────────────────────────────────────────────────────────────────

const EN_ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function enUnderThousand(n: number): string {
  if (n === 0) return "";
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${EN_ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  if (n >= 20) {
    const tens = EN_TENS[Math.floor(n / 10)];
    const ones = n % 10;
    parts.push(ones ? `${tens}-${EN_ONES[ones]}` : tens);
  } else if (n > 0) {
    parts.push(EN_ONES[n]);
  }
  return parts.join(" ");
}

export function numberToWordsEn(amount: number): string {
  const n = Math.floor(Math.abs(amount));
  if (n === 0) return "zero";

  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const remainder = n % 1_000;

  const parts: string[] = [];
  if (billions) parts.push(`${enUnderThousand(billions)} billion`);
  if (millions) parts.push(`${enUnderThousand(millions)} million`);
  if (thousands) parts.push(`${enUnderThousand(thousands)} thousand`);
  if (remainder) parts.push(enUnderThousand(remainder));

  return parts.join(" ");
}

export function aedInWordsEn(amount: number): string {
  const w = numberToWordsEn(amount);
  return `Dirhams ${w.charAt(0).toUpperCase()}${w.slice(1)} only`;
}

// ── Arabic ───────────────────────────────────────────────────────────────────

const AR_ONES = [
  "صفر", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة",
];
const AR_TEENS = [
  "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر",
  "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر",
];
const AR_TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const AR_HUNDREDS = [
  "", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة",
  "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة",
];

function arUnderHundred(n: number): string {
  if (n === 0) return "";
  if (n < 10) return AR_ONES[n];
  if (n < 20) return AR_TEENS[n - 10];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  if (ones === 0) return AR_TENS[tens];
  return `${AR_ONES[ones]} و${AR_TENS[tens]}`; // 21 = "واحد وعشرون"
}

function arUnderThousand(n: number): string {
  if (n === 0) return "";
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h === 0) return arUnderHundred(r);
  if (r === 0) return AR_HUNDREDS[h];
  return `${AR_HUNDREDS[h]} و${arUnderHundred(r)}`;
}

// Word for the scale unit (ألف / مليون / مليار) varies with the count:
//   1   → singular           (ألف)
//   2   → dual               (ألفان)
//   3-10→ plural-of-paucity  (آلاف / ملايين / مليارات)
//   11+ → accusative singular(ألفًا / مليونًا / مليارًا)  — used here for 11-99
//   100+→ singular           (ألف / مليون / مليار)
function scaleWord(count: number, singular: string, dual: string, plural: string, accusative: string): string {
  if (count === 1) return singular;
  if (count === 2) return dual;
  if (count >= 3 && count <= 10) return plural;
  if (count >= 11 && count <= 99) return accusative;
  return singular;
}

function arGroup(count: number, singular: string, dual: string, plural: string, accusative: string): string {
  if (count === 0) return "";
  if (count === 1) return singular;            // "ألف"
  if (count === 2) return dual;                // "ألفان"
  return `${arUnderThousand(count)} ${scaleWord(count, singular, dual, plural, accusative)}`;
}

export function numberToWordsAr(amount: number): string {
  const n = Math.floor(Math.abs(amount));
  if (n === 0) return AR_ONES[0]; // "صفر"

  const billions  = Math.floor(n / 1_000_000_000);
  const millions  = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const remainder = n % 1_000;

  const parts: string[] = [];
  if (billions)  parts.push(arGroup(billions,  "مليار", "ملياران", "مليارات", "مليارًا"));
  if (millions)  parts.push(arGroup(millions,  "مليون", "مليونان", "ملايين",  "مليونًا"));
  if (thousands) parts.push(arGroup(thousands, "ألف",   "ألفان",   "آلاف",    "ألفًا"));
  if (remainder) parts.push(arUnderThousand(remainder));

  return parts.join(" و");
}

export function aedInWordsAr(amount: number): string {
  // درهم إماراتي = "UAE dirham"; "فقط" = "only" — the standard SPA wording.
  return `فقط ${numberToWordsAr(amount)} درهم إماراتي لا غير`;
}
