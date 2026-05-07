import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  cancelTask,
  completeTask,
  createTask,
  reopenTask,
  snoozeTask,
} from "../services/taskService";
import { buildProjectScope } from "../middleware/scope";

const router = Router();

const TASK_INCLUDE = {
  lead:       { select: { id: true, firstName: true, lastName: true } },
  deal:       { select: { id: true, dealNumber: true, lead: { select: { firstName: true, lastName: true } } } },
  assignedTo: { select: { id: true, name: true } },
  watchers:   true,
};

// Annotate a task with computed `isOverdue` (no schema state churn).
function decorate<T extends { dueDate: Date | string; status: string }>(t: T): T & { isOverdue: boolean } {
  const due = new Date(t.dueDate);
  const isOverdue = (t.status === "PENDING" || t.status === "SNOOZED") && due < new Date();
  return { ...t, isOverdue };
}

// GET /api/tasks — list
router.get("/", async (req, res) => {
  try {
    const {
      status, type, source, priority,
      assignedToId, leadId, dealId, unitId, paymentId, reservationId, offerId,
      dueBefore, dueAfter, q, limit = "100",
    } = req.query;

    const where: any = {};
    if (status)        where.status        = status;
    if (type)          where.type          = type;
    if (source)        where.source        = source;
    if (priority)      where.priority      = priority;
    if (assignedToId)  where.assignedToId  = assignedToId;
    if (leadId)        where.leadId        = leadId;
    if (dealId)        where.dealId        = dealId;
    if (unitId)        where.unitId        = unitId;
    if (paymentId)     where.paymentId     = paymentId;
    if (reservationId) where.reservationId = reservationId;
    if (offerId)       where.offerId       = offerId;
    if (q)             where.title         = { contains: String(q) };
    if (dueBefore || dueAfter) {
      where.dueDate = {};
      if (dueBefore) where.dueDate.lte = new Date(dueBefore as string);
      if (dueAfter)  where.dueDate.gte = new Date(dueAfter as string);
    }

    const scope = await buildProjectScope(req.auth?.userId ?? "");
    const finalWhere = scope ? { AND: [where, scope] } : where;

    const tasks = await prisma.task.findMany({
      where: finalWhere,
      include: TASK_INCLUDE,
      orderBy: { dueDate: "asc" },
      take: Math.min(200, parseInt(limit as string) || 100),
    });

    res.json(tasks.map(decorate));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tasks", code: "FETCH_TASKS_ERROR", statusCode: 500 });
  }
});

// GET /api/tasks/mine — convenience: tasks assigned to the caller
router.get("/mine", async (req, res) => {
  if (!req.auth?.userId) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
  try {
    const tasks = await prisma.task.findMany({
      where: { assignedToId: req.auth.userId, status: { in: ["PENDING", "SNOOZED"] } },
      include: TASK_INCLUDE,
      orderBy: { dueDate: "asc" },
      take: 200,
    });
    res.json(tasks.map(decorate));
  } catch {
    res.status(500).json({ error: "Failed to fetch tasks", code: "FETCH_TASKS_ERROR", statusCode: 500 });
  }
});

// GET /api/tasks/:id
router.get("/:id", async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: TASK_INCLUDE,
    });
    if (!task) return res.status(404).json({ error: "Task not found", code: "NOT_FOUND", statusCode: 404 });
    res.json(decorate(task));
  } catch {
    res.status(500).json({ error: "Failed to fetch task", code: "FETCH_TASK_ERROR", statusCode: 500 });
  }
});

// POST /api/tasks
router.post("/", async (req, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    const task = await createTask(req.body);
    const full = await prisma.task.findUnique({ where: { id: task.id }, include: TASK_INCLUDE });
    res.status(201).json(full ? decorate(full) : task);
  } catch (error: any) {
    res.status(error.statusCode || 400).json({
      error: error.message || "Failed to create task",
      code:  error.code    || "TASK_CREATE_ERROR",
      statusCode: error.statusCode || 400,
    });
  }
});

// PATCH /api/tasks/:id — generic update
router.patch("/:id", async (req, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    const { title, type, priority, status, dueDate, notes, assignedToId } = req.body;
    const data: any = {};
    if (title        !== undefined) data.title        = title;
    if (type         !== undefined) data.type         = type;
    if (priority     !== undefined) data.priority     = priority;
    if (status       !== undefined) data.status       = status;
    if (dueDate      !== undefined) data.dueDate      = new Date(dueDate);
    if (notes        !== undefined) data.notes        = notes;
    if (assignedToId !== undefined) data.assignedToId = assignedToId;
    const task = await prisma.task.update({ where: { id: req.params.id }, data, include: TASK_INCLUDE });
    res.json(decorate(task));
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update task", code: "TASK_UPDATE_ERROR", statusCode: 400 });
  }
});

// PATCH /api/tasks/:id/complete
router.patch("/:id/complete", async (req, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    const task = await completeTask(req.params.id, req.auth.userId, req.body?.completionNotes);
    res.json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to complete task", code: "TASK_COMPLETE_ERROR", statusCode: 400 });
  }
});

// PATCH /api/tasks/:id/reopen
router.patch("/:id/reopen", async (req, res) => {
  if (!req.auth?.userId) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
  try {
    const task = await reopenTask(req.params.id);
    res.json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to reopen task", code: "TASK_REOPEN_ERROR", statusCode: 400 });
  }
});

// PATCH /api/tasks/:id/snooze — body: { until: ISOString } or { hours: number }
router.patch("/:id/snooze", async (req, res) => {
  if (!req.auth?.userId) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
  try {
    const { until, hours } = req.body || {};
    let target: Date | null = null;
    if (until) target = new Date(until);
    else if (hours) target = new Date(Date.now() + Number(hours) * 60 * 60 * 1000);
    if (!target || Number.isNaN(target.getTime())) {
      return res.status(400).json({ error: "until (ISO) or hours required", code: "MISSING_FIELDS", statusCode: 400 });
    }
    const task = await snoozeTask(req.params.id, target);
    res.json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to snooze task", code: "TASK_SNOOZE_ERROR", statusCode: 400 });
  }
});

// PATCH /api/tasks/:id/cancel
router.patch("/:id/cancel", async (req, res) => {
  if (!req.auth?.userId) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
  try {
    const task = await cancelTask(req.params.id, req.body?.reason ?? null);
    res.json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to cancel task", code: "TASK_CANCEL_ERROR", statusCode: 400 });
  }
});

// POST /api/tasks/:id/watchers — body: { userId }
router.post("/:id/watchers", async (req, res) => {
  if (!req.auth?.userId) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required", code: "MISSING_FIELDS", statusCode: 400 });
    await prisma.taskWatcher.upsert({
      where:  { taskId_userId: { taskId: req.params.id, userId } },
      update: {},
      create: { taskId: req.params.id, userId },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to add watcher", code: "WATCHER_ADD_ERROR", statusCode: 400 });
  }
});

// DELETE /api/tasks/:id/watchers/:userId
router.delete("/:id/watchers/:userId", async (req, res) => {
  if (!req.auth?.userId) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
  try {
    await prisma.taskWatcher.delete({
      where: { taskId_userId: { taskId: req.params.id, userId: req.params.userId } },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to remove watcher", code: "WATCHER_DEL_ERROR", statusCode: 400 });
  }
});

// DELETE /api/tasks/:id
router.delete("/:id", async (req, res) => {
  if (!req.auth?.userId) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to delete task", code: "TASK_DELETE_ERROR", statusCode: 400 });
  }
});

export default router;
