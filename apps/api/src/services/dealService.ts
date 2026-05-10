/**
 * dealService.ts — Production-grade deal lifecycle management
 *
 * Unit status lifecycle:
 *   Deal created              → unit: ON_HOLD  (soft hold for reservationDays, default 7)
 *   RESERVATION_CONFIRMED     → unit: RESERVED (and lead auto-closes as CLOSED_WON)
 *   SPA_SIGNED                → unit: BOOKED
 *   OQOOD_REGISTERED          → unit: SOLD
 *   CANCELLED                 → unit: AVAILABLE
 */

import { DealStage } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { dealLogger } from "../lib/logger";
import { eventBus } from "../events/eventBus";
import {
  reserveUnit,
  bookUnit,
  sellUnit,
  releaseUnit,
  updateUnitStatus,
} from "./unitService";
import { generatePaymentSchedule } from "./paymentService";

// ---------------------------------------------------------------------------
// Stage transition machine
// ---------------------------------------------------------------------------

const VALID_DEAL_TRANSITIONS: Record<DealStage, DealStage[]> = {
  RESERVATION_PENDING:    ["RESERVATION_CONFIRMED", "CANCELLED"],
  RESERVATION_CONFIRMED:  ["SPA_PENDING",           "CANCELLED"],
  SPA_PENDING:            ["SPA_SENT",              "CANCELLED"],
  SPA_SENT:               ["SPA_SIGNED",            "CANCELLED"],
  SPA_SIGNED:             ["OQOOD_PENDING",         "CANCELLED"],
  OQOOD_PENDING:          ["OQOOD_REGISTERED",      "CANCELLED"],
  OQOOD_REGISTERED:       ["INSTALLMENTS_ACTIVE",   "CANCELLED"],
  INSTALLMENTS_ACTIVE:    ["HANDOVER_PENDING",      "CANCELLED"],
  HANDOVER_PENDING:       ["COMPLETED",             "CANCELLED"],
  COMPLETED:              [],
  CANCELLED:              [],
};

