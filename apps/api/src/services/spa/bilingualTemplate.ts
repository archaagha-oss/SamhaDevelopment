// ---------------------------------------------------------------------------
// Bilingual SPA HTML preview scaffold (Phase 4b).
//
// WHY this file exists:
//   - Dubai SPAs are legally required to render the same particulars in
//     English (LTR) AND Arabic (RTL). We need to surface what the bilingual
//     output WILL look like long before the real PDF pipeline ships, so the
//     operator can sanity-check Arabic-name capture, missing-data fallbacks,
//     and column alignment in a normal browser tab.
//   - Inline CSS only (zero new deps). PDF rendering and number-to-words
//     Arabic conversion come later — those are explicitly stubbed below.
//
// Design notes:
//   - <html lang="en" dir="ltr"> for the document, then a per-column
//     dir="rtl" / lang="ar" override on the Arabic half. This is the
//     pattern recommended by W3C i18n for mixed-direction documents.
//   - Font stack avoids external fonts on purpose; we lean on whatever
//     Arabic face the rendering machine already has. When we move to
//     puppeteer for PDFs we can bundle Noto Naskh Arabic; not today.
//   - Missing AR tokens fall back to "—" (em dash) so the document is
//     never blank in a way that hides the omission. The companion preview
//     route (POST /api/deals/:id/spa/preview) returns a `missingArabic`
//     array so the UI can refuse generation in Phase 4c.
// ---------------------------------------------------------------------------

import type { SpaSnapshot } from "../spaService";

/** Em-dash placeholder used whenever an Arabic value is missing. Mirrors
 *  the dash used in the existing English-only renderer for empty strings. */
const AR_FALLBACK = "—";

/** Minimal HTML escape — we treat all snapshot values as plain text. The
 *  snapshot never contains HTML and the document is a self-contained string
 *  the caller hands back to a browser tab, so escape-on-render is enough. */
function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Render an AR value or the em-dash fallback. Use this everywhere on the
 *  Arabic side so the surface area stays consistent for the validation gate
 *  in Phase 4c. */
function ar(value: string | null | undefined): string {
  if (!value) return AR_FALLBACK;
  return esc(value);
}

/** Format a UAE-style currency line ("AED 1,234,567"). */
function aedDigits(amount: number): string {
  return `AED ${amount.toLocaleString("en-AE", { maximumFractionDigits: 2 })}`;
}

/** Locate the primary purchaser; fall back to first row when nothing is
 *  marked primary (older snapshots didn't always carry the flag). */
function primaryPurchaser(snapshot: SpaSnapshot) {
  return snapshot.purchasers.find((p) => p.isPrimary) ?? snapshot.purchasers[0] ?? null;
}

/** Tokens whose Arabic value is required for a clean bilingual SPA. The
 *  preview route walks this list to assemble `missingArabic`. Keep names
 *  stable — the front-end will surface them to operators verbatim. */
export interface MissingArabicReport {
  token: string;
  label: string;
}

export function collectMissingArabic(snapshot: SpaSnapshot): MissingArabicReport[] {
  const out: MissingArabicReport[] = [];
  const buyer = primaryPurchaser(snapshot);
  if (!buyer?.nameAr) {
    out.push({ token: "buyer.nameAr", label: "Primary purchaser Arabic name" });
  }
  if (!snapshot.project.nameAr) {
    out.push({ token: "project.nameAr", label: "Project Arabic name" });
  }
  if (!snapshot.project.locationAr) {
    out.push({ token: "project.locationAr", label: "Project Arabic location" });
  }
  if (!snapshot.project.developerNameAr) {
    out.push({ token: "project.developerNameAr", label: "Developer Arabic name" });
  }
  if (!snapshot.project.developerAddressAr) {
    out.push({ token: "project.developerAddressAr", label: "Developer Arabic address" });
  }
  return out;
}

/** Render the bilingual SPA preview. Returns a complete, browser-renderable
 *  HTML document — no fragments, no external assets. */
