import { LeadStage } from "@prisma/client";
import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// Lead stage transition machine
// ---------------------------------------------------------------------------

const VALID_LEAD_TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  NEW:          ["CONTACTED", "QUALIFIED", "CLOSED_LOST"],
  CONTACTED:    ["QUALIFIED", "OFFER_SENT", "SITE_VISIT", "NEGOTIATING", "CLOSED_LOST"],
  QUALIFIED:    ["OFFER_SENT", "SITE_VISIT", "NEGOTIATING", "CLOSED_LOST"],
  OFFER_SENT:   ["SITE_VISIT", "NEGOTIATING", "CLOSED_LOST"],
  SITE_VISIT:   ["OFFER_SENT", "NEGOTIATING", "CLOSED_LOST"],
  NEGOTIATING:  ["CLOSED_WON", "CLOSED_LOST"],
  CLOSED_WON:   ["NEGOTIATING"],   // re-open if deal is later cancelled
  CLOSED_LOST:  ["NEW", "CONTACTED"], // re-engage
};

export function validateLeadTransition(
  current: LeadStage,
  next: LeadStage
): { valid: boolean; error?: string } {
  const allowed = VALID_LEAD_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    return {
      valid: false,
      error: `Cannot move lead from ${current} to ${next}. Allowed: ${allowed.join(", ") || "none"}`,
    };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// updateLeadStage — enforces state machine + writes history
// ---------------------------------------------------------------------------

export async function updateLeadStage(
  leadId: string,
  newStage: LeadStage,
  changedBy: string,
  reason?: string
): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, stage: true },
  });
  if (!lead) throw new Error("Lead not found");

  const validation = validateLeadTransition(lead.stage, newStage);
  if (!validation.valid) throw new Error(validation.error);

  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId }, data: { stage: newStage } }),
    prisma.leadStageHistory.create({
      data: {
        leadId,
        oldStage: lead.stage,
        newStage,
        changedBy,
        reason: reason ?? null,
      },
    }),
  ]);
}

// ---------------------------------------------------------------------------
// createLead — validates + creates + auto-task
// ---------------------------------------------------------------------------

export interface CreateLeadInput {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  nationality?: string;
  source: string;
  brokerCompanyId?: string;
  brokerAgentId?: string;
  budget?: number;
  assignedAgentId: string;
  notes?: string;
  createdBy: string;
  // SPA / KYC fields
  address?: string | null;
  emiratesId?: string | null;
  passportNumber?: string | null;
  companyRegistrationNumber?: string | null;
  authorizedSignatory?: string | null;
  sourceOfFunds?: string | null;
}

export async function createLead(input: CreateLeadInput) {
  const existing = await prisma.lead.findUnique({ where: { phone: input.phone } });
  if (existing) {
    throw Object.assign(new Error("Lead with this phone already exists"), {
      code: "DUPLICATE_PHONE",
      existingId: existing.id,
    });
  }

  // If source is BROKER, brokerCompanyId should be provided
  if (input.source === "BROKER" && !input.brokerCompanyId) {
    throw new Error("Broker source requires a broker company to be selected");
  }

  const lead = await prisma.lead.create({
    data: {
      firstName:       input.firstName,
      lastName:        input.lastName,
      phone:           input.phone,
      email:           input.email ?? null,
      nationality:     input.nationality ?? null,
      source:          input.source,
      brokerCompanyId: input.brokerCompanyId ?? null,
      brokerAgentId:   input.brokerAgentId ?? null,
      budget:          input.budget ?? null,
      assignedAgentId: input.assignedAgentId,
      notes:           input.notes ?? null,
      stage:           "NEW",
      address:                   input.address ?? null,
      emiratesId:                input.emiratesId ?? null,
      passportNumber:            input.passportNumber ?? null,
      companyRegistrationNumber: input.companyRegistrationNumber ?? null,
      authorizedSignatory:       input.authorizedSignatory ?? null,
      sourceOfFunds:             input.sourceOfFunds ?? null,
    },
    include: {
      assignedAgent: true,
      brokerCompany: true,
      brokerAgent:   true,
    },
  });

  // Initial stage history entry
  await prisma.leadStageHistory.create({
    data: {
      leadId:    lead.id,
      oldStage:  "NEW",
      newStage:  "NEW",
      changedBy: input.createdBy,
      reason:    "Lead created",
    },
  });

  // Auto-task: first contact within 24h
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  await prisma.task.create({
    data: {
      leadId:  lead.id,
      title:   "First contact within 24h",
      dueDate: tomorrow,
    },
  });

  return lead;
}
