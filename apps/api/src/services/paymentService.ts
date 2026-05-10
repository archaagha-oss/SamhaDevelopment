import { PaymentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { paymentLogger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Bulk import types — used by routes/payments bulk-import endpoint.
// Kept here so route handlers stay thin and a unit test can exercise the
// pure resolution + dispatch logic in isolation.
// ---------------------------------------------------------------------------

export interface BulkPaymentInputRow {
  /** 1-based row number in the source file, used in the response. */
  row: number;
  paymentId?: string;
  dealNumber?: string;
  milestoneLabel?: string;
  amount: number;
  paidDate: Date;
  paymentMethod: string;
  receiptKey?: string;
  notes?: string;
}

export interface BulkPaymentRowError {
  row: number;
  reason: string;
  dealNumber?: string;
  milestoneLabel?: string;
  paymentId?: string;
}

export interface BulkPaymentRowSuccess {
  row: number;
  paymentId: string;
  dealNumber?: string;
  milestoneLabel?: string;
  action: "MARKED_PAID" | "PARTIAL_RECORDED";
}

export interface BulkPaymentResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  successes: BulkPaymentRowSuccess[];
  errors: BulkPaymentRowError[];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarkPaymentPaidData {
  paidDate: Date;
  paymentMethod: string;
  paidBy: string;
  receiptKey?: string;
  notes?: string;
}

export interface RecordPartialPaymentData {
  amount: number;
  paidDate: Date;
  paymentMethod: string;
  paidBy: string;
  receiptKey?: string;
  notes?: string;
}

export interface RecordPartialPaymentResult {
  payment: Awaited<ReturnType<typeof prisma.payment.findUniqueOrThrow>>;
  partial: Awaited<ReturnType<typeof prisma.partialPayment.create>>;
  isFullyPaid: boolean;
}

export interface PaymentScheduleMilestone {
  label: string;
  percentage: number;
  isDLDFee: boolean;
  isAdminFee: boolean;
  triggerType?: string;
  daysFromReservation?: number | null;
  fixedDate?: Date | string | null;
}

export interface RecalculateResult {
  updated: number;
  skipped: number;
}

// ---------------------------------------------------------------------------
// Non-terminal statuses — payments in these states can still be modified
// ---------------------------------------------------------------------------

const MUTABLE_STATUSES: PaymentStatus[] = [
  "PENDING",
  "PARTIAL",
  "OVERDUE",
  "PDC_PENDING",
  "PDC_CLEARED",
  "PDC_BOUNCED",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Writes a PaymentAuditLog entry. Separated so every mutation path can use it
 * consistently without duplicating the Prisma call.
 */
async function writeAuditLog(
  paymentId: string,
  action: string,
  changedBy: string,
  reason?: string
): Promise<void> {
  await prisma.paymentAuditLog.create({
    data: {
      paymentId,
      action,
      changedBy,
      reason: reason ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Mark a payment as fully paid.
 * Validates that the payment exists and is not already PAID or CANCELLED.
 */
export async function markPaymentPaid(
  paymentId: string,
  data: MarkPaymentPaidData
) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

  if (!payment) {
    throw new Error(`Payment not found: ${paymentId}`);
  }
  if (payment.status === "PAID") {
    throw new Error("Payment is already PAID and cannot be changed.");
  }
  if (payment.status === "CANCELLED") {
    throw new Error("Cannot mark a CANCELLED payment as paid.");
  }

  paymentLogger.info("Payment marked paid", {
    paymentId, dealId: payment.dealId, amount: payment.amount,
    paidBy: data.paidBy, paymentMethod: data.paymentMethod,
  });

  const [updated] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "PAID",
        paidDate: data.paidDate,
        paidBy: data.paidBy,
        paymentMethod: data.paymentMethod,
        receiptKey: data.receiptKey ?? null,
        notes: data.notes ?? null,
        updatedAt: new Date(),
      },
      include: { auditLog: true },
    }),
    prisma.paymentAuditLog.create({
      data: {
        paymentId,
        action: "PAYMENT_RECEIVED",
        changedBy: data.paidBy,
      },
    }),
  ]);

  return updated;
}

/**
 * Record a partial payment against a payment.
 * If the sum of all partial payments equals the full amount, the parent payment
 * is automatically marked as PAID.
 */
export async function recordPartialPayment(
  paymentId: string,
  data: RecordPartialPaymentData
): Promise<RecordPartialPaymentResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { partialPayments: true },
  });

  if (!payment) {
    throw new Error(`Payment not found: ${paymentId}`);
  }
  if (payment.status === "PAID") {
    throw new Error("Cannot add a partial payment to an already PAID payment.");
  }
  if (payment.status === "CANCELLED") {
    throw new Error("Cannot add a partial payment to a CANCELLED payment.");
  }

  // Use adjustedAmount if set, otherwise original amount
  const totalAmount = payment.adjustedAmount ?? payment.amount;
  const alreadyPaid = payment.partialPayments.reduce(
    (sum, p) => sum + p.amount,
    0
  );
  const remaining = totalAmount - alreadyPaid;

  if (data.amount > remaining) {
    throw new Error(
      `Partial amount (${data.amount}) exceeds remaining balance (${remaining.toFixed(2)}).`
    );
  }
  if (data.amount <= 0) {
    throw new Error("Partial payment amount must be greater than zero.");
  }

  const newAlreadyPaid = alreadyPaid + data.amount;
  const isFullyPaid = Math.abs(newAlreadyPaid - totalAmount) < 0.01;

  // Build transaction ops
  const partial = await prisma.$transaction(async (tx) => {
    const created = await tx.partialPayment.create({
      data: {
        paymentId,
        amount: data.amount,
        paidDate: data.paidDate,
        paymentMethod: data.paymentMethod,
        paidBy: data.paidBy,
        receiptKey: data.receiptKey ?? null,
        notes: data.notes ?? null,
      },
    });

    await tx.paymentAuditLog.create({
      data: {
        paymentId,
        action: "PARTIAL_PAYMENT_RECORDED",
        changedBy: data.paidBy,
        reason: `Partial payment of ${data.amount} recorded (${newAlreadyPaid.toFixed(2)} / ${totalAmount.toFixed(2)} paid)`,
      },
    });

    if (isFullyPaid) {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: "PAID",
          paidDate: data.paidDate,
          paidBy: data.paidBy,
          paymentMethod: data.paymentMethod,
          updatedAt: new Date(),
        },
      });

      await tx.paymentAuditLog.create({
        data: {
          paymentId,
          action: "PAYMENT_RECEIVED",
          changedBy: data.paidBy,
          reason: "Auto-marked PAID after partial payments reached full amount",
        },
      });
    } else {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: "PARTIAL", updatedAt: new Date() },
      });
    }

    return created;
  });

  const updatedPayment = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { partialPayments: true, auditLog: true },
  });

  return { payment: updatedPayment, partial, isFullyPaid };
}

