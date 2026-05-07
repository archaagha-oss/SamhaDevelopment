import { prisma } from "../lib/prisma";
import { nextNumber, fiscalYearOf } from "./numberSequenceService";
import { fxSnapshot } from "./fxService";

export interface CreateReceiptInput {
  dealId: string;
  paymentId?: string | null;
  invoiceId?: string | null;
  amount: number;
  currency?: string;
  fxRate?: number | null;
  paymentMethod?: string;
  paidDate?: Date | string;
  payerName?: string;
  notes?: string;
}

export async function createReceipt(input: CreateReceiptInput, createdBy: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: input.dealId },
    include: { unit: { include: { project: { include: { config: true, organization: true } } } } },
  });
  if (!deal) throw new Error(`Deal not found: ${input.dealId}`);

  const orgId = deal.unit.project.organizationId;
  if (!orgId) throw new Error(`Project has no organization — cannot allocate receipt number.`);

  const fy = fiscalYearOf(
    input.paidDate ? new Date(input.paidDate) : new Date(),
    deal.unit.project.config?.fiscalYearStartMonth ?? 1,
  );
  const { formatted } = await nextNumber(orgId, "RECEIPT", fy, { prefix: "RCP-", width: 5 });

  const fx = fxSnapshot(input.currency ?? deal.currency ?? "AED", input.fxRate ?? deal.fxRate ?? null);

  const receipt = await prisma.receipt.create({
    data: {
      dealId: input.dealId,
      paymentId: input.paymentId ?? null,
      invoiceId: input.invoiceId ?? null,
      receiptNumber: formatted,
      fiscalYear: fy,
      amount: +input.amount.toFixed(2),
      currency: fx.currency,
      fxRate: fx.fxRate,
      fxSnapshotAt: fx.fxSnapshotAt,
      paymentMethod: input.paymentMethod ?? null,
      paidDate: input.paidDate ? new Date(input.paidDate) : new Date(),
      paidBy: createdBy,
      payerName: input.payerName ?? null,
      notes: input.notes ?? null,
    },
  });

  return receipt;
}

export async function listReceiptsForDeal(dealId: string) {
  return prisma.receipt.findMany({
    where: { dealId },
    orderBy: { createdAt: "desc" },
  });
}
