import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuthentication } from "../middleware/auth";

const router = Router();
router.use(requireAuthentication);

// GET /api/tasks — list tasks (filters: status, type, assignedToId, leadId, dealId, dueBefore, dueAfter)
router.get("/", async (req, res) => {
  try {
    const { status, type, assignedToId, leadId, dealId, dueBefore, dueAfter, limit = "100" } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (assignedToId) where.assignedToId = assignedToId;
    if (leadId) where.leadId = leadId;
    if (dealId) where.dealId = dealId;
    if (dueBefore || dueAfter) {
      where.dueDate = {};
      if (dueBefore) where.dueDate.lte = new Date(dueBefore as string);
      if (dueAfter) where.dueDate.gte = new Date(dueAfter as string);
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        lead: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, dealNumber: true, lead: { select: { firstName: true, lastName: true } } } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: Math.min(200, parseInt(limit as string) || 100),
    });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tasks", code: "FETCH_TASKS_ERROR", statusCode: 500 });
  }
});

// GET /api/tasks/:id
router.get("/:id", async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, dealNumber: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
    if (!task) return res.status(404).json({ error: "Task not found", code: "NOT_FOUND", statusCode: 404 });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch task", code: "FETCH_TASK_ERROR", statusCode: 500 });
  }
});

// POST /api/tasks
router.post("/", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const { title, type, priority, leadId, dealId, assignedToId, dueDate, notes } = req.body;
    if (!title || !dueDate) {
      return res.status(400).json({ error: "title and dueDate are required", code: "MISSING_FIELDS", statusCode: 400 });
    }
    const task = await prisma.task.create({
      data: {
        title,
        type: type || "FOLLOW_UP",
        priority: priority || "MEDIUM",
        status: "PENDING",
        leadId: leadId || null,
        dealId: dealId || null,
        assignedToId: assignedToId || null,
        dueDate: new Date(dueDate),
        notes: notes || null,
      },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, dealNumber: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
    res.status(201).json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to create task", code: "TASK_CREATE_ERROR", statusCode: 400 });
  }
});

// PATCH /api/tasks/:id — update fields
router.patch("/:id", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const { title, type, priority, status, dueDate, notes, assignedToId } = req.body;
    const data: any = {};
    if (title !== undefined) data.title = title;
    if (type !== undefined) data.type = type;
    if (priority !== undefined) data.priority = priority;
    if (status !== undefined) data.status = status;
    if (dueDate !== undefined) data.dueDate = new Date(dueDate);
    if (notes !== undefined) data.notes = notes;
    if (assignedToId !== undefined) data.assignedToId = assignedToId;
    const task = await prisma.task.update({ where: { id: req.params.id }, data });
    res.json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update task", code: "TASK_UPDATE_ERROR", statusCode: 400 });
  }
});

// PATCH /api/tasks/:id/complete — mark complete
router.patch("/:id/complete", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    res.json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to complete task", code: "TASK_COMPLETE_ERROR", statusCode: 400 });
  }
});

// PATCH /api/tasks/:id/reopen — reopen a completed task
router.patch("/:id/reopen", async (req, res) => {
  if (!req.auth?.userId) {
    return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
  }
  try {
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: { status: "PENDING", completedAt: null },
    });
    res.json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to reopen task", code: "TASK_REOPEN_ERROR", statusCode: 400 });
  }
});

// DELETE /api/tasks/:id
router.delete("/:id", async (req, res) => {
  if (!req.auth?.userId) {
    return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
  }
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to delete task", code: "TASK_DELETE_ERROR", statusCode: 400 });
  }
});

export default router;
