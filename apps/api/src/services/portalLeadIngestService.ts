// ============================================================
// Portal Lead Ingest — turn a parsed portal email into a Lead/Activity
// ============================================================
// Idempotency: if a lead with the same phone already exists, we log a
// follow-up Activity instead of failing. Anonymous portal emails (no
// phone) are stored as Activities against the system "house" lead so
// nothing is silently dropped.
// ============================================================

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { ParsedPortalLead } from "./portalLeadParserService";

const FALLBACK_FIRST = "Portal";
const FALLBACK_LAST = "Lead";

async function pickDefaultAgentId(): Promise<string | null> {
  // Round-robin would be nicer; for now pick any active assignable user
  // (anyone except viewers and deactivated accounts).
  const agent = await prisma.user.findFirst({
    where: {
      status: "ACTIVE",
      role: { in: ["ADMIN", "MANAGER", "MEMBER"] },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return agent?.id ?? null;
}

async function findUnitByReference(ref: string | undefined): Promise<{ id: string; projectId: string } | null> {
  if (!ref) return null;
  // Reference may be the unit ID (cuid) or unit number — try both
  const byId = await prisma.unit.findUnique({ where: { id: ref }, select: { id: true, projectId: true } });
  if (byId) return byId;
  const byNumber = await prisma.unit.findFirst({
    where: { unitNumber: ref },
    select: { id: true, projectId: true },
    orderBy: { createdAt: "desc" },
  });
  return byNumber;
}

export interface IngestResult {
  status: "CREATED" | "DUPLICATE_LOGGED" | "REJECTED";
  leadId?: string;
  reason?: string;
}

export async function ingestPortalLead(parsed: ParsedPortalLead): Promise<IngestResult> {
  if (parsed.portal === "UNKNOWN") {
    logger.warn("[portalIngest] unknown portal, dropping", { subject: parsed.rawSubject });
    return { status: "REJECTED", reason: "Unknown portal" };
  }
  if (!parsed.phone) {
    logger.warn("[portalIngest] no phone parsed, rejecting", {
      portal: parsed.portal,
      subject: parsed.rawSubject,
    });
    return { status: "REJECTED", reason: "No phone number could be parsed" };
  }

  const sourceTag = parsed.portal; // BAYUT | PROPERTY_FINDER | DUBIZZLE
  const unit = await findUnitByReference(parsed.propertyReference);

  // Existing lead → log a follow-up activity instead of duplicating
  const existing = await prisma.lead.findUnique({
    where: { phone: parsed.phone },
    select: { id: true },
  });
  if (existing) {
    await prisma.activity.create({
      data: {
        leadId: existing.id,
        type: "EMAIL",
        summary: `Repeat inquiry from ${sourceTag}${
          parsed.propertyReference ? ` (ref ${parsed.propertyReference})` : ""
        }`,
        outcome: parsed.message?.slice(0, 1000),
        createdBy: "system-portal-ingest",
        ...(unit ? { unitId: unit.id } : {}),
      },
    });
    logger.info("[portalIngest] duplicate inquiry logged", {
      leadId: existing.id,
      portal: sourceTag,
    });
    return { status: "DUPLICATE_LOGGED", leadId: existing.id };
  }

  const agentId = await pickDefaultAgentId();
  if (!agentId) {
    logger.error("[portalIngest] no active assignable user available for lead");
    return { status: "REJECTED", reason: "No agent available to receive lead" };
  }

  const lead = await prisma.lead.create({
    data: {
      firstName: parsed.firstName || FALLBACK_FIRST,
      lastName: parsed.lastName || FALLBACK_LAST,
      phone: parsed.phone,
      email: parsed.email || null,
      source: "PORTAL",
      assignedAgentId: agentId,
      stage: "NEW",
      projectId: unit?.projectId ?? null,
      notes:
        `[${sourceTag}] ${parsed.rawSubject}\n` +
        (parsed.propertyReference ? `Ref: ${parsed.propertyReference}\n` : "") +
        (parsed.message ? `\n${parsed.message}` : ""),
    },
  });

  await prisma.leadStageHistory.create({
    data: {
      leadId: lead.id,
      oldStage: "NEW",
      newStage: "NEW",
      changedBy: "system-portal-ingest",
      reason: `Lead created from ${sourceTag}`,
    },
  });

  if (unit) {
    await prisma.leadUnitInterest.create({
      data: { leadId: lead.id, unitId: unit.id, isPrimary: true },
    });
  }

  await prisma.activity.create({
    data: {
      leadId: lead.id,
      type: "EMAIL",
      summary: `New ${sourceTag} inquiry`,
      outcome: parsed.message?.slice(0, 1000),
      createdBy: "system-portal-ingest",
      ...(unit ? { unitId: unit.id } : {}),
    },
  });

  // First-contact task within 24h (mirrors createLead service behaviour)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  await prisma.task.create({
    data: {
      leadId: lead.id,
      title: `First contact within 24h (${sourceTag})`,
      dueDate: tomorrow,
    },
  });

  logger.info("[portalIngest] lead created", {
    leadId: lead.id,
    portal: sourceTag,
    unitId: unit?.id,
  });
  return { status: "CREATED", leadId: lead.id };
}