/**
 * Adjust the due date of a payment.
 * Not allowed on PAID or CANCELLED payments.
 */
export async function adjustPaymentDueDate(
  paymentId: string,
  newDueDate: Date,
  reason: string,
  changedBy: string
) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

  if (!payment) {
    throw new Error(`Payment not found: ${paymentId}`);
  }
  if (payment.status === "PAID") {
    throw new Error("Cannot adjust due date of a PAID payment.");
  }
  if (payment.status === "CANCELLED") {
    throw new Error("Cannot adjust due date of a CANCELLED payment.");
  }

  const [updated] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: paymentId },
      data: { dueDate: newDueDate, updatedAt: new Date() },
    }),
    prisma.paymentAuditLog.create({
      data: {
        paymentId,
        action: "DUE_DATE_ADJUSTED",
        changedBy,
        reason,
      },
    }),
  ]);

  return updated;
}

/**
 * Adjust the amount of a payment.
 * Stores the new value in `adjustedAmount`; `originalAmount` is never changed.
 * Not allowed on PAID payments.
 */
export async function adjustPaymentAmount(
  paymentId: string,
  newAmount: number,
  reason: string,
  changedBy: string
) {
  if (newAmount <= 0) {
    throw new Error("Adjusted amount must be greater than zero.");
  }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

  if (!payment) {
    throw new Error(`Payment not found: ${paymentId}`);
  }
  if (payment.status === "PAID") {
    throw new Error("Cannot adjust the amount of a PAID payment.");
  }

  const [updated] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: paymentId },
      data: { adjustedAmount: newAmount, updatedAt: new Date() },
    }),
    prisma.paymentAuditLog.create({
      data: {
        paymentId,
        action: "AMOUNT_ADJUSTED",
        changedBy,
        reason,
      },
    }),
  ]);

  return updated;
}

