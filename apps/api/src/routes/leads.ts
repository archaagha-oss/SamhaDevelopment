import { Router } from "express";
import { validate } from "../middleware/validation";
import { createLeadSchema, logActivitySchema } from "../schemas/validation";
import { prisma } from "../lib/prisma";
import { createLead, updateLeadStage, validateLeadTransition } from "../services/leadService";
import { createDeal as createDealService } from "../services/dealService";

const router = Router();

// ─── List leads ──────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const { stage, source, assignedAgentId, page = "1", limit = "50", search } = req.query;
    const pageNum  = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(limit as string) || 50));
    const skip     = (pageNum - 1) * pageSize;

    const where: any = {};
    if (stage)           where.stage           = stage;
    if (source)          where.source          = source;
    if (assignedAgentId) where.assignedAgentId = assignedAgentId;

    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: "insensitive" } },
        { lastName:  { contains: search as string, mode: "insensitive" } },
        { email:     { contains: search as string, mode: "insensitive" } },
        { phone:     { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        include: {
          assignedAgent: true,
          brokerCompany: true,
          brokerAgent:   true,
          interests:     { include: { unit: true } },
          _count:        { select: { activities: true, tasks: true } },
          deals: {
            where: { isActive: true },
            select: { id: true, stage: true, dealNumber: true, unit: { select: { unitNumber: true } } as any },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    // Attach lastContactedAt from activities
    const leadIds = leads.map((l: any) => l.id);
    const lastActivities = await prisma.activity.groupBy({
      by: ["leadId"],
      where: { leadId: { in: leadIds } },
      _max: { activityDate: true },
    });
    const lastContactMap: Record<string, Date | null> = {};
    for (const r of lastActivities) {
      if (r.leadId) lastContactMap[r.leadId] = r._max.activityDate;
    }

    // Attach nextFollowUpDate from open tasks
    const openTasks = await prisma.task.findMany({
      where: { leadId: { in: leadIds }, completedAt: null },
      orderBy: { dueDate: "asc" },
      select: { leadId: true, dueDate: true },
    });
    const nextFollowUpMap: Record<string, Date | null> = {};
    for (const t of openTasks) {
      if (t.leadId && !nextFollowUpMap[t.leadId]) nextFollowUpMap[t.leadId] = t.dueDate;
    }

    const enriched = leads.map((l: any) => ({
      ...l,
      lastContactedAt:  lastContactMap[l.id] ?? null,
      nextFollowUpDate: nextFollowUpMap[l.id] ?? null,
    }));

    res.json({
      data: enriched,
      pagination: { page: pageNum, limit: pageSize, total, pages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("[leads] GET /", error);
    res.status(500).json({ error: "Failed to fetch leads", code: "FETCH_LEADS_ERROR", statusCode: 500 });
  }
});

// ─── Get lead detail ─────────────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        assignedAgent: true,
        brokerCompany: true,
        brokerAgent:   true,
        interests:     { include: { unit: true } },
        activities:    { orderBy: { createdAt: "desc" } },
        tasks:         { orderBy: { dueDate: "asc" } },
        deals: {
          include: {
            unit: { select: { unitNumber: true, type: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        offers: {
          include: {
            unit: { select: { unitNumber: true, type: true, floor: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        documents: {
          where: { source: "GENERATED", softDeleted: false },
          orderBy: { createdAt: "desc" },
        },
        stageHistory: { orderBy: { changedAt: "desc" } },
      },
    });

    if (!lead) {
      return res.status(404).json({ error: "Lead not found", code: "NOT_FOUND", statusCode: 404 });
    }

    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch lead", code: "FETCH_LEAD_ERROR", statusCode: 500 });
  }
});

// ─── Create lead ─────────────────────────────────────────────────────────────

router.post("/", validate(createLeadSchema), async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const lead = await createLead({ ...req.body, createdBy: req.auth.userId });
    res.status(201).json(lead);
  } catch (error: any) {
    const status = error.code === "DUPLICATE_PHONE" ? 409 : 400;
    res.status(status).json({
      error:      error.message || "Failed to create lead",
      code:       error.code    || "LEAD_CREATE_ERROR",
      statusCode: status,
      ...(error.existingId ? { existingId: error.existingId } : {}),
    });
  }
});

// ─── Update lead stage (state machine enforced) ───────────────────────────────

router.patch("/:id/stage", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const { newStage, reason } = req.body;
    if (!newStage) {
      return res.status(400).json({ error: "newStage is required", code: "MISSING_FIELD", statusCode: 400 });
    }

    await updateLeadStage(req.params.id, newStage, req.auth.userId, reason);
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: { assignedAgent: true, brokerCompany: true, interests: { include: { unit: true } } },
    });
    res.json(lead);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update stage", code: "LEAD_STAGE_ERROR", statusCode: 400 });
  }
});

