import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

/**
 * Auto-task generation on deal stage transitions — closes audit gap #8.
 *
 * For each interesting transition, creates a follow-up Task assigned to the
 * lead's owning agent (falls back to deal-creator) with a due date suited to
 * the action. Idempotent: skips if a matching task already exists for this
 * (dealId, taskTitle) pair so cron retries / duplicate event delivery don't
 * pile up tasks.
 *
 * The transitions worth a task are stage moves where a real-world action is
 * required from the agent — confirming a reservation, chasing the SPA
 * signature, registering Oqood, etc. Pure status flips that don't need
 * follow-up (e.g. INSTALLMENTS_ACTIVE → COMPLETED) are skipped.
 */

interface TaskSpec {
  title: string;
  type: "CALL" | "MEETING" | "FOLLOW_UP" | "DOCUMENT" | "PAYMENT";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  daysFromNow: number;
}

// Map of newStage → TaskSpec. Only listed stages generate auto-tasks.
const STAGE_TASK_MAP: Partial<Record<string, TaskSpec>> = {
  RESERVATION_CONFIRMED: {
    title: "Confirm reservation receipt with buyer & schedule SPA review",
    type: "FOLLOW_UP",
    priority: "HIGH",
    daysFromNow: 1,
  },
  SPA_PENDING: {
    title: "Send SPA draft to buyer",
    type: "DOCUMENT",
    priority: "HIGH",
    daysFromNow: 1,
  },
  SPA_SENT: {
    title: "Follow up on SPA signature",
    type: "FOLLOW_UP",
    priority: "HIGH",
    daysFromNow: 3,
  },
  SPA_SIGNED: {
    title: "Coordinate Oqood registration",
    type: "DOCUMENT",
    priority: "HIGH",
    daysFromNow: 7,
  },
  OQOOD_PENDING: {
    title: "Chase Oqood registration with developer",
    type: "FOLLOW_UP",
    priority: "URGENT",
    daysFromNow: 5,
  },
  OQOOD_REGISTERED: {
    title: "Confirm Oqood doc on file & set up payment plan with buyer",
    type: "PAYMENT",
    priority: "MEDIUM",
    daysFromNow: 3,
  },
  HANDOVER_PENDING: {
    title: "Schedule handover walkthrough with buyer",
    type: "MEETING",
    priority: "HIGH",
    daysFromNow: 7,
  },
};

export async function generateAutoTaskForStage(
  dealId: string,
  newStage: string,
  systemUserId: string = "system"
): Promise<{ created: boolean; taskId?: string; reason?: string }> {
  const spec = STAGE_TASK_MAP[newStage];
  if (!spec) return { created: false, reason: `no auto-task for stage ${newStage}` };

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      leadId: true,
      dealNumber: true,
      lead: { select: { assignedAgentId: true } },
    },
  });
  if (!deal) return { created: false, reason: "deal not found" };

  const assignedToId = deal.lead?.assignedAgentId ?? null;

  // Idempotency: skip if there's already an open Task for this deal +
  // matching title that hasn't been completed.
  const existing = await prisma.task.findFirst({
    where: {
      dealId,
      title: spec.title,
      completedAt: null,
    },
    select: { id: true },
  });
  if (existing) {
    return { created: false, reason: "already exists", taskId: existing.id };
  }

  const dueDate = new Date(Date.now() + spec.daysFromNow * 24 * 60 * 60 * 1000);

  const task = await prisma.task.create({
    data: {
      title: spec.title,
      type: spec.type as any,
      priority: spec.priority as any,
      leadId: deal.leadId,
      dealId,
      assignedToId,
      dueDate,
      notes: `Auto-generated when ${deal.dealNumber} entered stage ${newStage}.`,
    },
  });

  logger.info("[autoTask] created", {
    dealId,
    dealNumber: deal.dealNumber,
    newStage,
    taskId: task.id,
    title: spec.title,
    assignedToId,
  });

  return { created: true, taskId: task.id };
}
