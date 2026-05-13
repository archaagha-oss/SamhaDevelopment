/**
 * Lead-SLA sweep — escalates lead tasks (e.g. "first contact within 24h")
 * that have blown their dueDate without being completed.
 *
 * What it does on each run:
 *   1. Find Task rows where: status = PENDING, leadId IS NOT NULL,
 *      dueDate < now, completedDate IS NULL.
 *   2. Flip the task to OVERDUE.
 *   3. Create one LEAD_TASK_OVERDUE Notification for the assigned agent
 *      (or the lead's default agent if no per-task assignee).
 *   4. Create a second notification for the agent's manager if one is set.
 *
 * Idempotency. The task status transitions PENDING -> OVERDUE only once
 * per task (we skip rows already OVERDUE on the next sweep). Notifications
 * follow the task's status flip, so they fire exactly once per breach.
 */

import { prisma } from "../lib/prisma";

interface SweepResult {
  scanned: number;
  escalated: number;
  notificationsSent: number;
}

export async function sweepOverdueLeadTasks(): Promise<SweepResult> {
  const now = new Date();

  // Pull only the columns we need; joins kept narrow.
  const breaches = await prisma.task.findMany({
    where: {
      status:    "PENDING",
      dueDate:   { lt: now },
      leadId:    { not: null },
      completedAt: null,
    },
    select: {
      id:           true,
      title:        true,
      dueDate:      true,
      assignedToId: true,
      leadId:       true,
      lead: {
        select: {
          firstName:       true,
          lastName:        true,
          assignedAgentId: true,
          assignedAgent:   { select: { managerId: true } },
        },
      },
    },
  });

  let notificationsSent = 0;

  for (const t of breaches) {
    const agentId   = t.assignedToId ?? t.lead?.assignedAgentId ?? null;
    const managerId = t.lead?.assignedAgent?.managerId ?? null;
    const leadName  = t.lead ? `${t.lead.firstName} ${t.lead.lastName}`.trim() : "lead";
    const hoursLate = Math.floor((now.getTime() - t.dueDate.getTime()) / 3_600_000);
    const message   = `Overdue task on ${leadName}: "${t.title}" (${hoursLate}h late)`;

    await prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id: t.id }, data: { status: "OVERDUE" } });

      if (agentId) {
        await tx.notification.create({
          data: {
            userId:     agentId,
            message,
            leadId:     t.leadId ?? undefined,
            type:       "LEAD_TASK_OVERDUE",
            entityId:   t.id,
            entityType: "TASK",
            priority:   hoursLate >= 24 ? "HIGH" : "NORMAL",
          },
        });
        notificationsSent++;
      }
      if (managerId && managerId !== agentId) {
        await tx.notification.create({
          data: {
            userId:     managerId,
            message:    `[Escalation] ${message}`,
            leadId:     t.leadId ?? undefined,
            type:       "LEAD_TASK_OVERDUE",
            entityId:   t.id,
            entityType: "TASK",
            priority:   "HIGH",
          },
        });
        notificationsSent++;
      }
    });
  }

  return {
    scanned: breaches.length,
    escalated: breaches.length,
    notificationsSent,
  };
}
