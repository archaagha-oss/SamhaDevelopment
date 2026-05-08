import { UnitStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { eventBus } from "../events/eventBus";

// ---------------------------------------------------------------------------
// Status transition table
// INTERESTED has been removed from the valid transitions.
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<UnitStatus, UnitStatus[]> = {
  NOT_RELEASED: ["AVAILABLE", "BLOCKED"],
  AVAILABLE:    ["NOT_RELEASED", "ON_HOLD", "RESERVED", "BLOCKED"],
  ON_HOLD:      ["AVAILABLE", "RESERVED", "BLOCKED"],
  RESERVED:     ["BOOKED", "AVAILABLE", "BLOCKED"],
  BOOKED:       ["SOLD", "RESERVED", "BLOCKED"],
  SOLD:         ["HANDED_OVER"],
  HANDED_OVER:  [],
  BLOCKED:      ["AVAILABLE", "NOT_RELEASED"],
};

// Statuses that can only be set by the deal system, not manually
const DEAL_OWNED_STATUSES: UnitStatus[] = ["ON_HOLD", "RESERVED", "BOOKED", "SOLD", "HANDED_OVER"];

// ---------------------------------------------------------------------------
// Pure validation helper
// ---------------------------------------------------------------------------

/**
 * Validate whether a status transition is permitted.
 * Synchronous — no database calls.
 */
export function validateStatusTransition(
  currentStatus: UnitStatus,
  newStatus: UnitStatus
): { valid: boolean; error?: string } {
  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];

  if (!allowed.includes(newStatus)) {
    return {
      valid: false,
      error: `Cannot transition from ${currentStatus} to ${newStatus}. Valid transitions: ${allowed.length > 0 ? allowed.join(", ") : "none"}.`,
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Core mutation
// ---------------------------------------------------------------------------

/**
 * Update a unit's status with full validation, history tracking, and event emission.
 * Wraps all database mutations in a single transaction.
 */
export async function updateUnitStatus(
  unitId: string,
  newStatus: UnitStatus,
  changedBy: string,
  reason?: string
) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });

  if (!unit) {
    throw new Error(`Unit not found: ${unitId}`);
  }

  const validation = validateStatusTransition(unit.status, newStatus);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  if (newStatus === "BLOCKED" && !reason) {
    throw new Error("A reason is required when blocking a unit.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.unit.update({
      where: { id: unitId },
      data: { status: newStatus, updatedAt: new Date() },
    });

    await tx.unitStatusHistory.create({
      data: {
        unitId,
        oldStatus: unit.status,
        newStatus,
        changedBy,
        reason: reason ?? null,
      },
    });

    return result;
  });

  // Clear blockReason/blockExpiresAt when transitioning to AVAILABLE
  if (newStatus === "AVAILABLE") {
    await prisma.unit.update({
      where: { id: unitId },
      data: { blockReason: null, blockExpiresAt: null, holdExpiresAt: null },
    });
  }

  // Clear holdExpiresAt when leaving ON_HOLD for any status
  if (unit.status === "ON_HOLD" && newStatus !== "ON_HOLD") {
    await prisma.unit.update({
      where: { id: unitId },
      data: { holdExpiresAt: null },
    });
  }

  // Emit domain event — fire-and-forget (eventBus catches handler errors internally)
  eventBus.emit({
    eventType: "UNIT_STATUS_CHANGED",
    aggregateId: unitId,
    aggregateType: "UNIT",
    data: {
      unitId,
      oldStatus: unit.status,
      newStatus,
      changedBy,
      reason: reason ?? null,
    },
    userId: changedBy,
    timestamp: new Date(),
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

/**
 * Move a unit from AVAILABLE → RESERVED.
 */
export async function reserveUnit(
  unitId: string,
  changedBy: string,
  reason?: string
) {
  return updateUnitStatus(unitId, "RESERVED", changedBy, reason);
}

/**
 * Move a unit from RESERVED → BOOKED.
 * Also emits an SPA_SIGNED domain event.
 */
export async function bookUnit(unitId: string, changedBy: string) {
  const updated = await updateUnitStatus(unitId, "BOOKED", changedBy);

  eventBus.emit({
    eventType: "SPA_SIGNED",
    aggregateId: unitId,
    aggregateType: "UNIT",
    data: { unitId, changedBy },
    userId: changedBy,
    timestamp: new Date(),
  });

  return updated;
}

/**
 * Move a unit from BOOKED → SOLD.
 * Also emits an OQOOD_REGISTERED domain event.
 */
export async function sellUnit(unitId: string, changedBy: string) {
  const updated = await updateUnitStatus(unitId, "SOLD", changedBy);

  eventBus.emit({
    eventType: "OQOOD_REGISTERED",
    aggregateId: unitId,
    aggregateType: "UNIT",
    data: { unitId, changedBy },
    userId: changedBy,
    timestamp: new Date(),
  });

  return updated;
}

/**
 * Release a unit back to AVAILABLE from any RESERVED / BOOKED / BLOCKED state.
 * A reason is recommended but not enforced here (enforced at BLOCKED entry).
 */
export async function releaseUnit(
  unitId: string,
  changedBy: string,
  reason: string
) {
  return updateUnitStatus(unitId, "AVAILABLE", changedBy, reason);
}

/**
 * Move a unit from NOT_RELEASED → AVAILABLE (inventory release to market).
 */
export async function releaseToMarket(
  unitId: string,
  changedBy: string,
  reason?: string
) {
  return updateUnitStatus(unitId, "AVAILABLE", changedBy, reason ?? "Released to market");
}

/**
 * Check whether a status transition is deal-owned (cannot be set manually).
 */
export function isDealOwnedStatus(status: UnitStatus): boolean {
  return DEAL_OWNED_STATUSES.includes(status);
}

/**
 * Block a unit from further sales activity.
 * Reason is mandatory. Optional blockExpiresAt field persists on unit record.
 */
export async function blockUnit(
  unitId: string,
  changedBy: string,
  reason: string,
  blockExpiresAt?: Date
) {
  if (!reason) {
    throw new Error("A reason is required when blocking a unit.");
  }
  // Update status via existing transaction logic
  await updateUnitStatus(unitId, "BLOCKED", changedBy, reason);

  // Persist blockReason and optional expiry on unit record
  await prisma.unit.update({
    where: { id: unitId },
    data: { blockReason: reason, blockExpiresAt: blockExpiresAt ?? null },
  });
}

/**
 * Place a unit on a temporary soft hold (ON_HOLD) during the offer period.
 * Caller provides expiry date; a background job will release expired holds.
 */
export async function holdUnit(
  unitId: string,
  changedBy: string,
  holdExpiresAt: Date
) {
  await updateUnitStatus(unitId, "ON_HOLD", changedBy, "Soft hold during offer period");
  await prisma.unit.update({
    where: { id: unitId },
    data: { holdExpiresAt },
  });
}

/**
 * Release all units whose ON_HOLD period has expired back to AVAILABLE.
 * Called by a scheduled cron job.
 */
export async function releaseExpiredHolds(systemUserId: string) {
  const expired = await prisma.unit.findMany({
    where: {
      status: "ON_HOLD",
      holdExpiresAt: { lte: new Date() },
    },
    select: { id: true },
  });

  await Promise.all(
    expired.map((u) =>
      updateUnitStatus(u.id, "AVAILABLE", systemUserId, "ON_HOLD period expired — unit released automatically")
    )
  );

  return expired.length;
}

// ---------------------------------------------------------------------------
// Deprecated — kept for backward compatibility
// ---------------------------------------------------------------------------

/**
 * @deprecated Use sellUnit() for standard status transitions.
 * Kept for compatibility with dealService.ts which calls autoSellUnit().
 * Updates the unit's salePrice in addition to marking it SOLD.
 */
export async function autoSellUnit(
  unitId: string,
  salePrice: number,
  changedBy: string
) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });

  if (!unit) {
    throw new Error(`Unit not found: ${unitId}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.unit.update({
      where: { id: unitId },
      data: {
        status: "SOLD",
        updatedAt: new Date(),
      },
    });

    await tx.unitStatusHistory.create({
      data: {
        unitId,
        oldStatus: unit.status,
        newStatus: "SOLD",
        changedBy,
        reason: "Auto-sold via deal creation (autoSellUnit — deprecated)",
      },
    });

    return result;
  });

  eventBus.emit({
    eventType: "UNIT_STATUS_CHANGED",
    aggregateId: unitId,
    aggregateType: "UNIT",
    data: {
      unitId,
      oldStatus: unit.status,
      newStatus: "SOLD",
      salePrice,
      changedBy,
    },
    userId: changedBy,
    timestamp: new Date(),
  });

  eventBus.emit({
    eventType: "OQOOD_REGISTERED",
    aggregateId: unitId,
    aggregateType: "UNIT",
    data: { unitId, salePrice, changedBy },
    userId: changedBy,
    timestamp: new Date(),
  });

  return updated;
}
