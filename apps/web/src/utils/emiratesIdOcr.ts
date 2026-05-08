// ============================================================
// Emirates ID OCR — runs entirely client-side via Tesseract.js
// ============================================================
// No data leaves the browser. Tesseract loads its English language
// model from a CDN on first use (~10 MB) and caches it in IndexedDB.
//
// Accuracy is ~85–95% on a clean photo of an Emirates ID front.
// Treat results as suggestions to confirm, not authoritative truth.
// ============================================================

import { recognize } from "tesseract.js";

export interface EmiratesIdFields {
  idNumber?: string;       // 784-1990-1234567-1
  fullName?: string;       // Name as printed
  nationality?: string;
  dateOfBirth?: string;    // ISO date
  expiryDate?: string;     // ISO date
  sex?: "M" | "F";
  rawText: string;         // full OCR output (for debugging or manual review)
}

const ID_PATTERN = /\b(\d{3}-\d{4}-\d{7}-\d)\b/;
const DATE_PATTERN_DMY = /(\d{2})\/(\d{2})\/(\d{4})/g;

function dmyToIso(d: string, m: string, y: string): string {
  return `${y}-${m}-${d}`;
}

function lineAfterLabel(text: string, ...labels: string[]): string | undefined {
  const lines = text.split(/\r?\n/);
  const labelRe = new RegExp(`^\\s*(?:${labels.join("|")})\\s*[:\\-]?\\s*(.*)$`, "i");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(labelRe);
    if (m) {
      const inline = m[1]?.trim();
      if (inline) return inline;
      // Value may be on the next line
      const next = lines[i + 1]?.trim();
      if (next) return next;
    }
  }
  return undefined;
}

export function extractEmiratesIdFields(rawText: string): EmiratesIdFields {
  const fields: EmiratesIdFields = { rawText };

  const idMatch = rawText.match(ID_PATTERN);
  if (idMatch) fields.idNumber = idMatch[1];

  // Two dates on the front (DOB + expiry). Earlier date is DOB, later is expiry.
  const dates: string[] = [];
  let dm: RegExpExecArray | null;
  while ((dm = DATE_PATTERN_DMY.exec(rawText)) !== null) {
    dates.push(dmyToIso(dm[1], dm[2], dm[3]));
  }
  if (dates.length >= 1) {
    const sorted = [...dates].sort();
    fields.dateOfBirth = sorted[0];
    fields.expiryDate = sorted[sorted.length - 1] !== sorted[0] ? sorted[sorted.length - 1] : undefined;
  }

  fields.fullName =
    lineAfterLabel(rawText, "Name", "Full Name") ?? undefined;

  fields.nationality =
    lineAfterLabel(rawText, "Nationality") ?? undefined;

  const sex = lineAfterLabel(rawText, "Sex", "Gender");
  if (sex) {
    if (/^m/i.test(sex)) fields.sex = "M";
    else if (/^f/i.test(sex)) fields.sex = "F";
  }

  return fields;
}

export interface OcrProgress {
  status: string;
  progress: number; // 0..1
}

export async function runEmiratesIdOcr(
  file: File | Blob,
  onProgress?: (p: OcrProgress) => void
): Promise<EmiratesIdFields> {
  const result = await recognize(file, "eng", {
    logger: (m: { status: string; progress: number }) => {
      if (onProgress) onProgress({ status: m.status, progress: m.progress });
    },
  });
  return extractEmiratesIdFields(result.data.text);
}