// ─── Get valid next stages ────────────────────────────────────────────────────

router.get("/:id/valid-transitions", async (req, res) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      select: { stage: true },
    });
    if (!lead) {
      return res.status(404).json({ error: "Lead not found", code: "NOT_FOUND", statusCode: 404 });
    }

    const ALL_STAGES = ["NEW", "CONTACTED", "OFFER_SENT", "SITE_VISIT", "NEGOTIATING", "CLOSED_WON", "CLOSED_LOST"];
    const validNext = ALL_STAGES.filter((s) => validateLeadTransition(lead.stage as any, s as any).valid);
    res.json({ current: lead.stage, validNext });
  } catch (error) {
    res.status(500).json({ error: "Failed to get transitions", code: "TRANSITIONS_ERROR", statusCode: 500 });
  }
});

// ─── Get stage history ────────────────────────────────────────────────────────

router.get("/:id/stage-history", async (req, res) => {
  try {
    const history = await prisma.leadStageHistory.findMany({
      where: { leadId: req.params.id },
      orderBy: { changedAt: "desc" },
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stage history", code: "FETCH_HISTORY_ERROR", statusCode: 500 });
  }
});

// ─── Add unit interest ────────────────────────────────────────────────────────

router.post("/:id/interests", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const { unitId, isPrimary } = req.body;

    const [interest, unit] = await Promise.all([
      prisma.leadUnitInterest.create({
        data: { leadId: req.params.id, unitId, isPrimary: isPrimary || false },
      }),
      prisma.unit.findUnique({ where: { id: unitId }, select: { price: true } }),
    ]);

    // Auto-create an active offer for this unit interest
    const existingOffer = await prisma.offer.findFirst({
      where: { leadId: req.params.id, unitId, status: "ACTIVE" },
    });
    if (!existingOffer && unit) {
      await prisma.offer.create({
        data: {
          leadId:        req.params.id,
          unitId,
          offeredPrice:  unit.price,
          originalPrice: unit.price,
          discountAmount: 0,
          discountPct:    0,
          status:        "ACTIVE",
          createdBy:     req.auth.userId,
        },
      });
    }

    res.status(201).json(interest);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to add interest", code: "INTEREST_ADD_ERROR", statusCode: 400 });
  }
});

// ─── Remove unit interest ─────────────────────────────────────────────────────

router.delete("/:id/interests/:unitId", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    await prisma.leadUnitInterest.delete({
      where: { leadId_unitId: { leadId: req.params.id, unitId: req.params.unitId } },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove interest", code: "INTEREST_REMOVE_ERROR", statusCode: 500 });
  }
});

// ─── Log activity ─────────────────────────────────────────────────────────────

router.post("/:leadId/activities", validate(logActivitySchema), async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const { type, summary, outcome, callDuration, followUpDate } = req.body;

    const activity = await prisma.activity.create({
      data: {
        leadId:       req.params.leadId,
        type,
        summary,
        outcome,
        callDuration,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        createdBy:    req.auth.userId,
      },
    });

    if (followUpDate) {
      const lead = await prisma.lead.findUnique({ where: { id: req.params.leadId }, select: { assignedAgentId: true } });
      await prisma.task.create({
        data: {
          leadId:      req.params.leadId,
          title:       `Follow up: ${summary.slice(0, 80)}`,
          type:        "FOLLOW_UP",
          priority:    "MEDIUM",
          status:      "PENDING",
          dueDate:     new Date(followUpDate),
          assignedToId: lead?.assignedAgentId ?? null,
        },
      });
    }

    res.status(201).json(activity);
  } catch (error) {
    res.status(500).json({ error: "Failed to log activity", code: "ACTIVITY_LOG_ERROR", statusCode: 500 });
  }
});