export function validateDealTransition(
  currentStage: DealStage,
  newStage: DealStage
): { valid: boolean; error?: string } {
  const allowed = VALID_DEAL_TRANSITIONS[currentStage] ?? [];
  if (!allowed.includes(newStage)) {
    return {
      valid: false,
      error: `Cannot transition from ${currentStage} to ${newStage}. Allowed: ${allowed.join(", ") || "none"}`,
    };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Deal number generator
// ---------------------------------------------------------------------------

function generateDealNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DEAL-${year}-${Date.now()}-${rand}`;
}

// ---------------------------------------------------------------------------
// createDeal
// ---------------------------------------------------------------------------

export interface CreateDealInput {
  leadId:                  string;
  unitId:                  string;
  salePrice:               number;
  discount?:               number;
  reservationAmount?:      number;
  paymentPlanId:           string;
  brokerCompanyId?:        string;
  brokerAgentId?:          string;
  reservationId?:          string;
  offerId?:                string;
  createdBy:               string;
  // per-deal financial overrides
  commissionRateOverride?: number;
  adminFeeWaived?:         boolean;
  adminFeeWaivedReason?:   string;
  adminFeeWaivedBy?:       string;
  dldPaidBy?:              "BUYER" | "DEVELOPER";
  dldWaivedReason?:        string;
  dldWaivedBy?:            string;
}

export async function createDeal(input: CreateDealInput) {
  const {
    leadId, unitId, salePrice, discount = 0, reservationAmount = 0,
    paymentPlanId, brokerCompanyId, brokerAgentId,
    reservationId, offerId, createdBy,
    commissionRateOverride, adminFeeWaived = false,
    adminFeeWaivedReason, adminFeeWaivedBy,
    dldPaidBy = "BUYER", dldWaivedReason, dldWaivedBy,
  } = input;

  return prisma.$transaction(async (tx) => {
    // ── Validate lead ──────────────────────────────────────────────────────
    const lead = await tx.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new Error("Lead not found");

    // ── Validate unit ──────────────────────────────────────────────────────
    const unit = await tx.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new Error("Unit not found");
    if (!["AVAILABLE", "RESERVED", "ON_HOLD"].includes(unit.status)) {
      throw new Error(
        `Unit must be AVAILABLE to create a deal. Current status: ${unit.status}`
      );
    }

    // ── Cross-project guard ────────────────────────────────────────────────
    // If the lead is scoped to a project (e.g. a portal lead came in for
    // Project A), the chosen unit must belong to that same project. Without
    // this check a misclick on the unit picker can create a deal that bypasses
    // project-level access controls — the deal would then live under unit's
    // project but the lead would still appear in the other project's pipeline.
    if (lead.projectId && lead.projectId !== unit.projectId) {
      throw new Error(
        `Lead is scoped to a different project than the selected unit. ` +
        `Pick a unit from the lead's project, or remove the lead's project assignment first.`
      );
    }

    // ── Validate payment plan ──────────────────────────────────────────────
    const plan = await tx.paymentPlan.findUnique({
      where: { id: paymentPlanId },
      include: { milestones: { orderBy: { sortOrder: "asc" } } },
    });
    if (!plan || !plan.isActive) {
      throw new Error("Payment plan not found or inactive");
    }

    // ── Resolve project config for fees ───────────────────────────────────
    const config = await tx.projectConfig.findUnique({
      where: { projectId: unit.projectId },
    });
    const dldPercent = config?.dldPercent ?? 4;
    const adminFee   = config?.adminFee   ?? 5000;
    const oqoodDays  = config?.oqoodDays  ?? 90;

    // ── Resolve broker commission rate ─────────────────────────────────────
    let brokerRate = 0;
    if (brokerCompanyId) {
      const brokerCo = await tx.brokerCompany.findUnique({
        where: { id: brokerCompanyId },
        select: { commissionRate: true },
      });
      brokerRate = commissionRateOverride ?? brokerCo?.commissionRate ?? 4;
    }

    // ── Calculate financials ───────────────────────────────────────────────
    const netPrice      = salePrice - discount;
    const dldFee        = netPrice * (dldPercent / 100);
    const brokerCommAmt = brokerCompanyId ? netPrice * (brokerRate / 100) : 0;

    // ── Dates ──────────────────────────────────────────────────────────────
    const reservationDate = new Date();
    const oqoodDeadline   = new Date(
      reservationDate.getTime() + oqoodDays * 24 * 60 * 60 * 1000
    );

    // ── Create deal record ─────────────────────────────────────────────────
    const dealNumber = generateDealNumber();
    const deal = await tx.deal.create({
      data: {
        dealNumber,
        leadId,
        unitId,
        isActive: true,
        stage: "RESERVATION_PENDING",
        salePrice,
        discount,
        reservationAmount,
        dldFee,
        adminFee,
        paymentPlanId,
        brokerCompanyId,
        brokerAgentId,
        reservationId,
        offerId,
        reservationDate,
        oqoodDeadline,
        commissionRateOverride: commissionRateOverride ?? null,
        adminFeeWaived,
        adminFeeWaivedReason:   adminFeeWaived ? (adminFeeWaivedReason ?? null) : null,
        adminFeeWaivedBy:       adminFeeWaived ? (adminFeeWaivedBy ?? null) : null,
        dldPaidBy,
        dldWaivedReason:        dldPaidBy === "DEVELOPER" ? (dldWaivedReason ?? null) : null,
        dldWaivedBy:            dldPaidBy === "DEVELOPER" ? (dldWaivedBy ?? null) : null,
      },
      include: {
        lead:        true,
        unit:        true,
        paymentPlan: { include: { milestones: true } },
      },
    });

    // ── Put unit ON_HOLD for the offer period (auto-expires per reservationDays) ──
    const holdDays = config?.reservationDays ?? 7;
    const holdExpiresAt = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000);
    await tx.unit.update({
      where: { id: unitId },
      data:  { status: "ON_HOLD", holdExpiresAt },
    });
    await tx.unitStatusHistory.create({
      data: {
        unitId,
        oldStatus: unit.status as any,
        newStatus: "ON_HOLD",
        changedBy: createdBy,
        reason:    `Deal ${dealNumber} created — on hold for ${holdDays} days`,
      },
    });

    // ── Generate payment schedule ──────────────────────────────────────────
    await generatePaymentSchedule(
      deal.id,
      plan.milestones as any,
      salePrice,
      dldFee,
      adminFee,
      reservationDate,
      { dldPaidBy, adminFeeWaived }
    );

    // ── Create commission (broker deals only) ──────────────────────────────
    if (brokerCompanyId) {
      await tx.commission.create({
        data: {
          dealId:         deal.id,
          brokerCompanyId,
          amount:         brokerCommAmt,
          rate:           brokerRate,
          status:         "NOT_DUE",
        },
      });
    }

    // ── Mark reservation as converted (if applicable) ─────────────────────
    if (reservationId) {
      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status:            "CONVERTED",
          convertedToDealId: deal.id,
        },
      });
    }

    // ── Log activity ───────────────────────────────────────────────────────
    await tx.activity.create({
      data: {
        leadId,
        dealId: deal.id,
        type:   "NOTE",
        summary: `Reservation created for Unit ${unit.unitNumber} — ${reservationAmount > 0 ? reservationAmount.toLocaleString() + " AED reservation amount" : "no reservation amount recorded"}`,
        createdBy,
      },
    });

    // ── Log deal creation ──────────────────────────────────────────────────
    dealLogger.info("Deal created", {
      dealId: deal.id, dealNumber, leadId, unitId,
      salePrice, discount, paymentPlanId, createdBy,
    });

    // ── Emit domain event (outside transaction, fire-and-forget) ──────────
    setImmediate(() => {
      eventBus.emit({
        eventType:     "DEAL_CREATED",
        aggregateId:   deal.id,
        aggregateType: "DEAL",
        data: {
          dealNumber,
          leadId,
          unitId,
          salePrice,
          oqoodDeadline: oqoodDeadline.toISOString(),
        },
        userId:    createdBy,
        timestamp: new Date(),
      });
    });

    return deal;
  });
}

// ---------------------------------------------------------------------------
// updateDealStage
// ---------------------------------------------------------------------------

export async function getStageRequirements(dealId: string, targetStage: DealStage) {
  const deal = await prisma.deal.findUnique({
    where:   { id: dealId },
    include: { unit: true, documents: { where: { softDeleted: false } } },
  });
  if (!deal) throw new Error("Deal not found");

  const projectId = deal.unit.projectId;

  // Load project-specific rules, fall back to global (projectId=null) for any not overridden
  const projectRules = await prisma.stageDocumentRule.findMany({
    where: { dealStage: targetStage, projectId, required: true },
  });
  const globalRules = await prisma.stageDocumentRule.findMany({
    where: { dealStage: targetStage, projectId: null, required: true },
  });

  // Project rules override global rules for same documentType
  const projectTypes = new Set(projectRules.map((r) => r.documentType));
  const effectiveRules = [
    ...projectRules,
    ...globalRules.filter((r) => !projectTypes.has(r.documentType)),
  ];

  const uploadedTypes = new Set(deal.documents.map((d: any) => d.type));

  return effectiveRules.map((rule) => ({
    dealStage:    rule.dealStage,
    documentType: rule.documentType,
    label:        rule.label,
    required:     rule.required,
    uploaded:     uploadedTypes.has(rule.documentType),
  }));
}

export async function updateDealStage(
  dealId:    string,
  newStage:  DealStage,
  changedBy: string = "system"
) {
  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.findUnique({
      where:   { id: dealId },
      include: { commission: true, unit: true, documents: { where: { softDeleted: false } } },
    });
    if (!deal) throw new Error("Deal not found");

    const validation = validateDealTransition(deal.stage, newStage);
    if (!validation.valid) throw new Error(validation.error);

    // Check required documents for the destination stage
    const requirements = await getStageRequirements(dealId, newStage);
    const missing = requirements.filter((r) => r.required && !r.uploaded);
    if (missing.length > 0) {
      const labels = missing.map((r) => r.label).join(", ");
      throw new Error(`Missing required documents to enter ${newStage}: ${labels}`);
    }

    // ── Extra data on milestone stages ────────────────────────────────────
    const stageData: Record<string, unknown> = {};

    if (newStage === "SPA_SIGNED") {
      stageData.spaSignedDate = new Date();
    }
    if (newStage === "OQOOD_REGISTERED") {
      stageData.oqoodRegisteredDate = new Date();
    }
    if (newStage === "CANCELLED") {
      stageData.isActive = false;
    }

    // ── Update deal ────────────────────────────────────────────────────────
    const updated = await tx.deal.update({
      where: { id: dealId },
      data:  { stage: newStage, ...stageData },
      include: { lead: true, unit: true },
    });

    // ── Auto-set due dates on event-triggered payments ─────────────────────
    const stageTriggerMap: Partial<Record<DealStage, string>> = {
      SPA_SIGNED:       "ON_SPA_SIGNING",
      OQOOD_REGISTERED: "ON_OQOOD",
      HANDOVER_PENDING: "ON_HANDOVER",
    };
    const eventTrigger = stageTriggerMap[newStage];
    if (eventTrigger) {
      await tx.payment.updateMany({
        where: {
          dealId,
          scheduleTrigger: eventTrigger as any,
          status: { in: ["PENDING", "OVERDUE"] },
        },
        data: { dueDate: new Date() },
      });
    }

    // ── Log stage history ──────────────────────────────────────────────────
    await tx.dealStageHistory.create({
      data: { dealId, oldStage: deal.stage, newStage, changedBy },
    });

    // ── Log stage change ──────────────────────────────────────────────────
    dealLogger.info("Deal stage changed", {
      dealId, fromStage: deal.stage, toStage: newStage, changedBy,
    });

    // ── Side effects outside transaction (unit status, commission) ─────────
    setImmediate(async () => {
      try {
        // Reservation confirmed → unit moves from ON_HOLD to RESERVED + lead closes as WON
        if (newStage === "RESERVATION_CONFIRMED") {
          await updateUnitStatus(deal.unitId, "RESERVED", changedBy, `Deal ${deal.dealNumber} reservation confirmed`);
          const lead = await prisma.lead.findUnique({ where: { id: deal.leadId }, select: { stage: true } });
          if (lead && lead.stage !== "CLOSED_WON") {
            await prisma.lead.update({
              where: { id: deal.leadId },
              data: { stage: "CLOSED_WON" },
            });
            await prisma.leadStageHistory.create({
              data: {
                leadId:    deal.leadId,
                oldStage:  lead.stage as any,
                newStage:  "CLOSED_WON",
                changedBy,
                reason:    `Deal ${deal.dealNumber} reservation confirmed — unit secured`,
              },
            });
          }
        }

        // SPA signed → unit becomes BOOKED
        if (newStage === "SPA_SIGNED") {
          await bookUnit(deal.unitId, changedBy);
          await tryUnlockCommission(dealId);
          eventBus.emit({
            eventType: "SPA_SIGNED", aggregateId: dealId,
            aggregateType: "DEAL", data: { dealId }, userId: changedBy, timestamp: new Date(),
          });
        }

        // Oqood registered → unit becomes SOLD
        if (newStage === "OQOOD_REGISTERED") {
          await sellUnit(deal.unitId, changedBy);
          await tryUnlockCommission(dealId);
          eventBus.emit({
            eventType: "OQOOD_REGISTERED", aggregateId: dealId,
            aggregateType: "DEAL", data: { dealId }, userId: changedBy, timestamp: new Date(),
          });
        }

        // Cancelled → release unit + forfeit commission + maybe close lead
        if (newStage === "CANCELLED") {
          await releaseUnit(deal.unitId, changedBy, `Deal ${deal.dealNumber} cancelled`);
          if (deal.commission && !["PAID", "FORFEITED"].includes(deal.commission.status)) {
            await prisma.commission.update({
              where: { id: deal.commission.id },
              data: { status: "FORFEITED" },
            });
          }

          // Auto-close lead as CLOSED_LOST if no other active deals remain
          const otherActiveDeals = await prisma.deal.count({
            where: { leadId: deal.leadId, isActive: true, id: { not: dealId } },
          });
          if (otherActiveDeals === 0) {
            const lead = await prisma.lead.findUnique({ where: { id: deal.leadId }, select: { stage: true } });
            if (lead && !["CLOSED_WON", "CLOSED_LOST"].includes(lead.stage)) {
              await prisma.lead.update({
                where: { id: deal.leadId },
                data: { stage: "CLOSED_LOST" },
              });
              await prisma.leadStageHistory.create({
                data: {
                  leadId:    deal.leadId,
                  oldStage:  lead.stage as any,
                  newStage:  "CLOSED_LOST",
                  changedBy,
                  reason:    `Deal ${deal.dealNumber} cancelled`,
                },
              });
            }
          }

          eventBus.emit({
            eventType: "DEAL_CANCELLED", aggregateId: dealId,
            aggregateType: "DEAL", data: { dealId, unitId: deal.unitId }, userId: changedBy, timestamp: new Date(),
          });
        }

        // Completed → close lead as CLOSED_WON
        if (newStage === "COMPLETED") {
          const lead = await prisma.lead.findUnique({ where: { id: deal.leadId }, select: { stage: true } });
          if (lead && lead.stage !== "CLOSED_WON") {
            await prisma.lead.update({
              where: { id: deal.leadId },
              data: { stage: "CLOSED_WON" },
            });
            await prisma.leadStageHistory.create({
              data: {
                leadId:    deal.leadId,
                oldStage:  lead.stage as any,
                newStage:  "CLOSED_WON",
                changedBy,
                reason:    `Deal ${deal.dealNumber} completed`,
              },
            });
          }
        }

        // Auto-create tasks for key stages
        const stageTasks: Record<string, { title: string; type: string; priority: string }> = {
          SPA_PENDING:          { title: "Prepare and send SPA to buyer",      type: "DOCUMENT", priority: "HIGH" },
          SPA_SIGNED:           { title: "Upload signed SPA to system",        type: "DOCUMENT", priority: "HIGH" },
          OQOOD_PENDING:        { title: "Submit Oqood registration",          type: "DOCUMENT", priority: "URGENT" },
          INSTALLMENTS_ACTIVE:  { title: "Follow up on next payment due",      type: "PAYMENT",  priority: "MEDIUM" },
        };
        const taskDef = stageTasks[newStage];
        if (taskDef) {
          const fullDeal = await prisma.deal.findUnique({
            where: { id: dealId },
            include: { lead: { select: { assignedAgentId: true } } },
          });
          const agentId = fullDeal?.lead?.assignedAgentId ?? null;
          await prisma.task.create({
            data: {
              title:       taskDef.title,
              type:        taskDef.type as any,
              priority:    taskDef.priority as any,
              status:      "PENDING",
              dealId,
              leadId:      fullDeal?.leadId ?? null,
              assignedToId: agentId,
              dueDate:     new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
            },
          });
        }

        // General stage change event
        eventBus.emit({
          eventType: "DEAL_STAGE_CHANGED", aggregateId: dealId,
          aggregateType: "DEAL",
          data: { oldStage: deal.stage, newStage },
          userId: changedBy, timestamp: new Date(),
        });
      } catch (err) {
        dealLogger.error("Post-stage side effect error", { dealId, newStage, err });
      }
    });

    return updated;
  });
}

// ---------------------------------------------------------------------------
// tryUnlockCommission
// ---------------------------------------------------------------------------

export async function tryUnlockCommission(dealId: string) {
  const deal = await prisma.deal.findUnique({
    where:   { id: dealId },
    include: { commission: true },
  });
  if (!deal?.commission) return null;
  if (deal.commission.status !== "NOT_DUE") return deal.commission;

  // Both conditions must be met before moving to PENDING_APPROVAL
  if (deal.spaSignedDate && deal.oqoodRegisteredDate) {
    const unlocked = await prisma.commission.update({
      where: { id: deal.commission.id },
      data: {
        status:      "PENDING_APPROVAL",
        spaSignedMet: true,
        oqoodMet:    true,
      },
    });

    eventBus.emit({
      eventType: "COMMISSION_UNLOCKED", aggregateId: unlocked.id,
      aggregateType: "COMMISSION",
      data: { dealId, amount: unlocked.amount },
      timestamp: new Date(),
    });

    return unlocked;
  }
  return deal.commission;
}

// ---------------------------------------------------------------------------
// markPaymentPaid
// ---------------------------------------------------------------------------

export async function markPaymentPaid(
  paymentId: string,
  paidDate: Date,
  paymentMethod: string,
  paidBy: string
) {
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "PAID",
      paidDate,
      paymentMethod,
      paidBy,
    },
  });

  // Emit event for payment received
  eventBus.emit({
    eventType: "PAYMENT_RECEIVED",
    aggregateId: paymentId,
    aggregateType: "PAYMENT",
    data: { amount: payment.amount, dealId: payment.dealId },
    timestamp: new Date(),
  });

  return payment;
}
