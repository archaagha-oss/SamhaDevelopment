import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/activities — Global activity feed with filters
router.get("/", async (req, res) => {
  try {
    const { leadId, dealId, unitId, type, createdBy, dateFrom, dateTo, limit = "200" } = req.query;

    const where: any = {};
    if (leadId)    where.leadId    = leadId;
    if (dealId)    where.dealId    = dealId;
    if (unitId)    where.unitId    = unitId;
    if (type)      where.type      = type;
    if (createdBy) where.createdBy = createdBy;
    if (dateFrom || dateTo) {
      where.activityDate = {};
      if (dateFrom) where.activityDate.gte = new Date(dateFrom as string);
      if (dateTo)   where.activityDate.lte = new Date(dateTo as string);
    }

    const activities = await prisma.activity.findMany({
      where,
      orderBy: { activityDate: "desc" },
      take: Math.min(parseInt(limit as string) || 200, 500),
      include: {
        lead: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, dealNumber: true } },
        unit: { select: { id: true, unitNumber: true } },
      },
    });

    res.json({ data: activities });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch activities", code: "FETCH_ACTIVITIES_ERROR", statusCode: 500 });
  }
});

// POST /api/activities — Create activity (without needing a specific entity endpoint)
router.post("/", async (req, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    const { leadId, dealId, unitId, type, summary, outcome, activityDate, followUpDate, callDuration } = req.body;
    if (!type || !summary) return res.status(400).json({ error: "type and summary are required", code: "MISSING_FIELDS", statusCode: 400 });
    if (!leadId && !dealId && !unitId) return res.status(400).json({ error: "At least one of leadId, dealId, or unitId is required", code: "MISSING_ENTITY", statusCode: 400 });

    const activity = await prisma.activity.create({
      data: {
        leadId: leadId || null,
        dealId: dealId || null,
        unitId: unitId || null,
        type,
        summary,
        outcome: outcome || null,
        callDuration: callDuration ? parseInt(callDuration) : null,
        activityDate: activityDate ? new Date(activityDate) : new Date(),
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        createdBy: req.auth.userId,
      },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, dealNumber: true } },
        unit: { select: { id: true, unitNumber: true } },
      },
    });

    // Auto-create follow-up task if followUpDate provided
    if (followUpDate && leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { assignedAgentId: true } });
      await prisma.task.create({
        data: {
          title: `Follow up: ${summary.slice(0, 80)}`,
          type: "FOLLOW_UP",
          priority: "MEDIUM",
          leadId,
          assignedToId: lead?.assignedAgentId || null,
          dueDate: new Date(followUpDate),
        },
      });
    }

    res.status(201).json(activity);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to create activity", code: "CREATE_ACTIVITY_ERROR", statusCode: 400 });
  }
});

export default router;
