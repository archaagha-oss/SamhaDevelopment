import type { RefundStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

const VALID_REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  REQUESTED:  ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED:   ["PROCESSED", "CANCELLED"],
  PROCESSED:  [],
  REJECTED:   [],
  CANCELLED:  [],
};

export function validateRefundTransition(
  from: RefundStatus,
  to: RefundStatus,
): { valid: boolean; error?: string } {
  const allowed = VALID_REFUND_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      valid: false,
      error: `Cannot transition refund from ${from} to ${to}. Allowed: ${allowed.join(", ") || "none"}`,
    };
  }
  return { valid: true };
}

export interface CreateRefundInput {
  dealId: string;
  amount: number;
  currency?: string;
  reason: string;
  notes?: string;
}

export async function requestRefund(input: CreateRefundInput, requestedBy: string) {
  const deal = await prisma.deal.findUnique({ where: { id: input.dealId }, select: { id: true } });
  if (!deal) throw new Error(`Deal not found: ${input.dealId}`);

  return prisma.refundRequest.create({
    data: {
      dealId: input.dealId,
      amount: +input.amount.toFixed(2),
      currency: input.currency ?? "AED",
      reason: input.reason,
      notes: input.notes ?? null,
      requestedBy,
      status: "REQUESTED",
    },
  });
}

/**
 * Approve / reject / cancel / process a refund.  Each transition writes a
 * RefundApproval audit row.
 */
export async function transitionRefund(
  refundId: string,
  newStatus: RefundStatus,
  decidedBy: string,
  payload?: { rejectedReason?: string; processedReference?: string; comment?: string },
) {
  const refund = await prisma.refundRequest.findUnique({ where: { id: refundId } });
  if (!refund) throw new Error(`Refund not found: ${refundId}`);

  const validation = validateRefundTransition(refund.status, newStatus);
  if (!validation.valid) throw new Error(validation.error);

  const data: Record<string, unknown> = { status: newStatus };
  if (newStatus === "APPROVED") {
    data.approvedBy = decidedBy;
    data.approvedAt = new Date();
  }
  if (newStatus === "REJECTED") {
    data.rejectedReason = payload?.rejectedReason ?? null;
  }
  if (newStatus === "PROCESSED") {
    data.processedBy = decidedBy;
    data.processedAt = new Date();
    data.processedReference = payload?.processedReference ?? null;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.refundRequest.update({ where: { id: refundId }, data });
    await tx.refundApproval.create({
      data: {
        refundId,
        decision: newStatus,
        decidedBy,
        comment: payload?.comment ?? null,
      },
    });
    return updated;
  });
}

export async function getRefund(refundId: string) {
  return prisma.refundRequest.findUnique({
    where: { id: refundId },
    include: { approvals: { orderBy: { decidedAt: "asc" } } },
  });
}

export async function listRefundsForDeal(dealId: string) {
  return prisma.refundRequest.findMany({
    where: { dealId },
    include: { approvals: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listOpenRefunds() {
  return prisma.refundRequest.findMany({
    where: { status: { in: ["REQUESTED", "APPROVED"] } },
    orderBy: { createdAt: "desc" },
  });
}
