import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { prisma } from "../lib/prisma";

/**
 * Lightweight SPA generator.
 *
 * Why HTML and not PDF here?
 *   - The frontend already has dedicated print pages (e.g. SpaDraftPrintPage.tsx)
 *     that render-and-browser-print to PDF on demand.
 *   - Adding Puppeteer to the API server would download Chromium (~150MB).
 *   - We render the SPA HTML server-side, snapshot the deal data, and store
 *     both in S3 + database so the document is immutable for legal record.
 *   - When a "real" PDF is needed, ops opens the HTML in a browser and prints
 *     to PDF — same workflow already in use elsewhere in the app.
 */

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION ?? "us-east-1",
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    : undefined,
  maxAttempts: 3,
});

const escape = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const fmtMoney = (n: number, currency = "AED") =>
  `${currency} ${Number(n ?? 0).toLocaleString("en-AE", { maximumFractionDigits: 2 })}`;

const fmtDate = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-GB") : "—";

interface SPADataSnapshot {
  generatedAt: string;
  deal: {
    id: string;
    dealNumber: string;
    salePrice: number;
    discount: number;
    dldFee: number;
    adminFee: number;
    currency: string;
    fxRate: number | null;
    reservationDate: Date;
    spaSignedDate: Date | null;
    oqoodDeadline: Date;
    paymentPlan: { id: string; name: string };
  };
  unit: {
    id: string;
    unitNumber: string;
    floor: number;
    type: string;
    area: number;
    view: string;
    tenure: string | null;
    makaniNumber: string | null;
    plotNumber: string | null;
  };
  project: {
    id: string;
    name: string;
    location: string;
    handoverDate: Date;
  };
  parties: Array<{
    role: string;
    leadId: string;
    fullName: string;
    email: string | null;
    phone: string;
    nationality: string | null;
    ownershipPercentage: number;
  }>;
  paymentSchedule: Array<{
    label: string;
    percentage: number;
    amount: number;
    dueDate: Date | null;
    status: string;
  }>;
}

export async function buildSPASnapshot(dealId: string): Promise<SPADataSnapshot> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      unit: { include: { project: true } },
      paymentPlan: { select: { id: true, name: true } },
      parties: {
        include: { lead: true },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      },
      payments: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!deal) throw new Error(`Deal not found: ${dealId}`);

  // Fall back to single-party from Deal.leadId if no parties were set
  let parties = deal.parties;
  if (parties.length === 0) {
    const primary = await prisma.lead.findUnique({ where: { id: deal.leadId } });
    if (primary) {
      parties = [
        {
          id: "single",
          dealId: deal.id,
          leadId: primary.id,
          role: "PRIMARY" as any,
          ownershipPercentage: 100,
          signedAt: null,
          signedName: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lead: primary,
        } as any,
      ];
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    deal: {
      id: deal.id,
      dealNumber: deal.dealNumber,
      salePrice: deal.salePrice,
      discount: deal.discount,
      dldFee: deal.dldFee,
      adminFee: deal.adminFee,
      currency: deal.currency ?? "AED",
      fxRate: deal.fxRate ?? null,
      reservationDate: deal.reservationDate,
      spaSignedDate: deal.spaSignedDate,
      oqoodDeadline: deal.oqoodDeadline,
      paymentPlan: { id: deal.paymentPlan.id, name: deal.paymentPlan.name },
    },
    unit: {
      id: deal.unit.id,
      unitNumber: deal.unit.unitNumber,
      floor: deal.unit.floor,
      type: deal.unit.type,
      area: deal.unit.area,
      view: deal.unit.view,
      tenure: deal.unit.tenure,
      makaniNumber: deal.unit.makaniNumber,
      plotNumber: deal.unit.plotNumber,
    },
    project: {
      id: deal.unit.project.id,
      name: deal.unit.project.name,
      location: deal.unit.project.location,
      handoverDate: deal.unit.project.handoverDate,
    },
    parties: parties.map((p: any) => ({
      role: p.role,
      leadId: p.leadId,
      fullName: `${p.lead.firstName} ${p.lead.lastName}`.trim(),
      email: p.lead.email,
      phone: p.lead.phone,
      nationality: p.lead.nationality,
      ownershipPercentage: p.ownershipPercentage,
    })),
    paymentSchedule: deal.payments.map((p) => ({
      label: p.milestoneLabel,
      percentage: p.percentage,
      amount: p.amount,
      dueDate: p.dueDate,
      status: p.status,
    })),
  };
}

