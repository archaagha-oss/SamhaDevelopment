/**
 * Reservation service.
 *
 * Requires the following Prisma model (add via migration):
 *
 *   enum ReservationStatus {
 *     ACTIVE
 *     EXPIRED
 *     CANCELLED
 *     CONVERTED
 *   }
 *
 *   model Reservation {
 *     id               String            @id @default(cuid())
 *     unitId           String
 *     unit             Unit              @relation(fields: [unitId], references: [id])
 *     leadId           String
 *     lead             Lead              @relation(fields: [leadId], references: [id])
 *     createdByUserId  String
 *     notes            String?           @db.Text
 *     status           ReservationStatus @default(ACTIVE)
 *     expiresAt        DateTime
 *     expiredAt        DateTime?
 *     cancelledAt      DateTime?
 *     cancelReason     String?
 *     convertedToDealId String?
 *     createdAt        DateTime          @default(now())
 *     updatedAt        DateTime          @updatedAt
 *
 *     @@index([unitId])
 *     @@index([leadId])
 *     @@index([status])
 *     @@index([expiresAt])
 *   }
 */

import { prisma } from "../lib/prisma.js";
import { eventBus } from "../events/eventBus.js";
import { scheduleJob } from "../events/jobs/jobHandlers.js";
import { createDeal } from "./dealService.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectConfig {
  /** Number of days before a reservation expires */
  reservationDays: number;
}

export interface CreateDealData {
  salePrice: number;
  discount: number;
  paymentPlanId: string;
  brokerCompanyId?: string;
  brokerAgentId?: string;
}

// ---------------------------------------------------------------------------
// Reservation model accessor (forward-compatible)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reservationModel(): any | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  if (typeof p.reservation?.create !== "function") {
    return null;
  }
  return p.reservation;
}

function requireReservationModel(): NonNullable<ReturnType<typeof reservationModel>> {
  const model = reservationModel();
  if (!model) {
    throw new Error(
      "Reservation model is not available. Please run the pending Prisma migration."
    );
  }
  return model;
}

// ---------------------------------------------------------------------------
// createReservation
// ---------------------------------------------------------------------------

export async function createReservation(
  unitId: string,
  leadId: string,
  userId: string,
  projectConfig: ProjectConfig,
  notes?: string
) {
  const model = requireReservationModel();

  const expiresAt = new Date(
    Date.now() + projectConfig.reservationDays * 24 * 60 * 60 * 1000
  );

  // Atomic: verify availability, lock unit, create reservation — prevents double-booking
  const { unit, reservation } = await prisma.$transaction(async (tx) => {
    const txModel = (tx as any).reservation as typeof model;

    const unit = await tx.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new Error(`Unit ${unitId} not found`);
    if (unit.status !== "AVAILABLE") {
      throw new Error(`Unit ${unit.unitNumber} is not available (current status: ${unit.status})`);
    }

    const existing = await txModel.findFirst({ where: { unitId, status: "ACTIVE" } });
    if (existing) {
      throw new Error(`Unit ${unit.unitNumber} already has an active reservation (id: ${existing.id})`);
    }

    await tx.unit.update({ where: { id: unitId }, data: { status: "RESERVED" } });

    const reservation = await txModel.create({
      data: { unitId, leadId, createdByUserId: userId, notes: notes ?? null, status: "ACTIVE", expiresAt },
    });

    return { unit, reservation };
  });

  // 6. Emit UNIT_RESERVED event
  eventBus.emit({
    eventType: "UNIT_RESERVED",
    aggregateId: unitId,
    aggregateType: "UNIT",
    data: {
      reservationId: reservation.id,
      unitId,
      leadId,
      expiresAt: expiresAt.toISOString(),
    },
    userId,
    timestamp: new Date(),
  });

  // Emit RESERVATION_CREATED event
  eventBus.emit({
    eventType: "RESERVATION_CREATED",
    aggregateId: reservation.id,
    aggregateType: "RESERVATION",
    data: {
      reservationId: reservation.id,
      unitId,
      leadId,
      expiresAt: expiresAt.toISOString(),
    },
    userId,
    timestamp: new Date(),
  });

  // 7. Schedule RESERVATION_EXPIRY job
  await scheduleJob(
    "RESERVATION_EXPIRY",
    { reservationId: reservation.id },
    expiresAt
  );

  return reservation;
}

// ---------------------------------------------------------------------------
// cancelReservation
// ---------------------------------------------------------------------------

