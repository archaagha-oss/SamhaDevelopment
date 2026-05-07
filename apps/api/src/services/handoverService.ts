import type { HandoverItemStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { eventBus } from "../events/eventBus";

/**
 * Default checklist applied when a deal enters HANDOVER_PENDING.
 * Items can be customised per-project later via a template table — keeping the
 * defaults inline avoids over-engineering for the MVP.
 */
const DEFAULT_HANDOVER_ITEMS: Array<{ code: string; label: string; required: boolean; sortOrder: number }> = [
  { code: "FINAL_PAYMENT", label: "Final payment received", required: true, sortOrder: 1 },
  { code: "NOC_SERVICE_CHARGE", label: "Service charge NOC obtained", required: true, sortOrder: 2 },
  { code: "UTILITIES_TRANSFERRED", label: "DEWA / cooling transferred to buyer", required: true, sortOrder: 3 },
  { code: "WALK_THROUGH", label: "Walk-through completed with buyer", required: true, sortOrder: 4 },
  { code: "SNAGS_CLOSED", label: "All critical/major snags closed", required: true, sortOrder: 5 },
  { code: "KEY_HANDOVER", label: "Keys + access cards issued", required: true, sortOrder: 6 },
  { code: "CUSTOMER_SIGN_OFF", label: "Customer sign-off form signed", required: true, sortOrder: 7 },
];

export async function createHandoverChecklist(dealId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, unitId: true },
  });
  if (!deal) throw new Error(`Deal not found: ${dealId}`);

  // Idempotent: if a checklist already exists, return it
  const existing = await prisma.handoverChecklist.findFirst({
    where: { dealId, completedAt: null },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (existing) return existing;

  const checklist = await prisma.handoverChecklist.create({
    data: {
      dealId,
      unitId: deal.unitId,
      items: { create: DEFAULT_HANDOVER_ITEMS },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return checklist;
}

export async function getChecklist(checklistId: string) {
  return prisma.handoverChecklist.findUnique({
    where: { id: checklistId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function getChecklistByDeal(dealId: string) {
  return prisma.handoverChecklist.findFirst({
    where: { dealId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateChecklistItem(
  itemId: string,
  payload: {
    status?: HandoverItemStatus;
    notes?: string | null;
    evidenceKey?: string | null;
  },
  changedBy: string,
) {
  const data: Record<string, unknown> = {};
  if (payload.status !== undefined) {
    data.status = payload.status;
    if (payload.status === "COMPLETED") {
      data.completedAt = new Date();
      data.completedBy = changedBy;
    } else if (payload.status === "PENDING") {
      data.completedAt = null;
      data.completedBy = null;
    }
  }
  if (payload.notes !== undefined) data.notes = payload.notes;
  if (payload.evidenceKey !== undefined) data.evidenceKey = payload.evidenceKey;

  return prisma.handoverChecklistItem.update({ where: { id: itemId }, data });
}

/**
 * Returns true iff all required items are COMPLETED, WAIVED or NOT_APPLICABLE.
 * Used as the gate for transitioning HANDOVER_PENDING -> COMPLETED.
 */
export async function isChecklistReady(dealId: string): Promise<{
  ready: boolean;
  pending: Array<{ id: string; code: string; label: string; status: HandoverItemStatus }>;
}> {
  const checklist = await getChecklistByDeal(dealId);
  if (!checklist) return { ready: false, pending: [] };

  const pending = checklist.items
    .filter((i) => i.required && i.status === "PENDING")
    .map((i) => ({ id: i.id, code: i.code, label: i.label, status: i.status }));

  return { ready: pending.length === 0, pending };
}

export async function completeChecklist(
  checklistId: string,
  completedBy: string,
  customerName?: string,
  customerSignatureKey?: string,
) {
  const updated = await prisma.handoverChecklist.update({
    where: { id: checklistId },
    data: {
      completedAt: new Date(),
      completedBy,
      customerSignedOffAt: customerName ? new Date() : undefined,
      customerSignedName: customerName ?? undefined,
      customerSignatureKey: customerSignatureKey ?? undefined,
    },
  });

  eventBus.emit({
    eventType: "HANDOVER_COMPLETED" as any,
    aggregateId: updated.dealId,
    aggregateType: "DEAL",
    data: { checklistId, dealId: updated.dealId, unitId: updated.unitId },
    userId: completedBy,
    timestamp: new Date(),
  });

  return updated;
}
