// ---------------------------------------------------------------------------
// taskNotifier — periodic sweep that pushes Notifications for:
//   1. Tasks due in the next 60 minutes (one-time per task).
//   2. Tasks newly overdue (one-time per task).
//
// Dedup: writes a marker activity (kind=NOTE) so we never notify twice per task.
// ---------------------------------------------------------------------------

import { prisma } from "../../lib/prisma.js";

const HOUR = 60 * 60 * 1000;

async function alreadyNotified(taskId: string, marker: string): Promise<boolean> {
  const found = await prisma.activity.findFirst({
    where: {
      relatedTaskId: taskId,
      systemGenerated: true,
      summary: { contains: marker },
    },
    select: { id: true },
  });
  return !!found;
}

async function recordMarker(task: { id: string; leadId: string | null; dealId: string | null }, summary: string): Promise<void> {
  // Markers only stick to entities that exist — fall back to leadId, then dealId.
  if (!task.leadId && !task.dealId) return;
  await prisma.activity.create({
    data: {
      relatedTaskId: task.id,
      leadId:        task.leadId,
      dealId:        task.dealId,
      type:          "NOTE",
      kind:          "NOTE",
      summary,
      systemGenerated: true,
      createdBy:     "system",
    },
  }).catch(() => { /* non-fatal */ });
}

async function notifyAllAssignees(
  task: { id: string; title: string; leadId: string | null; dealId: string | null; assignedToId: string | null; assignees: { userId: string }[] },
  marker: string,
  message: string,
  priority: "HIGH" | "URGENT",
): Promise<void> {
  const recipients = new Set<string>();
  if (task.assignedToId) recipients.add(task.assignedToId);
  for (const a of task.assignees) recipients.add(a.userId);
  if (recipients.size === 0) return;

  await Promise.all(
    Array.from(recipients).map((userId) =>
      prisma.notification.create({
        data: {
          userId,
          message,
          leadId:     task.leadId,
          type:       "GENERAL",
          entityId:   task.id,
          entityType: "TASK",
          priority,
        },
      }).catch(() => { /* non-fatal */ }),
    ),
  );

  await recordMarker(task, marker);
}

async function sweepDueSoon(): Promise<void> {
  const now = new Date();
  const horizon = new Date(now.getTime() + HOUR);

  const tasks = await prisma.task.findMany({
    where: {
      status: "PENDING",
      OR: [
        { assignedToId: { not: null } },
        { assignees: { some: {} } },
      ],
      dueDate: { gte: now, lte: horizon },
    },
    select: {
      id: true, title: true, leadId: true, dealId: true,
      assignedToId: true, dueDate: true,
      assignees: { select: { userId: true } },
    },
    take: 200,
  });

  for (const t of tasks) {
    const marker = "[notify:due-soon]";
    if (await alreadyNotified(t.id, marker)) continue;
    await notifyAllAssignees(t, marker, `Task due soon: ${t.title}`, "HIGH");
  }
}

async function sweepOverdue(): Promise<void> {
  const now = new Date();

  const tasks = await prisma.task.findMany({
    where: {
      status: "PENDING",
      OR: [
        { assignedToId: { not: null } },
        { assignees: { some: {} } },
      ],
      dueDate: { lt: now },
    },
    select: {
      id: true, title: true, leadId: true, dealId: true,
      assignedToId: true, dueDate: true,
      assignees: { select: { userId: true } },
    },
    take: 200,
  });

  for (const t of tasks) {
    const marker = "[notify:overdue]";
    if (await alreadyNotified(t.id, marker)) continue;
    await notifyAllAssignees(t, marker, `Task overdue: ${t.title}`, "URGENT");
  }
}

export function startTaskNotifier(intervalMs: number = 15 * 60_000): void {
  const tick = (): void => {
    Promise.all([sweepDueSoon(), sweepOverdue()]).catch((err) =>
      console.error("[taskNotifier] sweep error:", err),
    );
  };
  tick();
  setInterval(tick, intervalMs);
}
