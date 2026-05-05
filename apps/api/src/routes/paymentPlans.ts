import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/payment-plans — list all active plans
router.get("/", async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const where = includeInactive === "true" ? {} : { isActive: true };
    const plans = await prisma.paymentPlan.findMany({
      where,
      include: { milestones: { orderBy: { sortOrder: "asc" } } },
      orderBy: { name: "asc" },
    });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payment plans", code: "FETCH_PLANS_ERROR", statusCode: 500 });
  }
});

// GET /api/payment-plans/:id — single plan with milestones
router.get("/:id", async (req, res) => {
  try {
    const plan = await prisma.paymentPlan.findUnique({
      where: { id: req.params.id },
      include: { milestones: { orderBy: { sortOrder: "asc" } } },
    });
    if (!plan) return res.status(404).json({ error: "Payment plan not found", code: "NOT_FOUND", statusCode: 404 });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payment plan", code: "FETCH_PLAN_ERROR", statusCode: 500 });
  }
});

// POST /api/payment-plans — create a plan with milestones
router.post("/", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const { name, description, milestones } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required", code: "VALIDATION_ERROR", statusCode: 400 });
    }
    if (!Array.isArray(milestones) || milestones.length === 0) {
      return res.status(400).json({ error: "milestones array is required and must not be empty", code: "VALIDATION_ERROR", statusCode: 400 });
    }

    const totalPct = milestones.reduce((sum: number, m: any) => sum + (m.percentage || 0), 0);
    if (Math.abs(totalPct - 100) > 0.01) {
      return res.status(400).json({ error: `Milestone percentages must sum to 100 (got ${totalPct})`, code: "VALIDATION_ERROR", statusCode: 400 });
    }

    const VALID_TRIGGERS = ["DAYS_FROM_RESERVATION", "FIXED_DATE", "ON_SPA_SIGNING", "ON_OQOOD", "ON_HANDOVER"];
    for (const [idx, m] of milestones.entries()) {
      const trigger = m.triggerType ?? "DAYS_FROM_RESERVATION";
      if (!VALID_TRIGGERS.includes(trigger)) {
        return res.status(400).json({
          error: `Milestone ${idx + 1}: invalid triggerType "${trigger}". Must be one of: ${VALID_TRIGGERS.join(", ")}`,
          code: "VALIDATION_ERROR", statusCode: 400,
        });
      }
      if (trigger === "FIXED_DATE" && !m.fixedDate) {
        return res.status(400).json({
          error: `Milestone ${idx + 1}: fixedDate is required when triggerType is FIXED_DATE`,
          code: "VALIDATION_ERROR", statusCode: 400,
        });
      }
      if (trigger === "DAYS_FROM_RESERVATION" && m.daysFromReservation == null) {
        return res.status(400).json({
          error: `Milestone ${idx + 1}: daysFromReservation is required when triggerType is DAYS_FROM_RESERVATION`,
          code: "VALIDATION_ERROR", statusCode: 400,
        });
      }
    }

    const plan = await prisma.paymentPlan.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        milestones: {
          create: milestones.map((m: any, i: number) => ({
            label: m.label,
            percentage: m.percentage,
            triggerType: m.triggerType ?? "DAYS_FROM_RESERVATION",
            isDLDFee: m.isDLDFee ?? false,
            isAdminFee: m.isAdminFee ?? false,
            daysFromReservation: m.daysFromReservation ?? null,
            fixedDate: m.fixedDate ? new Date(m.fixedDate) : null,
            sortOrder: m.sortOrder ?? i,
          })),
        },
      },
      include: { milestones: { orderBy: { sortOrder: "asc" } } },
    });
    res.status(201).json(plan);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "A payment plan with this name already exists", code: "DUPLICATE_NAME", statusCode: 409 });
    }
    res.status(500).json({ error: error.message || "Failed to create payment plan", code: "CREATE_PLAN_ERROR", statusCode: 500 });
  }
});

// PATCH /api/payment-plans/:id — update plan metadata (name, description, isActive)
router.patch("/:id", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const { name, description, isActive } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No fields to update", code: "VALIDATION_ERROR", statusCode: 400 });
    }

    const plan = await prisma.paymentPlan.update({
      where: { id: req.params.id },
      data,
      include: { milestones: { orderBy: { sortOrder: "asc" } } },
    });
    res.json(plan);
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Payment plan not found", code: "NOT_FOUND", statusCode: 404 });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "A payment plan with this name already exists", code: "DUPLICATE_NAME", statusCode: 409 });
    }
    res.status(500).json({ error: error.message || "Failed to update payment plan", code: "UPDATE_PLAN_ERROR", statusCode: 500 });
  }
});

// DELETE /api/payment-plans/:id — soft-delete by setting isActive=false (safe if deals reference it)
router.delete("/:id", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const dealsUsing = await prisma.deal.count({ where: { paymentPlanId: req.params.id } });
    if (dealsUsing > 0) {
      // Soft-delete: keep the plan but hide it from the active list
      await prisma.paymentPlan.update({ where: { id: req.params.id }, data: { isActive: false } });
      return res.json({ success: true, archived: true, message: `Plan archived (referenced by ${dealsUsing} deal(s))` });
    }
    await prisma.paymentPlan.delete({ where: { id: req.params.id } });
    res.json({ success: true, archived: false });
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Payment plan not found", code: "NOT_FOUND", statusCode: 404 });
    }
    res.status(500).json({ error: error.message || "Failed to delete payment plan", code: "DELETE_PLAN_ERROR", statusCode: 500 });
  }
});

export default router;