/**
 * Compute the late-fee amount for a given overdue payment using the most-
 * specific active LateFeeRule on the project. Returns null if no rule applies
 * yet (days-late below trigger) or no rules are configured.
 *
 * Rule selection: among active rules whose triggerAfterDays ≤ daysLate, pick
 * the one with the *highest* triggerAfterDays. This lets you stack rules like
 * "5% one-time after 7 days" + "1%/day after 30 days" — the second rule wins
 * once we cross day-30 because it's more specific to the late stage.
 *
 * Capped by maxFeeAmount when set.
 */
export async function computeLateFee(
  paymentId: string
): Promise<{
  amount: number;
  ruleId: string;
  ruleName: string;
  daysLate: number;
} | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { deal: { select: { unit: { select: { projectId: true } } } } },
  });
  if (!payment) return null;
  const projectId = payment.deal?.unit?.projectId;
  if (!projectId) return null;

  const now = new Date();
  const daysLate = Math.floor(
    (now.getTime() - payment.dueDate.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (daysLate <= 0) return null;

  const rules = await prisma.lateFeeRule.findMany({
    where: { projectId, isActive: true, triggerAfterDays: { lte: daysLate } },
    orderBy: { triggerAfterDays: "desc" },
  });
  if (rules.length === 0) return null;
  const rule = rules[0];

  let amount = 0;
  switch (rule.feeType) {
    case "FIXED_ONE_TIME":
      amount = rule.feeAmount;
      break;
    case "PERCENTAGE_PER_DAY":
      amount = (payment.amount * rule.feeAmount * daysLate) / 100;
      break;
    case "PERCENTAGE_PER_MONTH": {
      // Daily accrual against a monthly percentage.
      const monthsLate = daysLate / 30;
      amount = (payment.amount * rule.feeAmount * monthsLate) / 100;
      break;
    }
  }

  if (rule.maxFeeAmount != null && amount > rule.maxFeeAmount) {
    amount = rule.maxFeeAmount;
  }
  amount = Math.round(amount * 100) / 100; // 2 decimal places

  return amount > 0
    ? { amount, ruleId: rule.id, ruleName: rule.name, daysLate }
    : null;
}

/**
 * Materialize a late-fee Payment (sibling of the overdue one) for the deal.
 * Idempotent: tags the new Payment.paymentReference with `LATE_FEE:<srcId>`
 * and refuses to create a duplicate. If the rule changes or the accrued
 * amount grows over time, calls beyond the first one update the existing
 * row's amount in place rather than stacking new ones.
 */
export async function applyLateFeeIfApplicable(
  paymentId: string
): Promise<{ created: boolean; updated: boolean; lateFeePaymentId?: string; amount?: number }> {
  const fee = await computeLateFee(paymentId);
  if (!fee) return { created: false, updated: false };

  const source = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!source) return { created: false, updated: false };

  const reference = `LATE_FEE:${paymentId}`;
  const existing = await prisma.payment.findFirst({
    where: { paymentReference: reference, milestoneType: "LATE_FEE" },
  });

  if (existing) {
    if (Math.abs(existing.amount - fee.amount) < 0.01) {
      return { created: false, updated: false, lateFeePaymentId: existing.id, amount: existing.amount };
    }
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: existing.id },
        data: { amount: fee.amount, updatedAt: new Date() },
      }),
      prisma.paymentAuditLog.create({
        data: {
          paymentId: existing.id,
          action: "LATE_FEE_RECALCULATED",
          changedBy: "system",
          reason: `Recalc: ${fee.ruleName} → ${fee.amount} (${fee.daysLate}d late)`,
        },
      }),
    ]);
    return { created: false, updated: true, lateFeePaymentId: existing.id, amount: fee.amount };
  }

  const created = await prisma.$transaction(async (tx) => {
    const lateFee = await tx.payment.create({
      data: {
        dealId: source.dealId,
        milestoneLabel: `Late fee — ${source.milestoneLabel}`,
        amount: fee.amount,
        originalAmount: fee.amount,
        percentage: 0,
        dueDate: new Date(),
        status: "OVERDUE",
        milestoneType: "LATE_FEE",
        paymentReference: reference,
        targetAccount: "CORPORATE",
        notes: `Auto-applied per LateFeeRule "${fee.ruleName}" (${fee.daysLate} days late).`,
      },
    });
    await tx.paymentAuditLog.create({
      data: {
        paymentId: lateFee.id,
        action: "LATE_FEE_APPLIED",
        changedBy: "system",
        reason: `Rule: ${fee.ruleName}; ${fee.daysLate}d late; amount ${fee.amount}`,
      },
    });
    return lateFee;
  });

  paymentLogger.info("Late fee applied", {
    sourcePaymentId: paymentId,
    lateFeePaymentId: created.id,
    amount: fee.amount,
    daysLate: fee.daysLate,
    ruleName: fee.ruleName,
  });

  return { created: true, updated: false, lateFeePaymentId: created.id, amount: fee.amount };
}

