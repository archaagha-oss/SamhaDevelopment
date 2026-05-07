import { PaymentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { paymentLogger } from "../lib/logger";
import { checkStageAdvancement } from "../config/stageAdvancementRules";
import { updateDealStage } from "./dealService";

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

  // ─────────────────────────────────────────────────────────────────────────
  // CHECK FOR STAGE ADVANCEMENT based on payment milestone reached
  // ─────────────────────────────────────────────────────────────────────────
  try {
    // Fetch current deal state + all payments
    const deal = await prisma.deal.findUnique({
      where: { id: payment.dealId },
      include: { payments: { where: { status: "PAID" } } },
    });

    if (!deal) {
      paymentLogger.error("Deal not found for stage advancement check", { dealId: payment.dealId });
      return updated;
    }

    // Calculate total paid percentage (only against sale price, not fees)
    // DLD and admin fees are separate line items, not part of percentage calculation
    const totalDealValue = deal.salePrice;
    const totalPaidAmount = deal.payments.reduce((sum, p) => sum + p.amount, 0);
    const paidPercentage = (totalDealValue > 0 ? (totalPaidAmount / totalDealValue) * 100 : 0);

    paymentLogger.info("Checking stage advancement", {
      dealId: payment.dealId,
      currentStage: deal.stage,
      paidPercentage: paidPercentage.toFixed(2),
      totalPaid: totalPaidAmount,
      totalValue: totalDealValue,
    });

    // Check if we can advance the stage
    const nextStage = checkStageAdvancement(deal.stage, paidPercentage);

    if (nextStage && nextStage !== deal.stage) {
      paymentLogger.info("Auto-advancing deal stage", {
        dealId: payment.dealId,
        fromStage: deal.stage,
        toStage: nextStage,
        reason: `Payment received: ${paidPercentage.toFixed(2)}% paid`,
      });

      // Update deal stage
      await updateDealStage(payment.dealId, nextStage, data.paidBy);

      // Log activity about the auto-advancement
      await prisma.activity.create({
        data: {
          dealId: payment.dealId,
          leadId: deal.leadId,
          type: "NOTE",
          summary: `Deal auto-advanced from ${deal.stage} → ${nextStage} (${paidPercentage.toFixed(2)}% paid)`,
          createdBy: data.paidBy,
        },
      }).catch((err) => {
        paymentLogger.error("Failed to log stage advancement activity", { dealId: payment.dealId, error: err });
      });
    }
  } catch (error: any) {
    paymentLogger.error("Error during stage advancement check", {
      paymentId,
      dealId: payment.dealId,
      error: error.message,
    });
    // Don't throw — payment was already marked as paid successfully
    // Stage advancement failure shouldn't block payment recording
  }

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

  // ─────────────────────────────────────────────────────────────────────────
  // CHECK FOR STAGE ADVANCEMENT if payment just became fully paid
  // ─────────────────────────────────────────────────────────────────────────
  if (isFullyPaid) {
    try {
      // Fetch current deal state + all payments
      const deal = await prisma.deal.findUnique({
        where: { id: payment.dealId },
        include: { payments: { where: { status: "PAID" } } },
      });

      if (!deal) {
        paymentLogger.error("Deal not found for stage advancement check", { dealId: payment.dealId });
      } else {
        // Calculate total paid percentage (only against sale price, not fees)
        // DLD and admin fees are separate line items, not part of percentage calculation
        const totalDealValue = deal.salePrice;
        const totalPaidAmount = deal.payments.reduce((sum, p) => sum + p.amount, 0);
        const paidPercentage = (totalDealValue > 0 ? (totalPaidAmount / totalDealValue) * 100 : 0);

        paymentLogger.info("Checking stage advancement after partial payment", {
          dealId: payment.dealId,
          currentStage: deal.stage,
          paidPercentage: paidPercentage.toFixed(2),
          totalPaid: totalPaidAmount,
          totalValue: totalDealValue,
        });

        // Check if we can advance the stage
        const nextStage = checkStageAdvancement(deal.stage, paidPercentage);

        if (nextStage && nextStage !== deal.stage) {
          paymentLogger.info("Auto-advancing deal stage", {
            dealId: payment.dealId,
            fromStage: deal.stage,
            toStage: nextStage,
            reason: `Partial payments completed: ${paidPercentage.toFixed(2)}% paid`,
          });

          // Update deal stage
          await updateDealStage(payment.dealId, nextStage, data.paidBy);

          // Log activity about the auto-advancement
          await prisma.activity.create({
            data: {
              dealId: payment.dealId,
              leadId: deal.leadId,
              type: "NOTE",
              summary: `Deal auto-advanced from ${deal.stage} → ${nextStage} (${paidPercentage.toFixed(2)}% paid)`,
              createdBy: data.paidBy,
            },
          }).catch((err) => {
            paymentLogger.error("Failed to log stage advancement activity", { dealId: payment.dealId, error: err });
          });
        }
      }
    } catch (error: any) {
      paymentLogger.error("Error during stage advancement check after partial payment", {
        paymentId,
        dealId: payment.dealId,
        error: error.message,
      });
      // Don't throw — partial payment was already recorded successfully
    }
  }

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
 * Mark a single payment as OVERDUE if it is PENDING and its due date has passed.
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
