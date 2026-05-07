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

async function sweepDueSoon(): Promise<void> {
  const now = new Date();
  const horizon = new Date(now.getTime() + HOUR);

  const tasks = await prisma.task.findMany({
    where: {
      status: "PENDING",
      assignedToId: { not: null },
      dueDate: { gte: now, lte: horizon },
    },
    select: {
      id: true, title: true, leadId: true, dealId: true,
      assignedToId: true, dueDate: true,
    },
    take: 200,
  });

  for (const t of tasks) {
    if (!t.assignedToId) continue;
    const marker = "[notify:due-soon]";
    if (await alreadyNotified(t.id, marker)) continue;

    await prisma.notification.create({
      data: {
        userId:     t.assignedToId,
        message:    `Task due soon: ${t.title}`,
        leadId:     t.leadId,
        type:       "GENERAL",
        entityId:   t.id,
        entityType: "TASK",
        priority:   "HIGH",
      },
    }).catch(() => { /* non-fatal */ });

    await recordMarker(t, marker);
  }
}

async function sweepOverdue(): Promise<void> {
  const now = new Date();

  const tasks = await prisma.task.findMany({
    where: {
      status: "PENDING",
      assignedToId: { not: null },
      dueDate: { lt: now },
    },
    select: {
      id: true, title: true, leadId: true, dealId: true,
      assignedToId: true, dueDate: true,
    },
    take: 200,
  });

  for (const t of tasks) {
    if (!t.assignedToId) continue;
    const marker = "[notify:overdue]";
    if (await alreadyNotified(t.id, marker)) continue;

    await prisma.notification.create({
      data: {
        userId:     t.assignedToId,
        message:    `Task overdue: ${t.title}`,
        leadId:     t.leadId,
        type:       "GENERAL",
        entityId:   t.id,
        entityType: "TASK",
        priority:   "URGENT",
      },
    }).catch(() => { /* non-fatal */ });

    await recordMarker(t, marker);
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
