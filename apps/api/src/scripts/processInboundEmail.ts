// ============================================================
// processInboundEmail — cPanel "Pipe to Program" entry point
// ============================================================
// Reads a raw email message from stdin, parses it, classifies it as a
// portal lead (Bayut / PF / Dubizzle), and creates a Lead in the CRM.
//
// cPanel setup:
//   1. Create a forwarder for leads@example.com
//   2. Choose "Pipe to a Program"
//   3. Path:  /home/USER/samha/apps/api/dist/scripts/processInboundEmail.js
//   4. Forward Bayut/PF/Dubizzle lead emails to leads@example.com
//
// Local test:
//   cat sample-email.eml | node dist/scripts/processInboundEmail.js
// ============================================================

import { simpleParser } from "mailparser";
import { parsePortalLeadEmail } from "../services/portalLeadParserService";
import { ingestPortalLead } from "../services/portalLeadIngestService";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

async function readStdin(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (c: Buffer) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks)));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const raw = await readStdin();
  if (raw.length === 0) {
    logger.warn("[processInboundEmail] empty stdin, exiting");
    process.exit(0);
  }

  const mail = await simpleParser(raw);
  const fromAddress =
    mail.from?.value?.[0]?.address ?? (typeof mail.from === "string" ? mail.from : "") ?? "";
  const subject = mail.subject ?? "";
  const body = (mail.text || mail.html || "").toString();

  const parsed = parsePortalLeadEmail({ subject, fromAddress, body });
  const result = await ingestPortalLead(parsed);

  logger.info("[processInboundEmail] done", {
    portal: parsed.portal,
    status: result.status,
    leadId: result.leadId,
    reason: result.reason,
  });

  await prisma.$disconnect();
  // Always exit 0 — the MTA should consider the message handled even if we
  // dropped it, otherwise it will retry forever and clog the queue.
  process.exit(0);
}

main().catch(async (err) => {
  logger.error("[processInboundEmail] fatal", { err: (err as Error).message, stack: (err as Error).stack });
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
});
