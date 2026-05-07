import type { SnagSeverity, SnagStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { eventBus } from "../events/eventBus";

/**
 * Snag-list state machine.  Same shape as unitService's transition table —
 * deliberate consistency with the rest of the codebase.
 */
const VALID_SNAG_TRANSITIONS: Record<SnagStatus, SnagStatus[]> = {
  RAISED:        ["ACKNOWLEDGED", "REJECTED", "CLOSED"],
  ACKNOWLEDGED:  ["IN_PROGRESS", "REJECTED", "CLOSED"],
  IN_PROGRESS:   ["FIXED", "REJECTED"],
  FIXED:         ["CLOSED", "IN_PROGRESS"], // re-open if buyer rejects fix
  REJECTED:      ["RAISED"],
  CLOSED:        [],
};

export function validateSnagTransition(
  from: SnagStatus,
  to: SnagStatus,
): { valid: boolean; error?: string } {
  const allowed = VALID_SNAG_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      valid: false,
      error: `Cannot transition snag from ${from} to ${to}. Allowed: ${allowed.join(", ") || "none"}`,
    };
  }
  return { valid: true };
}

export async function createSnagList(unitId: string, label?: string) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { id: true } });
  if (!unit) throw new Error(`Unit not found: ${unitId}`);
  return prisma.snagList.create({
    data: { unitId, label: label ?? "Snag List" },
  });
}

export async function getSnagListsForUnit(unitId: string) {
  return prisma.snagList.findMany({
    where: { unitId },
    include: {
      items: {
        orderBy: { createdAt: "desc" },
        include: { photos: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function addSnagItem(
  listId: string,
  payload: {
    room?: string;
    category?: string;
    description: string;
    severity?: SnagSeverity;
    contractorName?: string;
    contractorEmail?: string;
    dueDate?: Date | string;
  },
  raisedBy: string,
) {
  const list = await prisma.snagList.findUnique({ where: { id: listId }, select: { id: true, unitId: true } });
  if (!list) throw new Error(`Snag list not found: ${listId}`);

  const item = await prisma.snagItem.create({
    data: {
      listId,
      room: payload.room,
      category: payload.category,
      description: payload.description,
      severity: payload.severity ?? "MINOR",
      contractorName: payload.contractorName,
      contractorEmail: payload.contractorEmail,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      raisedBy,
    },
  });

  eventBus.emit({
    eventType: "SNAG_RAISED" as any,
    aggregateId: item.id,
    aggregateType: "UNIT",
    data: { snagId: item.id, listId, unitId: list.unitId, severity: item.severity },
    userId: raisedBy,
    timestamp: new Date(),
  });

  return item;
}

export async function updateSnagStatus(
  itemId: string,
  newStatus: SnagStatus,
  changedBy: string,
  payload?: { rejectionReason?: string; fixedDate?: Date | string },
) {
  const item = await prisma.snagItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error(`Snag item not found: ${itemId}`);

  const validation = validateSnagTransition(item.status, newStatus);
  if (!validation.valid) throw new Error(validation.error);

  const data: Record<string, unknown> = { status: newStatus };
  if (newStatus === "FIXED") {
    data.fixedDate = payload?.fixedDate ? new Date(payload.fixedDate) : new Date();
    data.fixedBy = changedBy;
  }
  if (newStatus === "CLOSED") {
    data.closedDate = new Date();
  }
  if (newStatus === "REJECTED" && payload?.rejectionReason) {
    data.rejectionReason = payload.rejectionReason;
  }

  return prisma.snagItem.update({ where: { id: itemId }, data });
}

export async function attachSnagPhoto(
  itemId: string,
  s3Key: string,
  caption?: string,
  kind: "BEFORE" | "AFTER" = "BEFORE",
) {
  return prisma.snagPhoto.create({
    data: { itemId, s3Key, caption: caption ?? null, kind },
  });
}

export async function deleteSnagPhoto(photoId: string) {
  return prisma.snagPhoto.delete({ where: { id: photoId } });
}

export async function deleteSnagItem(itemId: string) {
  return prisma.snagItem.delete({ where: { id: itemId } });
}