/**
 * Mark a single payment as OVERDUE if it is PENDING and its due date has passed.
 * After marking, attempts to apply any active LateFeeRule for the project.
 */
export async function markPaymentOverdue(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

  if (!payment) {
    throw new Error(`Payment not found: ${paymentId}`);
  }
  if (payment.status !== "PENDING") {
    throw new Error(
      `Payment ${paymentId} is not PENDING (current: ${payment.status}). Only PENDING payments can be marked OVERDUE.`
    );
  }
  if (payment.dueDate >= new Date()) {
    throw new Error(
      `Payment ${paymentId} is not yet overdue (due: ${payment.dueDate.toISOString()}).`
    );
  }

  const [updated] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: paymentId },
      data: { status: "OVERDUE", updatedAt: new Date() },
    }),
    prisma.paymentAuditLog.create({
      data: {
        paymentId,
        action: "MARKED_OVERDUE",
        changedBy: "system",
        reason: `Due date ${payment.dueDate.toISOString()} has passed`,
      },
    }),
  ]);

  // Late-fee accrual is best-effort; failure here must not block the OVERDUE
  // transition itself.
  try {
    await applyLateFeeIfApplicable(paymentId);
  } catch (err) {
    paymentLogger.error("applyLateFeeIfApplicable failed", { paymentId, err: String(err) });
  }

  return updated;
}

/**
 * Batch job: find all PENDING payments whose due date has passed and mark them OVERDUE.
 * Returns the number of payments updated.
 */
export async function checkAndMarkOverduePayments(): Promise<number> {
  const now = new Date();

  const overduePayments = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      dueDate: { lt: now },
    },
    select: { id: true },
  });

  if (overduePayments.length === 0) {
    return 0;
  }

  const ids = overduePayments.map((p) => p.id);

  await prisma.$transaction([
    prisma.payment.updateMany({
      where: { id: { in: ids } },
      data: { status: "OVERDUE", updatedAt: now },
    }),
    ...ids.map((paymentId) =>
      prisma.paymentAuditLog.create({
        data: {
          paymentId,
          action: "MARKED_OVERDUE",
          changedBy: "system:cron",
          reason: `Batch overdue check at ${now.toISOString()}`,
        },
      })
    ),
  ]);

  // Accrue late fees for every newly-overdue payment AND for every payment
  // already in OVERDUE state (so percentage-per-day rules grow over time).
  // Failures per-payment don't abort the batch.
  const allOverdue = await prisma.payment.findMany({
    where: { status: "OVERDUE", milestoneType: { not: "LATE_FEE" } },
    select: { id: true },
  });
  for (const p of allOverdue) {
    try {
      await applyLateFeeIfApplicable(p.id);
    } catch (err) {
      paymentLogger.error("[cron] applyLateFeeIfApplicable failed", {
        paymentId: p.id,
        err: String(err),
      });
    }
  }

  return ids.length;
}