export async function cancelReservation(
  reservationId: string,
  userId: string,
  reason?: string
) {
  const model = requireReservationModel();

  const reservation = await model.findUnique({
    where: { id: reservationId },
  });

  if (!reservation) {
    throw new Error(`Reservation ${reservationId} not found`);
  }
  if (reservation.status !== "ACTIVE") {
    throw new Error(
      `Reservation ${reservationId} is not ACTIVE (status: ${reservation.status})`
    );
  }

  // Set CANCELLED
  const updated = await model.update({
    where: { id: reservationId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: reason ?? null,
    },
  });

  // Release unit
  await prisma.unit.update({
    where: { id: reservation.unitId },
    data: { status: "AVAILABLE" },
  });

  eventBus.emit({
    eventType: "RESERVATION_CANCELLED",
    aggregateId: reservationId,
    aggregateType: "RESERVATION",
    data: {
      reservationId,
      unitId: reservation.unitId,
      reason: reason ?? null,
    },
    userId,
    timestamp: new Date(),
  });

  return updated;
}

// ---------------------------------------------------------------------------
// convertReservationToDeal
// ---------------------------------------------------------------------------

export async function convertReservationToDeal(
  reservationId: string,
  dealData: CreateDealData,
  userId: string
) {
  const model = requireReservationModel();

  const reservation = await model.findUnique({
    where: { id: reservationId },
  });

  if (!reservation) {
    throw new Error(`Reservation ${reservationId} not found`);
  }
  if (reservation.status !== "ACTIVE") {
    throw new Error(
      `Reservation ${reservationId} is not ACTIVE (status: ${reservation.status})`
    );
  }

  const now = new Date();
  if (new Date(reservation.expiresAt) < now) {
    throw new Error(
      `Reservation ${reservationId} has expired (expired at ${reservation.expiresAt})`
    );
  }

  // Mark reservation CONVERTED first (optimistic lock)
  await model.update({
    where: { id: reservationId },
    data: { status: "CONVERTED" },
  });

  let deal;
  try {
    deal = await createDeal({
      leadId: reservation.leadId,
      unitId: reservation.unitId,
      salePrice: dealData.salePrice,
      discount: dealData.discount,
      paymentPlanId: dealData.paymentPlanId,
      brokerCompanyId: dealData.brokerCompanyId,
      brokerAgentId: dealData.brokerAgentId,
      createdBy: userId,
    });
  } catch (err) {
    // Roll back the reservation status on createDeal failure
    await model.update({
      where: { id: reservationId },
      data: { status: "ACTIVE" },
    }).catch(() => {
      // Ignore rollback error — let the original error surface
    });
    throw err;
  }

  // Link deal to reservation
  await model.update({
    where: { id: reservationId },
    data: { convertedToDealId: deal.id },
  });

  eventBus.emit({
    eventType: "RESERVATION_CONVERTED",
    aggregateId: reservationId,
    aggregateType: "RESERVATION",
    data: {
      reservationId,
      dealId: deal.id,
      unitId: reservation.unitId,
      leadId: reservation.leadId,
    },
    userId,
    timestamp: new Date(),
  });

  return deal;
}

// ---------------------------------------------------------------------------
// getActiveReservation
// ---------------------------------------------------------------------------

export async function getActiveReservation(unitId: string) {
  const model = reservationModel();
  if (!model) return null;

  const reservation = await model.findFirst({
    where: { unitId, status: "ACTIVE" },
  });

  return reservation ?? null;
}

// ---------------------------------------------------------------------------
// checkAndExpireReservations
// ---------------------------------------------------------------------------

export async function checkAndExpireReservations(): Promise<number> {
  const model = reservationModel();
  if (!model) return 0;

  const now = new Date();

  const expired = (await model.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lt: now },
    },
    select: { id: true, unitId: true },
  })) as Array<{ id: string; unitId: string }>;

  if (expired.length === 0) return 0;

  let count = 0;

  await Promise.allSettled(
    expired.map(async (r) => {
      try {
        await model.update({
          where: { id: r.id },
          data: { status: "EXPIRED", expiredAt: now },
        });

        await prisma.unit.update({
          where: { id: r.unitId },
          data: { status: "AVAILABLE" },
        });

        eventBus.emit({
          eventType: "RESERVATION_EXPIRED",
          aggregateId: r.id,
          aggregateType: "RESERVATION",
          data: { reservationId: r.id, unitId: r.unitId },
          timestamp: now,
        });

        count++;
      } catch (err) {
        console.error(
          `[reservationService] checkAndExpireReservations: failed for reservation ${r.id}:`,
          err
        );
      }
    })
  );

  return count;
}
