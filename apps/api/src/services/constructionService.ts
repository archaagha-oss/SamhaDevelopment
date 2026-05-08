import type { ConstructionStage } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { eventBus } from "../events/eventBus";

export interface ConstructionMilestoneInput {
  projectId: string;
  phaseId?: string | null;
  stage: ConstructionStage;
  label: string;
  description?: string | null;
  percentComplete?: number;
  certificateKey?: string | null;
  consultantName?: string | null;
  expectedDate?: Date | string | null;
  achievedDate?: Date | string | null;
}

export async function createMilestone(input: ConstructionMilestoneInput) {
  return prisma.constructionMilestone.create({
    data: {
      projectId: input.projectId,
      phaseId: input.phaseId ?? null,
      stage: input.stage,
      label: input.label,
      description: input.description ?? null,
      percentComplete: input.percentComplete ?? 0,
      certificateKey: input.certificateKey ?? null,
      consultantName: input.consultantName ?? null,
      expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
      achievedDate: input.achievedDate ? new Date(input.achievedDate) : null,
    },
  });
}

export async function listMilestonesForProject(projectId: string) {
  return prisma.constructionMilestone.findMany({
    where: { projectId },
    orderBy: [{ phaseId: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * Update a milestone's percent complete and (if it crossed a threshold) fire
 * payment due-dates for any PaymentPlanMilestone with triggerType=ON_CONSTRUCTION_PCT.
 *
 * Match logic:
 *   - We look at all *active* deals whose unit lives in the milestone's phase
 *     (or any deal in the project if the milestone is project-scoped).
 *   - For each such deal, find Payments with scheduleTrigger=ON_CONSTRUCTION_PCT
 *     and triggerConstructionPct <= newPercent.
 *   - Set their dueDate=today and mark constructionMilestoneId.
 */
export async function updateMilestonePercent(
  milestoneId: string,
  newPercent: number,
  changedBy: string,
) {
  if (newPercent < 0 || newPercent > 100) {
    throw new Error("percentComplete must be between 0 and 100");
  }

  const milestone = await prisma.constructionMilestone.findUnique({
    where: { id: milestoneId },
  });
  if (!milestone) throw new Error(`Construction milestone not found: ${milestoneId}`);

  const oldPercent = milestone.percentComplete;
  const updated = await prisma.constructionMilestone.update({
    where: { id: milestoneId },
    data: {
      percentComplete: newPercent,
      achievedDate: newPercent >= 100 ? new Date() : milestone.achievedDate,
    },
  });

  // Find candidate payments to fire
  const triggered = await fireConstructionTriggers(
    milestone.projectId,
    milestone.phaseId,
    newPercent,
    milestoneId,
  );

  eventBus.emit({
    eventType: "CONSTRUCTION_PCT_UPDATED" as any,
    aggregateId: milestoneId,
    aggregateType: "UNIT",
    data: {
      milestoneId,
      projectId: milestone.projectId,
      phaseId: milestone.phaseId,
      oldPercent,
      newPercent,
      paymentsTriggered: triggered.length,
    },
    userId: changedBy,
    timestamp: new Date(),
  });

  return { milestone: updated, paymentsTriggered: triggered };
}

/**
 * Match payments whose triggerConstructionPct is at or below `pct` for any unit
 * inside the relevant project/phase, and set their dueDate to today.
 * Returns the list of payment IDs that were updated.
 */
async function fireConstructionTriggers(
  projectId: string,
  phaseId: string | null,
  pct: number,
  milestoneId: string,
): Promise<string[]> {
  const unitWhere: any = { projectId };
  if (phaseId) unitWhere.phaseId = phaseId;

  const candidatePayments = await prisma.payment.findMany({
    where: {
      scheduleTrigger: "ON_CONSTRUCTION_PCT",
      triggerConstructionPct: { not: null, lte: pct },
      status: { in: ["PENDING", "OVERDUE"] },
      deal: { isActive: true, unit: unitWhere },
    },
    select: { id: true },
  });

  if (candidatePayments.length === 0) return [];

  await prisma.payment.updateMany({
    where: { id: { in: candidatePayments.map((p) => p.id) } },
    data: {
      dueDate: new Date(),
      constructionMilestoneId: milestoneId,
    },
  });

  return candidatePayments.map((p) => p.id);
}
