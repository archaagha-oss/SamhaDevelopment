import { Router } from "express";
import { prisma } from "../lib/prisma";
import { logActivity } from "../services/activityService";
import { createTask } from "../services/taskService";
import { buildProjectScope } from "../middleware/scope";

const router = Router();

// GET /api/activities — Global feed with filters
router.get("/", async (req, res) => {
  try {
    const {
      leadId, dealId, unitId, contactId, reservationId, offerId, paymentId,
      type, kind, channel, createdBy, dateFrom, dateTo, limit = "200",
    } = req.query;

    const where: any = {};
    if (leadId)        where.leadId        = leadId;
    if (dealId)        where.dealId        = dealId;
    if (unitId)        where.unitId        = unitId;
    if (contactId)     where.contactId     = contactId;
    if (reservationId) where.reservationId = reservationId;
    if (offerId)       where.offerId       = offerId;
    if (paymentId)     where.paymentId     = paymentId;
    if (type)          where.type          = type;
    if (kind)          where.kind          = kind;
    if (channel)       where.channel       = channel;
    if (createdBy)     where.createdBy     = createdBy;
    if (dateFrom || dateTo) {
      where.activityDate = {};
      if (dateFrom) where.activityDate.gte = new Date(dateFrom as string);
      if (dateTo)   where.activityDate.lte = new Date(dateTo as string);
    }

    const scope = await buildProjectScope(req.auth?.userId ?? "");
    const finalWhere = scope ? { AND: [where, scope] } : where;

    const activities = await prisma.activity.findMany({
      where: finalWhere,
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

// POST /api/activities
router.post("/", async (req, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    const {
      leadId, dealId, unitId, contactId, reservationId, offerId, paymentId,
      type, kind, channel, direction, outcomeCode,
      summary, outcome, activityDate, followUpDate, callDuration,
    } = req.body;

    const activity = await logActivity({
      leadId, dealId, unitId, contactId, reservationId, offerId, paymentId,
      type:       type ?? "NOTE",
      kind, channel, direction, outcomeCode,
      summary,
      outcome,
      activityDate,
      followUpDate,
      callDuration: callDuration ? parseInt(callDuration) : null,
      createdBy:    req.auth.userId,
      createdById:  req.auth.userId,
    });

    // Auto follow-up task — works for any owning entity, not just lead.
    if (followUpDate) {
      let owner = null as string | null;
      if (leadId) {
        const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { assignedAgentId: true } });
        owner = lead?.assignedAgentId ?? null;
      } else if (dealId) {
        const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { lead: { select: { assignedAgentId: true } } } });
        owner = deal?.lead.assignedAgentId ?? null;
      }
      await createTask({
        title:    `Follow up: ${String(summary).slice(0, 80)}`,
        type:     "FOLLOW_UP",
        priority: "MEDIUM",
        leadId:   leadId ?? null,
        dealId:   dealId ?? null,
        unitId:   unitId ?? null,
        assignedToId: owner,
        dueDate:  new Date(followUpDate),
        notes:    null,
      });
    }

    res.status(201).json(activity);
  } catch (error: any) {
    res.status(error.statusCode || 400).json({
      error: error.message || "Failed to create activity",
      code:  error.code    || "CREATE_ACTIVITY_ERROR",
      statusCode: error.statusCode || 400,
    });
  }
});

export default router;
