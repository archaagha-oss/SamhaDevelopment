// ---------------------------------------------------------------------------
// taskService — single write path for the Task model.
//
// Why this exists:
//   - Replaces ~5 scattered prisma.task.create calls.
//   - System-generated tasks are idempotent via `dedupeKey` (templateKey:entityId).
//   - Stage rollback / deal cancel can call cancelByEntity to clean up auto-tasks.
//   - Task completion automatically logs an Activity (audit trail).
//
// Templates live as plain constants below — no DB rows, no over-engineering.
// ---------------------------------------------------------------------------

import { prisma } from "../lib/prisma.js";
import type {
  Task,
  TaskPriority,
  TaskSource,
  TaskStatus,
  TaskType,
} from "@prisma/client";
import { logSystemActivity } from "./activityService.js";

// ---------------------------------------------------------------------------
// User-created task input
// ---------------------------------------------------------------------------

export interface CreateTaskInput {
  title:        string;
  type?:        TaskType;
  priority?:    TaskPriority;
  leadId?:      string | null;
  dealId?:      string | null;
  unitId?:      string | null;
  reservationId?: string | null;
  offerId?:     string | null;
  paymentId?:   string | null;
  assignedToId?: string | null;
  dueDate:      Date | string;
  slaDueAt?:    Date | string | null;
  notes?:       string | null;
  source?:      TaskSource;          // defaults USER
  parentTaskId?: string | null;
  watchers?:    string[];             // user IDs
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  if (!input.title || !input.dueDate) {
    throw Object.assign(new Error("title and dueDate are required"), {
      code: "MISSING_FIELDS", statusCode: 400,
    });
  }

  const task = await prisma.task.create({
    data: {
      title:        input.title,
      type:         input.type     ?? "FOLLOW_UP",
      priority:     input.priority ?? "MEDIUM",
      status:       "PENDING",
      source:       input.source   ?? "USER",
      leadId:       input.leadId   ?? null,
      dealId:       input.dealId   ?? null,
      unitId:       input.unitId   ?? null,
      reservationId: input.reservationId ?? null,
      offerId:      input.offerId  ?? null,
      paymentId:    input.paymentId ?? null,
      assignedToId: input.assignedToId ?? null,
      dueDate:      new Date(input.dueDate),
      slaDueAt:     input.slaDueAt ? new Date(input.slaDueAt) : null,
      notes:        input.notes    ?? null,
      parentTaskId: input.parentTaskId ?? null,
      watchers: input.watchers && input.watchers.length
        ? { create: input.watchers.map((userId) => ({ userId })) }
        : undefined,
    },
  });

  return task;
}

// ---------------------------------------------------------------------------
// System-generated tasks (idempotent via dedupeKey)
// ---------------------------------------------------------------------------

export interface UpsertSystemTaskInput {
  templateKey:   string;
  entityId:      string;            // used to build dedupeKey
  title:         string;
  type:          TaskType;
  priority?:     TaskPriority;
  leadId?:       string | null;
  dealId?:       string | null;
  unitId?:       string | null;
  reservationId?: string | null;
  offerId?:      string | null;
  paymentId?:    string | null;
  assignedToId?: string | null;
  dueDate:       Date;
  slaDueAt?:     Date | null;
  notes?:        string | null;
  source?:       TaskSource;        // defaults SYSTEM_RULE
}

/**
 * Idempotently create or refresh a system task.
 * - If a task with the same `dedupeKey` exists and is still open, update its dueDate/title.
 * - If it was completed/cancelled, leave the historical task alone (don't reopen automatically).
 */
