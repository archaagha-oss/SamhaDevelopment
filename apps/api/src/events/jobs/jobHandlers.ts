/**
 * Background job processor.
 *
 * Relies on a BackgroundJob model in the Prisma schema. Until that model is
 * added via migration, scheduleJob() gracefully no-ops and processJobs() is
 * a safe no-op. The schema additions required are documented at the bottom
 * of this file.
 */

import { prisma } from "../../lib/prisma.js";
import { eventBus } from "../eventBus.js";
import { releaseExpiredHolds } from "../../services/unitService.js";

// ---------------------------------------------------------------------------
// Job types
// ---------------------------------------------------------------------------

export type JobType =
  | "RESERVATION_EXPIRY"
  | "PAYMENT_REMINDER"
  | "OQOOD_DEADLINE_WARNING"
  | "RESERVATION_EXPIRY_CHECK"
  | "PAYMENT_OVERDUE_CHECK"
  | "UNIT_HOLD_EXPIRY_CHECK";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JobPayload = Record<string, any>;

// ---------------------------------------------------------------------------
// Prisma accessor helpers (forward-compatible with schema migration)
// ---------------------------------------------------------------------------

function backgroundJobModel() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  if (typeof p.backgroundJob?.findMany !== "function") {
    return null;
  }
  return p.backgroundJob;
}

// ---------------------------------------------------------------------------
// scheduleJob — creates a BackgroundJob record
// ---------------------------------------------------------------------------

export async function scheduleJob(
  type: JobType,
  payload: JobPayload,
  scheduledAt: Date
): Promise<void> {
  const model = backgroundJobModel();
  if (!model) {
    // Schema migration not yet applied — log and skip
    console.warn(
      `[JobProcessor] scheduleJob: BackgroundJob model unavailable. ` +
        `Skipping ${type} job scheduled for ${scheduledAt.toISOString()}`
    );
    return;
  }

  try {
    await model.create({
      data: {
        type,
        payload: JSON.stringify(payload),
        status: "PENDING",
        scheduledAt,
        retryCount: 0,
        maxRetries: 3,
      },
    });
  } catch (err) {
    console.error(`[JobProcessor] scheduleJob error for ${type}:`, err);
  }
}

// ---------------------------------------------------------------------------
// processJobs — run one batch of up to 10 due jobs
// ---------------------------------------------------------------------------

export async function processJobs(): Promise<void> {
  const model = backgroundJobModel();
  if (!model) return;

  let jobs: JobRecord[];

  try {
    jobs = (await model.findMany({
      where: {
        status: "PENDING",
        scheduledAt: { lte: new Date() },
      },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    })) as JobRecord[];
  } catch (err) {
    console.error("[JobProcessor] processJobs: failed to fetch jobs:", err);
    return;
  }

  if (jobs.length === 0) return;

  await Promise.allSettled(jobs.map((job) => runJob(job)));
}

// ---------------------------------------------------------------------------
// Internal: execute a single job
// ---------------------------------------------------------------------------

interface JobRecord {
  id: string;
  type: JobType;
  payload: string;
  retryCount: number;
  maxRetries: number;
}