export function renderSPAHtml(snap: SPADataSnapshot): string {
  const partiesRows = snap.parties
    .map(
      (p) => `
        <tr>
          <td>${escape(p.role)}</td>
          <td>${escape(p.fullName)}</td>
          <td>${escape(p.nationality ?? "")}</td>
          <td>${escape(p.phone)}</td>
          <td>${escape(p.email ?? "")}</td>
          <td>${p.ownershipPercentage.toFixed(2)}%</td>
        </tr>`,
    )
    .join("");

  const scheduleRows = snap.paymentSchedule
    .map(
      (m) => `
        <tr>
          <td>${escape(m.label)}</td>
          <td>${m.percentage.toFixed(2)}%</td>
          <td>${fmtMoney(m.amount, snap.deal.currency)}</td>
          <td>${fmtDate(m.dueDate)}</td>
          <td>${escape(m.status)}</td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Sale & Purchase Agreement — ${escape(snap.deal.dealNumber)}</title>
<style>
  body { font-family: 'Helvetica', 'Arial', sans-serif; max-width: 800px; margin: 32px auto; padding: 24px; color: #111; }
  h1 { font-size: 22px; border-bottom: 2px solid #333; padding-bottom: 8px; }
  h2 { font-size: 16px; margin-top: 28px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  td, th { border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 12px; }
  th { background: #f4f4f4; }
  .meta { display: flex; gap: 32px; flex-wrap: wrap; margin-top: 12px; }
  .meta div { font-size: 12px; }
  .meta strong { display: block; color: #555; font-weight: 600; font-size: 11px; }
  .signature-block { margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  .signature-line { border-top: 1px solid #333; margin-top: 64px; padding-top: 4px; font-size: 11px; }
  footer { margin-top: 64px; font-size: 10px; color: #888; text-align: center; }
</style>
</head>
<body>

  <h1>Sale & Purchase Agreement</h1>
  <div class="meta">
    <div><strong>Deal No.</strong> ${escape(snap.deal.dealNumber)}</div>
    <div><strong>Reservation Date</strong> ${fmtDate(snap.deal.reservationDate)}</div>
    <div><strong>Generated</strong> ${fmtDate(new Date(snap.generatedAt))}</div>
  </div>

  <h2>Project & Unit</h2>
  <table>
    <tr><th>Project</th><td>${escape(snap.project.name)} — ${escape(snap.project.location)}</td></tr>
    <tr><th>Unit</th><td>${escape(snap.unit.unitNumber)} (Floor ${snap.unit.floor}, ${escape(snap.unit.type)})</td></tr>
    <tr><th>Built-up Area</th><td>${snap.unit.area} sq m</td></tr>
    <tr><th>View</th><td>${escape(snap.unit.view)}</td></tr>
    <tr><th>Tenure</th><td>${escape(snap.unit.tenure ?? "—")}</td></tr>
    <tr><th>Makani / Plot</th><td>${escape(snap.unit.makaniNumber ?? "—")} / ${escape(snap.unit.plotNumber ?? "—")}</td></tr>
    <tr><th>Handover</th><td>${fmtDate(snap.project.handoverDate)}</td></tr>
  </table>

  <h2>Parties</h2>
  <table>
    <thead><tr><th>Role</th><th>Name</th><th>Nationality</th><th>Phone</th><th>Email</th><th>Share</th></tr></thead>
    <tbody>${partiesRows || `<tr><td colspan="6">No parties recorded.</td></tr>`}</tbody>
  </table>

  <h2>Financial Summary</h2>
  <table>
    <tr><th>Sale Price</th><td>${fmtMoney(snap.deal.salePrice, snap.deal.currency)}</td></tr>
    <tr><th>Discount</th><td>${fmtMoney(snap.deal.discount, snap.deal.currency)}</td></tr>
    <tr><th>DLD Fee (4%)</th><td>${fmtMoney(snap.deal.dldFee, snap.deal.currency)}</td></tr>
    <tr><th>Admin Fee</th><td>${fmtMoney(snap.deal.adminFee, snap.deal.currency)}</td></tr>
    <tr><th>Payment Plan</th><td>${escape(snap.deal.paymentPlan.name)}</td></tr>
    ${snap.deal.fxRate ? `<tr><th>FX Rate</th><td>1 ${escape(snap.deal.currency)} = ${snap.deal.fxRate} AED</td></tr>` : ""}
    <tr><th>Oqood Deadline</th><td>${fmtDate(snap.deal.oqoodDeadline)}</td></tr>
  </table>

  <h2>Payment Schedule</h2>
  <table>
    <thead><tr><th>Milestone</th><th>%</th><th>Amount</th><th>Due Date</th><th>Status</th></tr></thead>
    <tbody>${scheduleRows || `<tr><td colspan="5">No schedule recorded.</td></tr>`}</tbody>
  </table>

  <div class="signature-block">
    <div>
      <strong>Buyer Signature</strong>
      <div class="signature-line">Signed by the buyer (or duly authorised representative)</div>
    </div>
    <div>
      <strong>Developer Signature</strong>
      <div class="signature-line">Signed for and on behalf of the developer</div>
    </div>
  </div>

  <footer>
    This document was generated automatically and is non-binding until duly executed by both parties.
  </footer>

</body>
</html>`;
}

/**
 * Generate the SPA HTML for a deal, upload it to S3, and create a Document
 * record (type=SPA, source=GENERATED) capturing the data snapshot.
 *
 * Idempotent at the version level — each call increments `version`.
 */
export async function generateSPADocument(
  dealId: string,
  uploadedBy: string,
): Promise<{
  documentId: string;
  key: string;
  version: number;
  contentLength: number;
}> {
  const snapshot = await buildSPASnapshot(dealId);
  const html = renderSPAHtml(snapshot);

  const timestamp = Date.now();
  const key = `deals/${dealId}/spa-${timestamp}.html`;
  const bucket = process.env.AWS_S3_BUCKET;

  // Upload to S3 if configured. When no bucket is configured (local dev),
  // we still record the document metadata + dataSnapshot so the workflow
  // can be exercised end-to-end.
  if (bucket) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: html,
        ContentType: "text/html; charset=utf-8",
        Metadata: {
          "spa-deal-id": dealId,
          "generated-at": snapshot.generatedAt,
        },
      }),
    );
  }

  const lastVersion = await prisma.document.findFirst({
    where: { dealId, type: "SPA", softDeleted: false },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (lastVersion?.version ?? 0) + 1;

  const doc = await prisma.document.create({
    data: {
      dealId,
      type: "SPA",
      source: "GENERATED",
      name: `SPA-${snapshot.deal.dealNumber}-v${version}.html`,
      key,
      mimeType: "text/html",
      version,
      dataSnapshot: snapshot as any,
      contractStatus: "DRAFT",
      uploadedBy,
    },
  });

  return {
    documentId: doc.id,
    key,
    version,
    contentLength: html.length,
  };
}
