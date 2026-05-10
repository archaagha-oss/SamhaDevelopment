import { LeadStage } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { eventBus, type DomainEventPayload } from "../eventBus.js";
import { scheduleJob } from "../jobs/jobHandlers.js";
import { generateAutoTaskForStage } from "../../services/autoTaskService.js";

// ---------------------------------------------------------------------------
// Helper: log an activity on a lead (fire-and-forget, errors are non-fatal)
// ---------------------------------------------------------------------------

async function logLeadActivity(
  leadId: string,
  summary: string,
  createdBy: string = "system"
): Promise<void> {
  try {
    await prisma.activity.create({
      data: { leadId, type: "NOTE", summary, createdBy },
    });
  } catch (err) {
    console.error("[dealHandlers] logLeadActivity error:", err);
  }
}

// ---------------------------------------------------------------------------
// Helper: sync lead stage based on deal outcome
// Rules:
//   Deal COMPLETED  → lead CLOSED_WON   (sale is won)
//   Deal CANCELLED  → lead NEGOTIATING  (if no other active deals remain)
// Both bypass the state machine intentionally — these are system-driven.
// ---------------------------------------------------------------------------

const ACTIVE_DEAL_STAGES: string[] = [
  "RESERVATION_PENDING", "RESERVATION_CONFIRMED", "SPA_PENDING",
  "SPA_SENT", "SPA_SIGNED", "OQOOD_PENDING", "OQOOD_REGISTERED",
  "INSTALLMENTS_ACTIVE", "HANDOVER_PENDING",
];

async function syncLeadOnDealCompleted(leadId: string, dealId: string): Promise<void> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, stage: true },
    });
    if (!lead || lead.stage === "CLOSED_WON") return;

    const oldStage = lead.stage;
    await prisma.lead.update({ where: { id: leadId }, data: { stage: "CLOSED_WON" } });
    await prisma.leadStageHistory.create({
      data: {
        leadId,
        oldStage: oldStage as LeadStage,
        newStage: "CLOSED_WON",
        changedBy: "system",
        reason: `Deal ${dealId} completed`,
      },
    });
  } catch (err) {
    console.error("[dealHandlers] syncLeadOnDealCompleted error:", err);
  }
}

async function syncLeadOnDealCancelled(leadId: string, dealId: string): Promise<void> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, stage: true },
    });
    if (!lead) return;

    // Only revert if lead is CLOSED_WON (was auto-won by this deal)
    // and no other active deals exist for this lead
    if (lead.stage !== "CLOSED_WON") return;

    const otherActiveDeals = await prisma.deal.count({
      where: {
        leadId,
        id: { not: dealId },
        stage: { in: ACTIVE_DEAL_STAGES as any },
      },
    });

    if (otherActiveDeals > 0) return;

    const oldStage = lead.stage;
    await prisma.lead.update({ where: { id: leadId }, data: { stage: "NEGOTIATING" } });
    await prisma.leadStageHistory.create({
      data: {
        leadId,
        oldStage: oldStage as LeadStage,
        newStage: "NEGOTIATING",
        changedBy: "system",
        reason: `Deal ${dealId} cancelled — lead re-opened`,
      },
    });
  } catch (err) {
    console.error("[dealHandlers] syncLeadOnDealCancelled error:", err);
  }
}

// ---------------------------------------------------------------------------
// DEAL_CREATED
// Responsibilities: activity log + schedule Oqood warning job.
// Does NOT touch lead stage — deal creation ≠ sale won.
// ---------------------------------------------------------------------------