// ─── Get activities ───────────────────────────────────────────────────────────

router.get("/:leadId/activities", async (req, res) => {
  try {
    const activities = await prisma.activity.findMany({
      where: { leadId: req.params.leadId },
      orderBy: { createdAt: "desc" },
    });
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch activities", code: "FETCH_ACTIVITIES_ERROR", statusCode: 500 });
  }
});

// ─── Update lead fields ───────────────────────────────────────────────────────
// Note: stage changes must go through PATCH /:id/stage (enforces state machine).
// If stage is included here it is silently ignored.

router.patch("/:id", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const {
      firstName, lastName, phone, email, nationality,
      source, budget, assignedAgentId, notes,
      brokerCompanyId, brokerAgentId,
      // SPA / KYC fields
      address, emiratesId, passportNumber, companyRegistrationNumber,
      authorizedSignatory, sourceOfFunds,
      // stage is intentionally excluded — use PATCH /:id/stage
    } = req.body;

    // Duplicate phone check
    if (phone) {
      const existing = await prisma.lead.findFirst({
        where: { phone, NOT: { id: req.params.id } },
      });
      if (existing) {
        return res.status(409).json({ error: "Phone already in use by another lead", code: "DUPLICATE_PHONE", statusCode: 409 });
      }
    }

    const data: any = {};
    if (firstName        !== undefined) data.firstName        = firstName;
    if (lastName         !== undefined) data.lastName         = lastName;
    if (phone            !== undefined) data.phone            = phone;
    if (email            !== undefined) data.email            = email || null;
    if (nationality      !== undefined) data.nationality      = nationality || null;
    if (source           !== undefined) data.source           = source;
    if (budget           !== undefined) data.budget           = budget ? parseFloat(budget) : null;
    if (assignedAgentId  !== undefined) data.assignedAgentId  = assignedAgentId;
    if (notes            !== undefined) data.notes            = notes || null;
    if (brokerCompanyId  !== undefined) data.brokerCompanyId  = brokerCompanyId || null;
    if (brokerAgentId    !== undefined) data.brokerAgentId    = brokerAgentId   || null;
    if (address                   !== undefined) data.address                   = address || null;
    if (emiratesId                !== undefined) data.emiratesId                = emiratesId || null;
    if (passportNumber            !== undefined) data.passportNumber            = passportNumber || null;
    if (companyRegistrationNumber !== undefined) data.companyRegistrationNumber = companyRegistrationNumber || null;
    if (authorizedSignatory       !== undefined) data.authorizedSignatory       = authorizedSignatory || null;
    if (sourceOfFunds             !== undefined) data.sourceOfFunds             = sourceOfFunds || null;

    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data,
      include: {
        assignedAgent: true,
        brokerCompany: true,
        brokerAgent:   true,
        interests:     { include: { unit: true } },
      },
    });

    res.json(lead);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update lead", code: "LEAD_UPDATE_ERROR", statusCode: 400 });
  }
});

// ─── Convert lead to deal in one action ──────────────────────────────────────
// Body: { unitId?: string, notes?: string }
// Auto-fills: contact (leadId), agent, broker from lead.
// If unitId omitted, falls back to lead's primary unit interest.
// Sets lead stage → NEGOTIATING and logs audit activity.

