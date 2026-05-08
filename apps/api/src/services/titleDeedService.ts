import type { TitleDeedStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { eventBus } from "../events/eventBus";

const VALID_DEED_TRANSITIONS: Record<TitleDeedStatus, TitleDeedStatus[]> = {
  PENDING:     ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["ISSUED", "CANCELLED"],
  ISSUED:      ["TRANSFERRED", "CANCELLED"],
  TRANSFERRED: [],
  CANCELLED:   [],
};

export function validateDeedTransition(
  from: TitleDeedStatus,
  to: TitleDeedStatus,
): { valid: boolean; error?: string } {
  const allowed = VALID_DEED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      valid: false,
      error: `Cannot transition title deed from ${from} to ${to}. Allowed: ${allowed.join(", ") || "none"}`,
    };
  }
  return { valid: true };
}

export interface TitleDeedInput {
  unitId: string;
  dealId?: string | null;
  status?: TitleDeedStatus;
  deedNumber?: string;
  registryRef?: string;
  issuedDate?: Date | string;
  buyerName?: string;
  sellerName?: string;
  notes?: string;
  documentKey?: string;
}

export async function createTitleDeed(input: TitleDeedInput) {
  const unit = await prisma.unit.findUnique({ where: { id: input.unitId }, select: { id: true } });
  if (!unit) throw new Error(`Unit not found: ${input.unitId}`);

  return prisma.titleDeedTransfer.create({
    data: {
      unitId: input.unitId,
      dealId: input.dealId ?? null,
      status: input.status ?? "PENDING",
      deedNumber: input.deedNumber,
      registryRef: input.registryRef,
      issuedDate: input.issuedDate ? new Date(input.issuedDate) : null,
      buyerName: input.buyerName,
      sellerName: input.sellerName,
      notes: input.notes,
      documentKey: input.documentKey,
    },
  });
}

export async function updateTitleDeed(
  id: string,
  patch: Partial<TitleDeedInput>,
) {
  const data: Record<string, unknown> = { ...patch };
  if (patch.issuedDate !== undefined) {
    data.issuedDate = patch.issuedDate ? new Date(patch.issuedDate) : null;
  }
  return prisma.titleDeedTransfer.update({ where: { id }, data });
}

export async function transitionTitleDeed(
  id: string,
  newStatus: TitleDeedStatus,
  changedBy: string,
) {
  const existing = await prisma.titleDeedTransfer.findUnique({ where: { id } });
  if (!existing) throw new Error(`Title deed transfer not found: ${id}`);

  const validation = validateDeedTransition(existing.status, newStatus);
  if (!validation.valid) throw new Error(validation.error);

  const data: Record<string, unknown> = { status: newStatus };
  if (newStatus === "ISSUED") data.issuedDate = data.issuedDate ?? new Date();
  if (newStatus === "TRANSFERRED") data.transferredAt = new Date();

  const updated = await prisma.titleDeedTransfer.update({ where: { id }, data });

  if (newStatus === "TRANSFERRED") {
    // Snapshot the deed number on the unit for fast lookup
    if (updated.deedNumber) {
      await prisma.unit.update({
        where: { id: updated.unitId },
        data: { titleDeedNumber: updated.deedNumber },
      });
    }
    eventBus.emit({
      eventType: "TITLE_DEED_TRANSFERRED" as any,
      aggregateId: updated.id,
      aggregateType: "UNIT",
      data: { transferId: updated.id, unitId: updated.unitId, dealId: updated.dealId },
      userId: changedBy,
      timestamp: new Date(),
    });
  }

  return updated;
}

export async function getTitleDeedsByUnit(unitId: string) {
  return prisma.titleDeedTransfer.findMany({
    where: { unitId },
    orderBy: { createdAt: "desc" },
  });
}