/**
 * Generate a full payment schedule for a deal from a set of milestones.
 * All Payment records are created inside a single transaction.
 */
export async function generatePaymentSchedule(
  dealId: string,
  plan: PaymentScheduleMilestone[],
  salePrice: number,
  dldFee: number,
  adminFee: number,
  reservationDate: Date,
  options?: { dldPaidBy?: "BUYER" | "DEVELOPER"; adminFeeWaived?: boolean }
) {
  const dldPaidBy = options?.dldPaidBy ?? "BUYER";
  const adminFeeWaived = options?.adminFeeWaived ?? false;

  return prisma.$transaction(async (tx) => {
    const created = await Promise.all(
      plan.map((milestone, idx) => {
        let amount: number;
        let milestoneType = "PLAN";
        let isWaived = false;

        if (milestone.isDLDFee) {
          amount = dldFee;
          if (dldPaidBy === "DEVELOPER") milestoneType = "DEVELOPER_COST";
        } else if (milestone.isAdminFee) {
          amount = adminFee;
          if (adminFeeWaived) isWaived = true;
        } else {
          amount = (milestone.percentage / 100) * salePrice;
        }

        const trigger = (milestone.triggerType ?? "DAYS_FROM_RESERVATION") as string;
        let dueDate: Date;

        if (trigger === "FIXED_DATE" && milestone.fixedDate) {
          dueDate = new Date(milestone.fixedDate);
        } else if (
          trigger === "ON_SPA_SIGNING" ||
          trigger === "ON_OQOOD" ||
          trigger === "ON_HANDOVER"
        ) {
          // Placeholder date — will be overwritten when the deal event fires
          dueDate = new Date(reservationDate);
        } else {
          // DAYS_FROM_RESERVATION (default)
          dueDate = new Date(reservationDate);
          dueDate.setDate(dueDate.getDate() + (milestone.daysFromReservation ?? 0));
        }

        return tx.payment.create({
          data: {
            dealId,
            milestoneLabel: milestone.label,
            amount,
            percentage: milestone.percentage,
            dueDate,
            sortOrder: idx,
            milestoneType,
            scheduleTrigger: trigger as any,
            // Carry the plan-milestone account routing through to the payment.
            targetAccount: ((milestone as any).targetAccount === "CORPORATE"
              ? "CORPORATE"
              : "ESCROW") as any,
            isWaived,
            status: isWaived ? "CANCELLED" : "PENDING",
            originalAmount: amount,
          },
        });
      })
    );

    return created;
  });
}

/**
 * Waive a payment — removes it from buyer obligations.
 * Only PENDING or OVERDUE payments can be waived. ADMIN/FINANCE role enforced at route level.
 */
export async function waivePayment(
  paymentId: string,
  reason: string,
  waivedBy: string
) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error(`Payment not found: ${paymentId}`);
  if (!["PENDING", "OVERDUE"].includes(payment.status)) {
    throw new Error(`Only PENDING or OVERDUE payments can be waived (current: ${payment.status})`);
  }

  paymentLogger.info("Payment waived", {
    paymentId, dealId: payment.dealId, amount: payment.amount, waivedBy, reason,
  });

  const [updated] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "CANCELLED",
        isWaived: true,
        waivedBy,
        waivedAt: new Date(),
        waivedReason: reason,
        updatedAt: new Date(),
      },
    }),
    prisma.paymentAuditLog.create({
      data: { paymentId, action: "WAIVED", changedBy: waivedBy, reason },
    }),
  ]);

  return updated;
}

/**
 * Add a custom payment milestone directly to an existing deal.
 * Creates a CUSTOM Payment row not tied to any plan milestone.
 */