export async function upsertSystemTask(input: UpsertSystemTaskInput): Promise<Task> {
  const dedupeKey = `${input.templateKey}:${input.entityId}`;
  const existing = await prisma.task.findUnique({ where: { dedupeKey } });

  if (existing && (existing.status === "PENDING" || existing.status === "SNOOZED")) {
    return prisma.task.update({
      where: { id: existing.id },
      data: {
        title:    input.title,
        priority: input.priority ?? existing.priority,
        dueDate:  input.dueDate,
        slaDueAt: input.slaDueAt ?? existing.slaDueAt,
        notes:    input.notes    ?? existing.notes,
        assignedToId: input.assignedToId ?? existing.assignedToId,
      },
    });
  }

  if (existing) {
    // Completed/cancelled — leave historical record, don't re-create.
    return existing;
  }

  return prisma.task.create({
    data: {
      title:    input.title,
      type:     input.type,
      priority: input.priority ?? "MEDIUM",
      status:   "PENDING",
      source:   input.source ?? "SYSTEM_RULE",
      templateKey: input.templateKey,
      dedupeKey,
      leadId:        input.leadId        ?? null,
      dealId:        input.dealId        ?? null,
      unitId:        input.unitId        ?? null,
      reservationId: input.reservationId ?? null,
      offerId:       input.offerId       ?? null,
      paymentId:     input.paymentId     ?? null,
      assignedToId:  input.assignedToId  ?? null,
      dueDate:       input.dueDate,
      slaDueAt:      input.slaDueAt      ?? null,
      notes:         input.notes         ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Task lifecycle
// ---------------------------------------------------------------------------

export async function completeTask(
  id: string,
  completedById: string,
  completionNotes?: string | null,
): Promise<Task> {
  const task = await prisma.task.update({
    where: { id },
    data: {
      status:        "COMPLETED",
      completedAt:   new Date(),
      completedById,
      completionNotes: completionNotes ?? null,
    },
  });

  // Audit trail — best effort, never fatal
  if (task.leadId || task.dealId || task.unitId || task.reservationId || task.offerId || task.paymentId) {
    logSystemActivity({
      leadId:    task.leadId,
      dealId:    task.dealId,
      unitId:    task.unitId,
      reservationId: task.reservationId,
      offerId:   task.offerId,
      paymentId: task.paymentId,
      type:      "NOTE",
      kind:      "NOTE",
      summary:   `Task completed: ${task.title}`,
      relatedTaskId: task.id,
    }).catch(() => { /* non-fatal */ });
  }

  return task;
}

export async function reopenTask(id: string): Promise<Task> {
  return prisma.task.update({
    where: { id },
    data:  {
      status: "PENDING",
      completedAt: null,
      completedById: null,
      completionNotes: null,
      cancelledAt: null,
      cancelledReason: null,
    },
  });
}

export async function snoozeTask(id: string, until: Date): Promise<Task> {
  return prisma.task.update({
    where: { id },
    data: {
      status: "SNOOZED",
      snoozedUntil: until,
      dueDate: until,
    },
  });
}

export async function cancelTask(
  id: string,
  reason?: string | null,
): Promise<Task> {
  return prisma.task.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledReason: reason ?? null,
    },
  });
}

/**
 * Cancel all open SYSTEM tasks linked to an entity (deal cancelled, stage rollback, etc).
 */
export async function cancelSystemTasksForEntity(
  entity: { dealId?: string; leadId?: string; reservationId?: string; offerId?: string; paymentId?: string },
  reason?: string,
): Promise<number> {
  const where: any = {
    status: "PENDING",
    source: { not: "USER" },
    OR: [] as any[],
  };
  if (entity.dealId)        where.OR.push({ dealId: entity.dealId });
  if (entity.leadId)        where.OR.push({ leadId: entity.leadId });
  if (entity.reservationId) where.OR.push({ reservationId: entity.reservationId });
  if (entity.offerId)       where.OR.push({ offerId: entity.offerId });
  if (entity.paymentId)     where.OR.push({ paymentId: entity.paymentId });
  if (where.OR.length === 0) return 0;

  const result = await prisma.task.updateMany({
    where,
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledReason: reason ?? "Entity cancelled or rolled back",
    },
  });
  return result.count;
}
