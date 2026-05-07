// Convert an integer AED amount to its English-words form, used in the
// "Other Fees" / Purchase Price particulars of the legal SPA
// (e.g. 26320 -> "Twenty-six thousand three hundred twenty").
//
// Handles values 0 to 999,999,999,999. Decimals are truncated — fils are not
// rendered in the SPA.

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];

const TENS = [
  "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
];

function chunkUnderThousand(n: number): string {
  if (n === 0) return "";
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  if (n >= 20) {
    const tens = TENS[Math.floor(n / 10)];
    const ones = n % 10;
    parts.push(ones ? `${tens}-${ONES[ones]}` : tens);
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

export function numberToWords(amount: number): string {
  const n = Math.floor(Math.abs(amount));
  if (n === 0) return "zero";

  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const remainder = n % 1_000;

  const parts: string[] = [];
  if (billions) parts.push(`${chunkUnderThousand(billions)} billion`);
  if (millions) parts.push(`${chunkUnderThousand(millions)} million`);
  if (thousands) parts.push(`${chunkUnderThousand(thousands)} thousand`);
  if (remainder) parts.push(chunkUnderThousand(remainder));

  return parts.join(" ");
}

// Capitalises the first letter — the SPA uses sentence case for amounts.
export function numberToWordsCapitalized(amount: number): string {
  const w = numberToWords(amount);
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// "AED 26,320 (Dirhams Twenty-six thousand three hundred twenty only)"
export function aedAmountInWords(amount: number): string {
  return `Dirhams ${numberToWordsCapitalized(amount)} only`;
}