export async function handleDealCreated(payload: DomainEventPayload): Promise<void> {
  const { data, aggregateId: dealId } = payload;

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { unit: true },
    });
    if (!deal) return;

    const dealNumber = (data.dealNumber as string | undefined) ?? deal.dealNumber;
    await logLeadActivity(
      deal.leadId,
      `Deal ${dealNumber} created for unit ${deal.unit.unitNumber}`,
      payload.userId ?? "system"
    );

    // Schedule Oqood deadline warning 7 days before deadline
    if (deal.oqoodDeadline) {
      const warningDate = new Date(deal.oqoodDeadline);
      warningDate.setDate(warningDate.getDate() - 7);
      if (warningDate > new Date()) {
        await scheduleJob("OQOOD_DEADLINE_WARNING", { dealId: deal.id, daysRemaining: 7 }, warningDate);
      }
    }
  } catch (err) {
    console.error("[dealHandlers] handleDealCreated error:", err);
  }
}

// ---------------------------------------------------------------------------
// DEAL_STAGE_CHANGED
// Responsibilities: activity log + lead lifecycle sync on terminal stages.
// Does NOT touch unit status or commission — dealService owns those.
// ---------------------------------------------------------------------------

export async function handleDealStageChanged(payload: DomainEventPayload): Promise<void> {
  const { data, aggregateId: dealId } = payload;
  const oldStage = data.oldStage as string | undefined;
  const newStage = data.newStage as string | undefined;
  if (!oldStage || !newStage) return;

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { leadId: true, dealNumber: true },
    });
    if (!deal) return;

    await logLeadActivity(
      deal.leadId,
      `Deal ${deal.dealNumber} moved from ${oldStage.replace(/_/g, " ")} to ${newStage.replace(/_/g, " ")}`,
      payload.userId ?? "system"
    );

    // Lead lifecycle sync — only on terminal stages
    if (newStage === "COMPLETED") {
      await syncLeadOnDealCompleted(deal.leadId, dealId);
    }

    if (newStage === "CANCELLED") {
      await syncLeadOnDealCancelled(deal.leadId, dealId);
    }

    // Auto-generate a follow-up Task on action-required transitions.
    // Best-effort — failure here must not break the stage-change pipeline.
    try {
      await generateAutoTaskForStage(dealId, newStage, payload.userId ?? "system");
    } catch (err) {
      console.error("[dealHandlers] generateAutoTaskForStage error:", err);
    }
  } catch (err) {
    console.error("[dealHandlers] handleDealStageChanged error:", err);
  }
}

// ---------------------------------------------------------------------------
// DEAL_CANCELLED
// Responsibilities: activity log only.
// Unit release + isActive flag already handled by dealService in transaction.
// ---------------------------------------------------------------------------

export async function handleDealCancelled(payload: DomainEventPayload): Promise<void> {
  const { aggregateId: dealId } = payload;
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { leadId: true, dealNumber: true },
    });
    if (!deal) return;

    await logLeadActivity(
      deal.leadId,
      `Deal ${deal.dealNumber} was cancelled`,
      payload.userId ?? "system"
    );
  } catch (err) {
    console.error("[dealHandlers] handleDealCancelled error:", err);
  }
}

// ---------------------------------------------------------------------------
// SPA_SIGNED / OQOOD_REGISTERED
// Unit status, dates, and commission unlock are all handled by dealService.
// These handlers exist only for future notification hooks.
// ---------------------------------------------------------------------------

export async function handleSpaSigned(payload: DomainEventPayload): Promise<void> {
  // Reserved for notifications. dealService handles unit BOOKED, spaSignedDate, commission.
}

export async function handleOqoodRegistered(payload: DomainEventPayload): Promise<void> {
  // Reserved for notifications. dealService handles unit SOLD, oqoodRegisteredDate, commission.
}

// ---------------------------------------------------------------------------
// Register all deal handlers on the event bus
// ---------------------------------------------------------------------------

export function registerDealHandlers(): void {
  eventBus.on("DEAL_CREATED",       handleDealCreated);
  eventBus.on("DEAL_STAGE_CHANGED", handleDealStageChanged);
  eventBus.on("DEAL_CANCELLED",     handleDealCancelled);
  eventBus.on("SPA_SIGNED",         handleSpaSigned);
  eventBus.on("OQOOD_REGISTERED",   handleOqoodRegistered);
}
