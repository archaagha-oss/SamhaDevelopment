import type { LateFeeRule, Payment } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { eventBus } from "../events/eventBus";

/**
 * Late-fee enforcement engine.
 *
 * The DB already had `LateFeeRule` (per project) but no runner.  This
 * service is the runner.  Designed to be invoked daily from a scheduled
 * job (jobHandlers.ts).
 *
 * For each ACTIVE rule:
 *   - find Payments belonging to the rule's project
 *   - status PENDING / OVERDUE / PARTIAL
 *   - dueDate older than (today - triggerAfterDays)
 * For each match, compute the fee per rule.feeType:
 *   - PERCENTAGE_PER_DAY:   amount * (feeAmount/100) * daysLate
 *   - FIXED_ONE_TIME:       feeAmount (only if not yet applied)
 *   - PERCENTAGE_PER_MONTH: amount * (feeAmount/100) * monthsLate
 * Cap at maxFeeAmount when set.
 *
 * Each application:
 *   - increases `Payment.lateFeeApplied`
 *   - bumps `Payment.adjustedAmount` so the dunning total reflects the fee
 *   - writes a `PaymentAuditLog` row (action="LATE_FEE_APPLIED")
 *   - emits `LATE_FEE_APPLIED` domain event
 *
 * The runner is idempotent for FIXED_ONE_TIME and incremental for the
 * percentage variants — re-running on the same day will not double-charge.
 */
export async function runLateFeeEngine(now = new Date()): Promise<{
  rulesEvaluated: number;
  paymentsUpdated: number;
  totalFeesApplied: number;
}> {
  const activeRules = await prisma.lateFeeRule.findMany({
    where: { isActive: true },
  });

  let paymentsUpdated = 0;
  let totalFeesApplied = 0;

  for (const rule of activeRules) {
    const cutoff = new Date(now.getTime() - rule.triggerAfterDays * 24 * 60 * 60 * 1000);
    const candidates = await prisma.payment.findMany({
      where: {
        deal: { unit: { projectId: rule.projectId }, isActive: true },
        status: { in: ["PENDING", "OVERDUE", "PARTIAL"] },
        dueDate: { lt: cutoff },
      },
    });

    for (const p of candidates) {
      const fee = computeFee(rule, p, now);
      if (fee <= 0) continue;

      // Cap at maxFeeAmount
      const newCumulativeFee = +(p.lateFeeApplied + fee).toFixed(2);
      const cappedNewFee = rule.maxFeeAmount != null && newCumulativeFee > rule.maxFeeAmount
        ? +Math.max(0, rule.maxFeeAmount - p.lateFeeApplied).toFixed(2)
        : fee;
      if (cappedNewFee <= 0) continue;

      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: p.id },
          data: {
            lateFeeApplied: { increment: cappedNewFee },
            adjustedAmount: +(p.amount + p.lateFeeApplied + cappedNewFee).toFixed(2),
            adjustmentReason: `Late fee applied per rule ${rule.name}`,
            lateFeeLastAppliedAt: now,
            // Move to OVERDUE if currently PENDING
            status: p.status === "PENDING" ? "OVERDUE" : p.status,
          },
        });
        await tx.paymentAuditLog.create({
          data: {
            paymentId: p.id,
            action: "LATE_FEE_APPLIED",
            reason: `Rule ${rule.name}: +${cappedNewFee.toFixed(2)}`,
            changedBy: "system:lateFeeService",
          },
        });
      });

      eventBus.emit({
        eventType: "LATE_FEE_APPLIED" as any,
        aggregateId: p.id,
        aggregateType: "PAYMENT",
        data: { paymentId: p.id, ruleId: rule.id, fee: cappedNewFee },
        timestamp: now,
      });

      paymentsUpdated++;
      totalFeesApplied += cappedNewFee;
    }
  }

  return {
    rulesEvaluated: activeRules.length,
    paymentsUpdated,
    totalFeesApplied: +totalFeesApplied.toFixed(2),
  };
}

function computeFee(rule: LateFeeRule, p: Payment, now: Date): number {
  const dueMs = new Date(p.dueDate).getTime();
  const daysLate = Math.max(0, Math.floor((now.getTime() - dueMs) / (24 * 60 * 60 * 1000)));
  if (daysLate <= rule.triggerAfterDays) return 0;

  const overdueDays = daysLate - rule.triggerAfterDays;

  switch (rule.feeType) {
    case "PERCENTAGE_PER_DAY": {
      // Idempotent-by-day: only charge for days since last application
      const lastAppliedAt = p.lateFeeLastAppliedAt;
      const fromDay = lastAppliedAt
        ? Math.floor((lastAppliedAt.getTime() - dueMs) / (24 * 60 * 60 * 1000)) - rule.triggerAfterDays
        : 0;
      const incrementalDays = Math.max(0, overdueDays - fromDay);
      return +(p.amount * (rule.feeAmount / 100) * incrementalDays).toFixed(2);
    }
    case "FIXED_ONE_TIME": {
      // Charge once: only if no prior application
      return p.lateFeeApplied > 0 ? 0 : rule.feeAmount;
    }
    case "PERCENTAGE_PER_MONTH": {
      const lastAppliedAt = p.lateFeeLastAppliedAt;
      const fromMonths = lastAppliedAt
        ? Math.floor(
            (lastAppliedAt.getTime() - dueMs) / (30 * 24 * 60 * 60 * 1000),
          ) - Math.floor(rule.triggerAfterDays / 30)
        : 0;
      const monthsLate = Math.floor(overdueDays / 30);
      const incrementalMonths = Math.max(0, monthsLate - fromMonths);
      return +(p.amount * (rule.feeAmount / 100) * incrementalMonths).toFixed(2);
    }
    default:
      return 0;
  }
}