async function runJob(job: JobRecord): Promise<void> {
  const model = backgroundJobModel();
  if (!model) return;

  // Mark as RUNNING
  try {
    await model.update({
      where: { id: job.id },
      data: { status: "RUNNING", startedAt: new Date() },
    });
  } catch (err) {
    console.error(`[JobProcessor] runJob: failed to mark job ${job.id} RUNNING:`, err);
    return;
  }

  let payload: JobPayload;
  try {
    payload = JSON.parse(job.payload) as JobPayload;
  } catch {
    payload = {};
  }

  try {
    await dispatchJob(job.type, payload);

    await model.update({
      where: { id: job.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  } catch (err) {
    console.error(`[JobProcessor] Job ${job.id} (${job.type}) failed:`, err);

    const newRetryCount = job.retryCount + 1;
    const shouldRetry = newRetryCount < job.maxRetries;

    await model.update({
      where: { id: job.id },
      data: {
        status: shouldRetry ? "PENDING" : "FAILED",
        retryCount: newRetryCount,
        // Exponential back-off: 2^n minutes
        scheduledAt: shouldRetry
          ? new Date(Date.now() + Math.pow(2, newRetryCount) * 60_000)
          : undefined,
        failedAt: shouldRetry ? undefined : new Date(),
        errorMessage:
          err instanceof Error ? err.message : String(err),
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Job dispatcher
// ---------------------------------------------------------------------------

async function dispatchJob(type: JobType, payload: JobPayload): Promise<void> {
  switch (type) {
    case "RESERVATION_EXPIRY":
      return handleReservationExpiry(payload);
    case "PAYMENT_REMINDER":
      return handlePaymentReminder(payload);
    case "OQOOD_DEADLINE_WARNING":
      return handleOqoodDeadlineWarning(payload);
    case "RESERVATION_EXPIRY_CHECK":
      return handleReservationExpiryCheck();
    case "PAYMENT_OVERDUE_CHECK":
      return handlePaymentOverdueCheck();
    case "UNIT_HOLD_EXPIRY_CHECK":
      return handleUnitHoldExpiryCheck();
    default: {
      const exhaustive: never = type;
      throw new Error(`Unknown job type: ${exhaustive}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Job implementations
// ---------------------------------------------------------------------------

/** 1. RESERVATION_EXPIRY — expire a single reservation if still ACTIVE */
async function handleReservationExpiry(payload: JobPayload): Promise<void> {
  const { reservationId } = payload as { reservationId: string };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  if (typeof p.reservation?.findUnique !== "function") return;

  const reservation = await p.reservation.findUnique({
    where: { id: reservationId },
  });

  if (!reservation) return;

  if (reservation.status !== "ACTIVE") return;

  const now = new Date();
  if (new Date(reservation.expiresAt) >= now) return; // not yet expired

  await p.reservation.update({
    where: { id: reservationId },
    data: { status: "EXPIRED", expiredAt: now },
  });

  await prisma.unit.update({
    where: { id: reservation.unitId },
    data: { status: "AVAILABLE" },
  });

  eventBus.emit({
    eventType: "RESERVATION_EXPIRED",
    aggregateId: reservationId,
    aggregateType: "RESERVATION",
    data: { reservationId, unitId: reservation.unitId },
    timestamp: now,
  });
}

/** 2. PAYMENT_REMINDER — notify agent about an overdue payment */
async function handlePaymentReminder(payload: JobPayload): Promise<void> {
  const { paymentId, daysOverdue } = payload as {
    paymentId: string;
    daysOverdue: number;
  };

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      deal: {
        include: {
          lead: { include: { assignedAgent: true } },
        },
      },
    },
  });

  if (!payment) return;
  if (!["PENDING", "OVERDUE"].includes(payment.status)) return;

  const agent = payment.deal.lead.assignedAgent;
  if (!agent) return;

  await prisma.notification.create({
    data: {
      userId: agent.id,
      message: `Payment of AED ${payment.amount.toLocaleString()} (${payment.milestoneLabel}) is ${daysOverdue} day(s) overdue for deal ${payment.deal.id}.`,
      leadId: payment.deal.leadId,
    },
  });
}

/** 3. OQOOD_DEADLINE_WARNING — notify if Oqood not yet registered */
async function handleOqoodDeadlineWarning(payload: JobPayload): Promise<void> {
  const { dealId, daysRemaining } = payload as {
    dealId: string;
    daysRemaining: number;
  };

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      lead: { include: { assignedAgent: true } },
    },
  });

  if (!deal) return;
  if (deal.stage === "OQOOD_REGISTERED" || deal.stage === "CANCELLED") return;

  const agent = deal.lead.assignedAgent;
  if (!agent) return;

  await prisma.notification.create({
    data: {
      userId: agent.id,
      message: `URGENT: Oqood registration deadline for deal ${deal.dealNumber} is in ${daysRemaining} day(s) (${deal.oqoodDeadline.toLocaleDateString()}).`,
      leadId: deal.leadId,
    },
  });

  eventBus.emit({
    eventType: "OQOOD_DEADLINE_WARNING",
    aggregateId: dealId,
    aggregateType: "DEAL",
    data: { dealId, daysRemaining },
    timestamp: new Date(),
  });
}

/** 4. RESERVATION_EXPIRY_CHECK — daily sweep of all expired active reservations */
async function handleReservationExpiryCheck(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  if (typeof p.reservation?.findMany !== "function") return;

  const now = new Date();

  const expiredReservations = (await p.reservation.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lt: now },
    },
    select: { id: true, unitId: true },
  })) as Array<{ id: string; unitId: string }>;

  if (expiredReservations.length === 0) return;

  await Promise.allSettled(
    expiredReservations.map(async (r) => {
      try {
        await p.reservation.update({
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
      } catch (err) {
        console.error(
          `[JobProcessor] handleReservationExpiryCheck: failed to expire reservation ${r.id}:`,
          err
        );
      }
    })
  );
}

/** 5. PAYMENT_OVERDUE_CHECK — daily sweep to mark overdue payments */
async function handlePaymentOverdueCheck(): Promise<void> {
  const now = new Date();

  const overduePayments = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      dueDate: { lt: now },
    },
    select: {
      id: true,
      dealId: true,
      amount: true,
      milestoneLabel: true,
      dueDate: true,
    },
  });

  if (overduePayments.length === 0) return;

  await Promise.allSettled(
    overduePayments.map(async (payment) => {
      try {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "OVERDUE" },
        });

        const daysOverdue = Math.floor(
          (now.getTime() - new Date(payment.dueDate).getTime()) /
            (1000 * 60 * 60 * 24)
        );

        eventBus.emit({
          eventType: "PAYMENT_OVERDUE",
          aggregateId: payment.id,
          aggregateType: "PAYMENT",
          data: {
            paymentId: payment.id,
            dealId: payment.dealId,
            amount: payment.amount,
            daysOverdue,
          },
          timestamp: now,
        });

        // Schedule a reminder notification job
        await scheduleJob(
          "PAYMENT_REMINDER",
          { paymentId: payment.id, daysOverdue },
          now // process immediately
        );
      } catch (err) {
        console.error(
          `[JobProcessor] handlePaymentOverdueCheck: failed for payment ${payment.id}:`,
          err
        );
      }
    })
  );
}

/** 6. UNIT_HOLD_EXPIRY_CHECK — release ON_HOLD units whose hold period has expired */
async function handleUnitHoldExpiryCheck(): Promise<void> {
  const released = await releaseExpiredHolds("system");
  if (released > 0) {
    console.log(`[JobProcessor] Released ${released} expired ON_HOLD unit(s) back to AVAILABLE`);
  }
}

// ---------------------------------------------------------------------------
// startJobProcessor — run processJobs on a fixed interval
// ---------------------------------------------------------------------------

export function startJobProcessor(intervalMs: number): NodeJS.Timer {
  console.log(
    `[JobProcessor] Starting job processor with interval ${intervalMs}ms`
  );
  return setInterval(() => {
    processJobs().catch((err: unknown) => {
      console.error("[JobProcessor] processJobs interval error:", err);
    });
  }, intervalMs);
}

// ---------------------------------------------------------------------------
// Required schema additions (add to prisma/schema.prisma):
//
// enum JobStatus {
//   PENDING
//   RUNNING
//   COMPLETED
//   FAILED
// }
//
// model BackgroundJob {
//   id           String    @id @default(cuid())
//   type         String
//   payload      String    @db.Text
//   status       JobStatus @default(PENDING)
//   scheduledAt  DateTime
//   startedAt    DateTime?
//   completedAt  DateTime?
//   failedAt     DateTime?
//   errorMessage String?   @db.Text
//   retryCount   Int       @default(0)
//   maxRetries   Int       @default(3)
//   createdAt    DateTime  @default(now())
//   updatedAt    DateTime  @updatedAt
//
//   @@index([status, scheduledAt])
//   @@index([type])
// }
// ---------------------------------------------------------------------------