export async function addCustomMilestone(
  dealId: string,
  data: { label: string; amount: number; dueDate: Date; notes?: string },
  createdBy: string
) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { payments: { select: { sortOrder: true } } },
  });
  if (!deal) throw new Error(`Deal not found: ${dealId}`);
  if (["COMPLETED", "CANCELLED"].includes(deal.stage)) {
    throw new Error(`Cannot add milestones to a ${deal.stage} deal`);
  }

  const maxSort = deal.payments.reduce((max, p) => Math.max(max, p.sortOrder ?? 0), 0);

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        dealId,
        milestoneLabel: data.label,
        amount: data.amount,
        originalAmount: data.amount,
        percentage: 0,
        dueDate: data.dueDate,
        status: "PENDING",
        milestoneType: "CUSTOM",
        sortOrder: maxSort + 1,
        notes: data.notes ?? null,
      },
    });
    await tx.paymentAuditLog.create({
      data: {
        paymentId: created.id,
        action: "CUSTOM_MILESTONE_ADDED",
        changedBy: createdBy,
        reason: `Custom milestone "${data.label}" added for AED ${data.amount}`,
      },
    });
    return created;
  });

  return payment;
}

/**
 * Shift all future (PENDING/OVERDUE) payment due dates for a deal by N days.
 * Used for construction delays or handover date changes.
 */
export async function restructureSchedule(
  dealId: string,
  shiftDays: number,
  reason: string,
  changedBy: string
): Promise<{ shifted: number }> {
  if (shiftDays === 0) throw new Error("shiftDays must be non-zero");

  const payments = await prisma.payment.findMany({
    where: {
      dealId,
      status: { in: ["PENDING", "OVERDUE"] },
      isWaived: false,
    },
  });

  if (payments.length === 0) return { shifted: 0 };

  await prisma.$transaction(
    payments.flatMap((p) => {
      const newDate = new Date(p.dueDate);
      newDate.setDate(newDate.getDate() + shiftDays);
      return [
        prisma.payment.update({
          where: { id: p.id },
          data: { dueDate: newDate, updatedAt: new Date() },
        }),
        prisma.paymentAuditLog.create({
          data: {
            paymentId: p.id,
            action: "SCHEDULE_RESTRUCTURED",
            changedBy,
            reason: `${reason} — shifted ${shiftDays > 0 ? "+" : ""}${shiftDays} days`,
          },
        }),
      ];
    })
  );

  return { shifted: payments.length };
}

/**
 * Recalculate all non-PAID payment amounts for a deal after a sale price change.
 * PAID and CANCELLED payments are left untouched.
 * Returns a count of updated and skipped payments.
 */
export async function recalculateDealPayments(
  dealId: string,
  newSalePrice: number,
  reason: string,
  changedBy: string
): Promise<RecalculateResult> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      payments: true,
      paymentPlan: { include: { milestones: true } },
    },
  });

  if (!deal) {
    throw new Error(`Deal not found: ${dealId}`);
  }

  const newDldFee = newSalePrice * 0.04;
  const newAdminFee = deal.adminFee; // admin fee is fixed, not recalculated

  // Build a label → milestone map for quick lookup
  const milestoneMap = new Map(
    deal.paymentPlan.milestones.map((m) => [m.label, m])
  );

  let updated = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const payment of deal.payments) {
      if (payment.status === "PAID" || payment.status === "CANCELLED") {
        skipped++;
        continue;
      }

      const milestone = milestoneMap.get(payment.milestoneLabel);
      if (!milestone) {
        skipped++;
        continue;
      }

      let newAmount: number;
      if (milestone.isDLDFee) {
        newAmount = newDldFee;
      } else if (milestone.isAdminFee) {
        newAmount = newAdminFee;
      } else {
        newAmount = (milestone.percentage / 100) * newSalePrice;
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          adjustedAmount: newAmount,
          updatedAt: new Date(),
        },
      });

      await tx.paymentAuditLog.create({
        data: {
          paymentId: payment.id,
          action: "AMOUNT_ADJUSTED",
          changedBy,
          reason: `${reason} — new sale price: ${newSalePrice}`,
        },
      });

      updated++;
    }
  });

  return { updated, skipped };
}

/**
 * Apply a batch of payment-marking rows from a bulk-import file.
 *
 * Pure: takes already-parsed rows (no req/res, no multer). Each row is
 * processed independently; one bad row does not abort the others. Per-row
 * dispatch:
 *   - amount === payment.amount → markPaymentPaid
 *   - amount  <  payment.amount → recordPartialPayment
 *   - amount  >  payment.amount → reject with AMOUNT_EXCEEDS_BALANCE
 *
 * Auditing: markPaymentPaid / recordPartialPayment already write
 * PaymentAuditLog entries, so this function does not duplicate them.
 *
 * Resolution rules:
 *   - If paymentId is set, that wins.
 *   - Otherwise resolve via { deal.dealNumber, milestoneLabel }. If multiple
 *     payments share the same milestoneLabel on a deal, the lowest sortOrder
 *     wins (stable across reruns).
 */
