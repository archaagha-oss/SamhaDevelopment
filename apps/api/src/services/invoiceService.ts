import type { InvoiceLineKind, InvoiceStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { eventBus } from "../events/eventBus";
import { nextNumber, fiscalYearOf } from "./numberSequenceService";
import { computeVat, getProjectVatPercent } from "./vatService";
import { fxSnapshot } from "./fxService";

export interface InvoiceLineInput {
  kind?: InvoiceLineKind;
  description: string;
  quantity?: number;
  unitPrice: number;
  vatPercent?: number;
  sortOrder?: number;
}

export interface CreateInvoiceInput {
  dealId: string;
  paymentId?: string | null;
  lines: InvoiceLineInput[];
  currency?: string;
  fxRate?: number | null;
  dueDate?: Date | string | null;
  buyerName?: string | null;
  buyerAddress?: string | null;
  notes?: string | null;
  /** if omitted we look it up from ProjectConfig.taxRegistrationNumber */
  trnNumber?: string | null;
}

/**
 * Create a DRAFT invoice with VAT-aware line items.  Numbers are gap-free per
 * (organization, fiscal year).  Use issueInvoice() to flip DRAFT -> ISSUED.
 */
export async function createInvoice(input: CreateInvoiceInput, createdBy: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: input.dealId },
    include: {
      unit: { include: { project: { include: { config: true, organization: true } } } },
    },
  });
  if (!deal) throw new Error(`Deal not found: ${input.dealId}`);

  const project = deal.unit.project;
  const orgId = project.organizationId;
  if (!orgId) throw new Error(`Project ${project.id} has no organization — cannot allocate invoice number.`);

  const fy = fiscalYearOf(new Date(), project.config?.fiscalYearStartMonth ?? 1);
  const { formatted } = await nextNumber(orgId, "INVOICE", fy, { prefix: "INV-", width: 5 });

  const projectVat = await getProjectVatPercent(project.id);
  const fx = fxSnapshot(input.currency ?? deal.currency ?? "AED", input.fxRate ?? deal.fxRate ?? null);

  // Compute lines + totals
  let subtotal = 0;
  let vatTotal = 0;
  const linesData = input.lines.map((line, idx) => {
    const qty = line.quantity ?? 1;
    const net = +(qty * line.unitPrice).toFixed(2);
    const vatPct = line.vatPercent ?? (line.kind === "VAT" ? 0 : projectVat);
    const v = computeVat(net, line.kind === "VAT" ? 0 : vatPct);
    subtotal += v.netAmount;
    vatTotal += v.vatAmount;
    return {
      kind: line.kind ?? "OTHER",
      description: line.description,
      quantity: qty,
      unitPrice: +line.unitPrice.toFixed(2),
      vatPercent: line.kind === "VAT" ? 0 : vatPct,
      vatAmount: v.vatAmount,
      amount: v.netAmount,
      sortOrder: line.sortOrder ?? idx,
    };
  });

  const total = +(subtotal + vatTotal).toFixed(2);

  const invoice = await prisma.invoice.create({
    data: {
      dealId: input.dealId,
      paymentId: input.paymentId ?? null,
      invoiceNumber: formatted,
      fiscalYear: fy,
      status: "DRAFT",
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      currency: fx.currency,
      fxRate: fx.fxRate,
      fxSnapshotAt: fx.fxSnapshotAt,
      subtotal: +subtotal.toFixed(2),
      vatTotal: +vatTotal.toFixed(2),
      total,
      buyerName: input.buyerName ?? null,
      buyerAddress: input.buyerAddress ?? null,
      trnNumber: input.trnNumber ?? project.config?.taxRegistrationNumber ?? null,
      notes: input.notes ?? null,
      lines: { create: linesData as any },
    },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });

  return invoice;
}

export async function issueInvoice(invoiceId: string) {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) throw new Error(`Invoice not found: ${invoiceId}`);
  if (inv.status !== "DRAFT") throw new Error(`Cannot issue invoice in status ${inv.status}`);

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "ISSUED", issuedAt: new Date() },
  });

  eventBus.emit({
    eventType: "INVOICE_ISSUED" as any,
    aggregateId: invoiceId,
    aggregateType: "DEAL",
    data: { invoiceId, dealId: updated.dealId, total: updated.total },
    timestamp: new Date(),
  });

  return updated;
}

export async function markInvoicePaid(invoiceId: string) {
  return prisma.invoice.update({ where: { id: invoiceId }, data: { status: "PAID" } });
}

export async function cancelInvoice(invoiceId: string) {
  return prisma.invoice.update({ where: { id: invoiceId }, data: { status: "CANCELLED" } });
}

export async function getInvoice(invoiceId: string) {
  return prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: { orderBy: { sortOrder: "asc" } }, receipts: true },
  });
}

export async function listInvoicesForDeal(dealId: string) {
  return prisma.invoice.findMany({
    where: { dealId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Convenience: build a single-line invoice for a payment milestone.
 */
export async function createInvoiceForPayment(paymentId: string, createdBy: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { deal: { include: { lead: true } } },
  });
  if (!payment) throw new Error(`Payment not found: ${paymentId}`);

  const buyerName = `${payment.deal.lead.firstName} ${payment.deal.lead.lastName}`.trim();

  return createInvoice(
    {
      dealId: payment.dealId,
      paymentId,
      currency: payment.currency ?? payment.deal.currency ?? "AED",
      fxRate: payment.fxRate ?? payment.deal.fxRate ?? null,
      dueDate: payment.dueDate,
      buyerName,
      lines: [
        {
          kind: "UNIT_PRICE",
          description: payment.milestoneLabel,
          unitPrice: payment.amount,
          quantity: 1,
        },
      ],
    },
    createdBy,
  );
}