router.post("/:id/create-deal", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        interests: {
          include: { unit: true },
          orderBy: { isPrimary: "desc" },
        },
      },
    });
    if (!lead) {
      return res.status(404).json({ error: "Lead not found", code: "NOT_FOUND", statusCode: 404 });
    }

    // Block already-closed leads
    if (["CLOSED_WON", "CLOSED_LOST"].includes(lead.stage)) {
      return res.status(400).json({
        error: `Cannot create a deal for a lead that is ${lead.stage.replace(/_/g, " ").toLowerCase()}.`,
        code: "LEAD_ALREADY_CLOSED",
        statusCode: 400,
      });
    }

    // Block if an active deal already exists
    const existingDeal = await prisma.deal.findFirst({
      where: { leadId: lead.id, isActive: true },
      select: { id: true, dealNumber: true },
    });
    if (existingDeal) {
      return res.status(409).json({
        error: `Active deal already exists for this lead: ${existingDeal.dealNumber}`,
        code: "DEAL_ALREADY_EXISTS",
        existingDealId: existingDeal.id,
        statusCode: 409,
      });
    }

    // Resolve unit: prefer explicitly supplied unitId, then primary interest, then first interest
    const { unitId: requestedUnitId, notes } = req.body;

    let resolvedUnit: any = null;

    if (requestedUnitId) {
      const unit = await prisma.unit.findUnique({ where: { id: requestedUnitId } });
      if (!unit) {
        return res.status(404).json({ error: "Unit not found", code: "UNIT_NOT_FOUND", statusCode: 404 });
      }
      if (!["AVAILABLE", "ON_HOLD"].includes(unit.status)) {
        return res.status(400).json({
          error: `Unit ${unit.unitNumber} is ${unit.status} and cannot be reserved.`,
          code: "UNIT_NOT_AVAILABLE",
          statusCode: 400,
        });
      }
      resolvedUnit = unit;
    } else {
      const interest =
        lead.interests.find((i) => i.isPrimary && ["AVAILABLE", "ON_HOLD"].includes((i.unit as any).status)) ??
        lead.interests.find((i) => ["AVAILABLE", "ON_HOLD"].includes((i.unit as any).status));

      if (!interest) {
        return res.status(400).json({
          error: "No available unit selected. Please choose a unit or add an interested unit to the lead first.",
          code: "NO_AVAILABLE_UNIT",
          statusCode: 400,
        });
      }
      resolvedUnit = interest.unit;
    }

    // Use first active payment plan as default
    const paymentPlan = await prisma.paymentPlan.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (!paymentPlan) {
      return res.status(400).json({
        error: "No active payment plan found. Create a payment plan first.",
        code: "NO_PAYMENT_PLAN",
        statusCode: 400,
      });
    }

    const deal = await createDealService({
      leadId:          lead.id,
      unitId:          resolvedUnit.id,
      salePrice:       resolvedUnit.price,
      createdBy:       req.auth.userId,
      paymentPlanId:   paymentPlan.id,
      brokerCompanyId: lead.brokerCompanyId ?? undefined,
      brokerAgentId:   lead.brokerAgentId   ?? undefined,
    });

    // If notes provided, save them on the deal
    if (notes?.trim()) {
      await prisma.deal.update({ where: { id: deal.id }, data: { notes: notes.trim() } });
    }

    // Advance lead to NEGOTIATING if not already past that stage
    const NEGOTIATING_ALLOWED_FROM = ["NEW", "CONTACTED", "QUALIFIED", "OFFER_SENT", "SITE_VISIT"];
    if (NEGOTIATING_ALLOWED_FROM.includes(lead.stage)) {
      await prisma.lead.update({ where: { id: lead.id }, data: { stage: "NEGOTIATING" } });
      await prisma.leadStageHistory.create({
        data: {
          leadId:    lead.id,
          oldStage:  lead.stage as any,
          newStage:  "NEGOTIATING",
          changedBy: req.auth.userId,
          reason:    `Deal ${deal.dealNumber} created`,
        },
      });
    }

    // Audit log
    await prisma.activity.create({
      data: {
        leadId:    lead.id,
        dealId:    deal.id,
        type:      "NOTE",
        summary:   `Deal created from lead — Unit ${resolvedUnit.unitNumber}`,
        createdBy: req.auth.userId,
      },
    });

    res.status(201).json(deal);
  } catch (error: any) {
    res.status(400).json({
      error:      error.message || "Failed to create deal",
      code:       "DEAL_CREATE_ERROR",
      statusCode: 400,
    });
  }
});

// ─── Delete lead ──────────────────────────────────────────────────────────────

router.delete("/:id", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: { deals: { where: { isActive: true } } },
    });
    if (!lead) {
      return res.status(404).json({ error: "Lead not found", code: "NOT_FOUND", statusCode: 404 });
    }
    if (lead.deals.length > 0) {
      return res.status(400).json({
        error: "Cannot delete lead with active deals. Cancel or complete deals first.",
        code: "LEAD_HAS_DEALS",
        statusCode: 400,
      });
    }

    await prisma.lead.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to delete lead", code: "LEAD_DELETE_ERROR", statusCode: 400 });
  }
});

export default router;