export async function bulkApplyPayments(
  rows: BulkPaymentInputRow[],
  userId: string
): Promise<BulkPaymentResult> {
  const successes: BulkPaymentRowSuccess[] = [];
  const errors: BulkPaymentRowError[] = [];

  for (const row of rows) {
    try {
      // ---- 1. Resolve to a Payment ----
      let payment: Awaited<ReturnType<typeof prisma.payment.findUnique>> | null = null;

      if (row.paymentId) {
        payment = await prisma.payment.findUnique({ where: { id: row.paymentId } });
        if (!payment) {
          errors.push({
            row: row.row,
            reason: "PAYMENT_NOT_FOUND",
            paymentId: row.paymentId,
            dealNumber: row.dealNumber,
            milestoneLabel: row.milestoneLabel,
          });
          continue;
        }
      } else if (row.dealNumber && row.milestoneLabel) {
        const deal = await prisma.deal.findUnique({
          where: { dealNumber: row.dealNumber },
          select: { id: true },
        });
        if (!deal) {
          errors.push({
            row: row.row,
            reason: "DEAL_NOT_FOUND",
            dealNumber: row.dealNumber,
            milestoneLabel: row.milestoneLabel,
          });
          continue;
        }
        const matches = await prisma.payment.findMany({
          where: { dealId: deal.id, milestoneLabel: row.milestoneLabel },
          orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }],
        });
        if (matches.length === 0) {
          errors.push({
            row: row.row,
            reason: "PAYMENT_NOT_FOUND",
            dealNumber: row.dealNumber,
            milestoneLabel: row.milestoneLabel,
          });
          continue;
        }
        payment = matches[0];
      } else {
        errors.push({
          row: row.row,
          reason: "MISSING_IDENTIFIER",
          dealNumber: row.dealNumber,
          milestoneLabel: row.milestoneLabel,
        });
        continue;
      }

      // ---- 2. Pre-flight checks ----
      const targetAmount = payment.adjustedAmount ?? payment.amount;
      const epsilon = 0.005; // tolerate sub-cent floating-point drift

      if (row.amount > targetAmount + epsilon) {
        errors.push({
          row: row.row,
          reason: "AMOUNT_EXCEEDS_BALANCE",
          paymentId: payment.id,
          dealNumber: row.dealNumber,
          milestoneLabel: row.milestoneLabel,
        });
        continue;
      }

      // ---- 3. Dispatch ----
      if (Math.abs(row.amount - targetAmount) <= epsilon) {
        await markPaymentPaid(payment.id, {
          paidDate: row.paidDate,
          paymentMethod: row.paymentMethod,
          paidBy: userId,
          receiptKey: row.receiptKey,
          notes: row.notes,
        });
        successes.push({
          row: row.row,
          paymentId: payment.id,
          dealNumber: row.dealNumber,
          milestoneLabel: row.milestoneLabel,
          action: "MARKED_PAID",
        });
      } else {
        await recordPartialPayment(payment.id, {
          amount: row.amount,
          paidDate: row.paidDate,
          paymentMethod: row.paymentMethod,
          paidBy: userId,
          receiptKey: row.receiptKey,
          notes: row.notes,
        });
        successes.push({
          row: row.row,
          paymentId: payment.id,
          dealNumber: row.dealNumber,
          milestoneLabel: row.milestoneLabel,
          action: "PARTIAL_RECORDED",
        });
      }
    } catch (err: any) {
      errors.push({
        row: row.row,
        reason: err?.message || "UNKNOWN_ERROR",
        paymentId: row.paymentId,
        dealNumber: row.dealNumber,
        milestoneLabel: row.milestoneLabel,
      });
    }
  }

  return {
    totalRows: rows.length,
    successCount: successes.length,
    errorCount: errors.length,
    successes,
    errors,
  };
}
