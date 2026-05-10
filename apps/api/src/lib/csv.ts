/**
 * Minimal RFC-4180-style CSV parser.
 *
 * Why hand-rolled instead of csv-parse: the bulk-payment-import route is the
 * only consumer in the codebase, the inputs are small (<= 5 MB, finance team
 * uploads of a few hundred rows) and adding a top-level dep would mean
 * re-running `npm install` in CI for every container build. The implementation
 * handles the cases the finance team actually encounters:
 *   - quoted fields containing commas: `"Doe, Jane"`
 *   - quoted fields containing escaped double-quotes: `"He said ""hi"""`
 *   - LF and CRLF line endings
 *   - trailing blank lines (skipped)
 *
 * It does NOT handle: embedded newlines inside quoted fields. Those are not
 * valid in our import format (a payment milestone label never contains a
 * newline). Adding support is straightforward if a future caller needs it.
 */

export interface ParsedCsv {
  header: string[];
  rows: string[][]; // each row is the raw cell values, in column order
}

/** Parse a single CSV line into an array of cell values. */
function parseLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote: "" → literal "
        if (line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        // Closing quote
        inQuotes = false;
        i++;
        continue;
      }
      cur += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      cells.push(cur);
      cur = "";
      i++;
      continue;
    }
    cur += ch;
    i++;
  }

  cells.push(cur);
  return cells;
}

export function parseCsv(text: string): ParsedCsv {
  // Strip BOM if present (Excel often saves CSVs with one).
  let body = text;
  if (body.charCodeAt(0) === 0xfeff) body = body.slice(1);

  // Normalize CRLF / CR to LF, then split.
  const lines = body
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { header: [], rows: [] };
  }

  const header = parseLine(lines[0]).map((h) => h.trim());
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    rows.push(parseLine(lines[i]));
  }

  return { header, rows };
}

/**
 * Convert a parsed CSV into an array of objects keyed by header.
 *
 * Headers are case-insensitively matched; the canonical (lowercase-first-letter)
 * name from the header row is preserved so callers see their own column names.
 */
export function rowsToObjects(
  parsed: ParsedCsv
): Array<Record<string, string>> {
  const { header, rows } = parsed;
  return rows.map((cells) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) {
      obj[header[i]] = (cells[i] ?? "").trim();
    }
    return obj;
  });
}