export function renderBilingualSpaHtml(snapshot: SpaSnapshot): string {
  const buyer = primaryPurchaser(snapshot);
  const buyerNameEn = buyer ? esc(buyer.name) : AR_FALLBACK;
  const buyerNameAr = ar(buyer?.nameAr ?? null);

  const unitNumber = esc(snapshot.unit.unitNumber);
  const projectNameEn = esc(snapshot.project.name);
  const projectNameAr = ar(snapshot.project.nameAr);

  const salePriceDigits = aedDigits(snapshot.deal.netSalePrice || snapshot.deal.salePrice);

  // TODO(phase-4c): integrate an English number-to-words helper here.
  // For now we emit a clearly-stubbed placeholder so the layout is testable.
  const salePriceWordsEn = "[number-to-words EN pending Phase 4c]";
  // TODO(phase-4c): plug in an Arabic number-to-words helper (e.g. a small
  // hand-rolled module — out of scope for this commit; no new deps allowed).
  const salePriceWordsAr = "[التحويل إلى كلمات قيد التنفيذ]";

  const css = `
    *,*::before,*::after { box-sizing: border-box; }
    html,body { margin: 0; padding: 0; background: #f4f4f5; color: #111; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
    }
    .page {
      max-width: 1100px;
      margin: 24px auto;
      background: #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.08);
      padding: 32px 24px 48px;
    }
    .page h1 {
      font-size: 18px;
      margin: 0 0 4px;
      text-align: center;
    }
    .page .deal-meta {
      text-align: center;
      color: #555;
      margin-bottom: 16px;
      font-size: 11px;
    }
    .columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    .col {
      padding: 16px;
      border: 1px solid #e5e5e5;
      border-radius: 4px;
      background: #fdfdfd;
      min-height: 100%;
    }
    .col h2 {
      font-size: 13px;
      margin: 0 0 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #444;
      border-bottom: 1px solid #ddd;
      padding-bottom: 4px;
    }
    .col-ar {
      /* Arabic system-font stack — no external font load, intentional. */
      font-family: 'Noto Naskh Arabic', 'Geeza Pro', 'Arial Unicode MS', serif;
      font-size: 13px;
      line-height: 1.7;
    }
    .field { margin-bottom: 10px; }
    .field-label {
      display: block;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #888;
      margin-bottom: 2px;
    }
    .field-value { font-weight: 600; }
    .missing { color: #b91c1c; font-weight: 700; }
    .note {
      margin-top: 24px;
      padding: 12px;
      border: 1px dashed #f59e0b;
      background: #fffbeb;
      color: #92400e;
      font-size: 11px;
      border-radius: 4px;
    }
  `;

  // Mark fallback values visually so QA spots them immediately.
  const arField = (v: string | null | undefined): string => {
    if (!v) return `<span class="field-value missing" aria-label="Arabic value missing">${AR_FALLBACK}</span>`;
    return `<span class="field-value">${esc(v)}</span>`;
  };

  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8" />
<title>SPA preview — Deal ${esc(snapshot.deal.dealNumber)}</title>
<style>${css}</style>
</head>
<body>
  <div class="page">
    <h1>Sale &amp; Purchase Agreement — Bilingual preview</h1>
    <div class="deal-meta">
      Deal ${esc(snapshot.deal.dealNumber)} ·
      Unit ${unitNumber} ·
      Generated ${esc(snapshot.generatedAt)}
    </div>

    <div class="columns">
      <!-- ─── English column (LTR) ──────────────────────────────────── -->
      <section class="col col-en" dir="ltr" lang="en">
        <h2>English</h2>

        <div class="field">
          <span class="field-label">Purchaser</span>
          <span class="field-value">${buyerNameEn}</span>
        </div>
        <div class="field">
          <span class="field-label">Unit number</span>
          <span class="field-value">${unitNumber}</span>
        </div>
        <div class="field">
          <span class="field-label">Project</span>
          <span class="field-value">${projectNameEn}</span>
        </div>
        <div class="field">
          <span class="field-label">Sale price (digits)</span>
          <span class="field-value">${esc(salePriceDigits)}</span>
        </div>
        <div class="field">
          <span class="field-label">Sale price (words)</span>
          <span class="field-value">${esc(salePriceWordsEn)}</span>
        </div>
      </section>

      <!-- ─── Arabic column (RTL) ───────────────────────────────────── -->
      <section class="col col-ar" dir="rtl" lang="ar">
        <h2>العربية</h2>

        <div class="field">
          <span class="field-label">المشتري</span>
          ${arField(buyer?.nameAr ?? null)}
        </div>
        <div class="field">
          <span class="field-label">رقم الوحدة</span>
          <span class="field-value">${unitNumber}</span>
        </div>
        <div class="field">
          <span class="field-label">المشروع</span>
          ${arField(snapshot.project.nameAr)}
        </div>
        <div class="field">
          <span class="field-label">سعر البيع (أرقام)</span>
          <span class="field-value">${esc(salePriceDigits)}</span>
        </div>
        <div class="field">
          <span class="field-label">سعر البيع (كلمات)</span>
          <span class="field-value">${esc(salePriceWordsAr)}</span>
        </div>
      </section>
    </div>

    <p class="note">
      Preview only. Number-to-words rendering and the final PDF pipeline
      ship in a follow-up. Any field shown in red has no Arabic value yet
      and the Phase 4c validation gate will block generation until it is
      filled.
    </p>
  </div>
</body>
</html>`;
}
