/**
 * Server-side PDF rendering for the bilingual SPA.
 *
 * WHY this file exists alongside the existing browser print-to-PDF path
 * (deferred 4 — GET /api/deals/:id/spa/print serves HTML and lets the
 * operator use Cmd/Ctrl+P):
 *
 *   - The browser path is human-driven, one-PDF-at-a-time. Operations
 *     often want to batch-archive SPAs as immutable artifacts attached
 *     to the deal record, or e-mail a final PDF without asking the
 *     operator to open a tab. Both need a server-rendered PDF.
 *   - Puppeteer launches a real headless Chromium, so Arabic shaping
 *     and the same @media print CSS rules from the HTML template
 *     produce a PDF that's pixel-identical to what the operator sees
 *     in their browser.
 *
 * Deployment caveat. cPanel shared hosting can't run Chromium; this
 * endpoint will fail with a clear 503 in that environment. The
 * /spa/print HTML path remains available as the fallback. A self-
 * managed VPS / Docker container with Chromium dependencies installed
 * runs this fine.
 *
 * The browser is launched per request and torn down after. That's
 * slower than reusing a persistent browser, but it avoids the memory
 * leak risk of long-lived headless Chromiums and matches how often
 * SPAs are actually generated (a few times a day at most).
 */

import type { Browser } from "puppeteer";
import { logger } from "../../lib/logger";

async function getBrowser(): Promise<Browser> {
  // Lazy import — Puppeteer pulls ~200 MB of Chromium at install time.
  // If the binary is missing (e.g. install ran with PUPPETEER_SKIP_DOWNLOAD)
  // we let the launch error surface up; the route handler maps it to 503.
  const puppeteer = await import("puppeteer");
  return puppeteer.launch({
    headless: true,
    // --no-sandbox is required when running as root inside a container or
    // CI sandbox. Safe here because we only render trusted HTML built from
    // our own SPA template.
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

export async function renderSpaPdf(html: string): Promise<Buffer> {
  let browser: Browser | null = null;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    // setContent only accepts "load" / "domcontentloaded" (no network
    // events — the HTML is inline and references no external resources
    // beyond system fonts).
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    // Give the renderer a beat to settle Arabic font shaping before
    // capturing — the SPA template uses system Arabic fonts which the
    // browser resolves synchronously, but the layout reflow after font
    // resolution takes a frame or two.
    await new Promise((r) => setTimeout(r, 250));
    // emulateMediaType("print") makes @media print rules apply, which
    // is what strips our on-screen toolbar from the rendered output.
    await page.emulateMediaType("print");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", right: "14mm", bottom: "18mm", left: "14mm" },
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } catch (err) {
    logger.error("[spa-pdf] render failed", { err });
    throw err;
  } finally {
    if (browser) {
      // Fire-and-forget tear-down. We don't keep a hot browser process —
      // SPA generation is rare enough that the launch cost is acceptable,
      // and long-lived Chromiums are a memory-leak risk.
      browser.close().catch(() => { /* ignore — process may already be gone */ });
    }
  }
}

// Hint to deployers: probe whether Chromium can launch on boot, so the
// failure mode for cPanel-style environments is visible immediately
// instead of surfacing the first time someone clicks Download PDF.
export async function probePdfEngine(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const b = await getBrowser();
    await b.close();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, reason: err?.message ?? "unknown launch error" };
  }
}
