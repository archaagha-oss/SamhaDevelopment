import { Router } from "express";
import { validate } from "../middleware/validation";
import { createDealSchema, updateDealStageSchema } from "../schemas/validation";
import {
  createDeal as createDealService,
  updateDealStage,
  getStageRequirements,
} from "../services/dealService";
import { addCustomMilestone, restructureSchedule } from "../services/paymentService";
import { createGeneratedDocument } from "../services/documentService";
import { prisma } from "../lib/prisma";

const router = Router();

// Get all deals with pagination
router.get("/", async (req, res) => {
  try {
    const { stage, search, page = "1", limit = "50" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const skip = (pageNum - 1) * pageSize;

    const where: any = {};
    if (stage) where.stage = stage;
    if (search) {
      where.OR = [
        { dealNumber: { contains: search as string } },
        { lead: { firstName: { contains: search as string } } },
        { lead: { lastName: { contains: search as string } } },
        { unit: { unitNumber: { contains: search as string } } },
      ];
    }

    const total = await prisma.deal.count({ where });

    const deals = await prisma.deal.findMany({
      where,
      include: {
        lead: true,
        unit: true,
        paymentPlan: true,
        payments: true,
        commission: true,
        stageHistory: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    res.json({
      data: deals,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch deals",
      code: "FETCH_DEALS_ERROR",
      statusCode: 500,
    });
  }
});

// Get deal detail with Oqood countdown and commission unlock status
router.get("/:id", async (req, res) => {
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id },
      include: {
        lead: true,
        unit: true,
        paymentPlan: { include: { milestones: true } },
        payments: { orderBy: { dueDate: "asc" }, include: { auditLog: true } },
        commission: true,
        documents: true,
        stageHistory: { orderBy: { changedAt: "desc" } },
        brokerCompany: true,
        brokerAgent: true,
      },
    });

    if (!deal) {
      return res.status(404).json({
        error: "Deal not found",
        code: "NOT_FOUND",
        statusCode: 404,
      });
    }

    // Calculate Oqood countdown (days remaining)
    const now = new Date();
    const daysRemaining = Math.ceil(
      (deal.oqoodDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Check if Oqood deadline is urgent (red < 7 days, yellow < 30 days)
    let oqoodStatus = "green";
    if (daysRemaining < 0) oqoodStatus = "overdue";
    else if (daysRemaining < 7) oqoodStatus = "red";
    else if (daysRemaining < 30) oqoodStatus = "yellow";

    const response = {
      ...deal,
      oqood: {
        deadline: deal.oqoodDeadline,
        daysRemaining,
        status: oqoodStatus,
        isOverdue: daysRemaining < 0,
      },
      commission: deal.commission
        ? {
            ...deal.commission,
            unlocked: deal.commission.status === "PENDING_APPROVAL",
            locked: deal.commission.status === "NOT_DUE",
            conditions: {
              spaSignedMet: !!deal.spaSignedDate,
              oqoodRegisteredMet: !!deal.oqoodRegisteredDate,
              bothMet: !!deal.spaSignedDate && !!deal.oqoodRegisteredDate,
            },
          }
        : null,
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch deal",
      code: "FETCH_DEAL_ERROR",
      statusCode: 500,
    });
  }
});

// Create deal
router.post("/", validate(createDealSchema), async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({
        error: "Unauthorized",
        code: "UNAUTHENTICATED",
        statusCode: 401,
      });
    }

    const {
      leadId,
      unitId,
      salePrice,
      discount,
      reservationAmount,
      paymentPlanId,
      brokerCompanyId,
      brokerAgentId,
      reservationId,
      commissionRateOverride,
      adminFeeWaived,
      adminFeeWaivedReason,
      adminFeeWaivedBy,
      dldPaidBy,
      dldWaivedReason,
      dldWaivedBy,
    } = req.body;

    // If reservationId is provided, validate it's active and belongs to this unit/lead
    if (reservationId) {
      const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
      if (!reservation) {
        return res.status(404).json({ error: "Reservation not found", code: "RESERVATION_NOT_FOUND", statusCode: 404 });
      }
      if (reservation.status !== "ACTIVE") {
        return res.status(400).json({
          error: `Reservation is ${reservation.status}, not ACTIVE`,
          code: "RESERVATION_NOT_ACTIVE",
          statusCode: 400,
        });
      }
      if (reservation.unitId !== unitId) {
        return res.status(400).json({ error: "Reservation unit does not match deal unit", code: "UNIT_MISMATCH", statusCode: 400 });
      }
    }

    const deal = await createDealService({
      leadId,
      unitId,
      salePrice,
      discount: discount || 0,
      reservationAmount: reservationAmount || 0,
      paymentPlanId,
      brokerCompanyId,
      brokerAgentId,
      reservationId,
      createdBy: req.auth!.userId,
      commissionRateOverride,
      adminFeeWaived,
      adminFeeWaivedReason,
      adminFeeWaivedBy,
      dldPaidBy,
      dldWaivedReason,
      dldWaivedBy,
    });

    res.status(201).json(deal);
  } catch (error: any) {
    res.status(400).json({
      error: error.message || "Failed to create deal",
      code: "DEAL_CREATION_ERROR",
      statusCode: 400,
    });
  }
});

// Update deal stage
router.patch(
  "/:id/stage",
  validate(updateDealStageSchema),
  async (req, res) => {
    try {
      if (!req.auth?.userId) {
        return res.status(401).json({
          error: "Unauthorized",
          code: "UNAUTHENTICATED",
          statusCode: 401,
        });
      }

      const { newStage } = req.body;

      const updated = await updateDealStage(req.params.id, newStage, req.auth.userId);

      res.json(updated);
    } catch (error: any) {
      res.status(400).json({
        error: error.message || "Failed to update deal stage",
        code: "DEAL_STAGE_UPDATE_ERROR",
        statusCode: 400,
      });
    }
  }
);

// Update deal fields (discount, SPA date, Oqood date, notes)
router.patch("/:id", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const { discount, spaSignedDate, oqoodRegisteredDate, notes } = req.body;
    const data: any = {};
    if (discount !== undefined) data.discount = parseFloat(discount) || 0;
    if (spaSignedDate !== undefined) data.spaSignedDate = spaSignedDate ? new Date(spaSignedDate) : null;
    if (oqoodRegisteredDate !== undefined) data.oqoodRegisteredDate = oqoodRegisteredDate ? new Date(oqoodRegisteredDate) : null;
    if (notes !== undefined) data.notes = notes;
    const deal = await prisma.deal.update({ where: { id: req.params.id }, data });

    // Log notes change as an activity
    if (notes !== undefined) {
      await prisma.activity.create({
        data: {
          dealId:    req.params.id,
          type:      "NOTE",
          summary:   "Deal notes updated",
          createdBy: req.auth.userId,
        },
      }).catch(() => {});
    }

    res.json(deal);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update deal", code: "DEAL_UPDATE_ERROR", statusCode: 400 });
  }
});

// Change the unit assigned to a deal (only when deal is still RESERVATION_PENDING)
// Releases old unit → AVAILABLE, puts new unit → ON_HOLD, updates deal + logs audit
router.patch("/:id/unit", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const { unitId } = req.body;
    if (!unitId) {
      return res.status(400).json({ error: "unitId is required", code: "MISSING_UNIT", statusCode: 400 });
    }

    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id },
      include: { unit: true },
    });
    if (!deal) {
      return res.status(404).json({ error: "Deal not found", code: "NOT_FOUND", statusCode: 404 });
    }
    if (deal.stage !== "RESERVATION_PENDING") {
      return res.status(400).json({
        error: "Unit can only be changed while the deal is in RESERVATION_PENDING stage.",
        code: "WRONG_STAGE",
        statusCode: 400,
      });
    }
    if (deal.unitId === unitId) {
      return res.json(deal);
    }

    const newUnit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!newUnit) {
      return res.status(404).json({ error: "Unit not found", code: "UNIT_NOT_FOUND", statusCode: 404 });
    }
    if (newUnit.status !== "AVAILABLE") {
      return res.status(400).json({
        error: `Unit ${newUnit.unitNumber} is ${newUnit.status}. Only AVAILABLE units can be assigned.`,
        code: "UNIT_NOT_AVAILABLE",
        statusCode: 400,
      });
    }

    // Atomic swap: release old unit, hold new unit, update deal
    const updated = await prisma.$transaction(async (tx) => {
      // Release old unit back to AVAILABLE
      await tx.unit.update({ where: { id: deal.unitId }, data: { status: "AVAILABLE", holdExpiresAt: null } });
      await tx.unitStatusHistory.create({
        data: {
          unitId:    deal.unitId,
          oldStatus: "ON_HOLD",
          newStatus: "AVAILABLE",
          changedBy: req.auth!.userId,
          reason:    `Replaced by Unit ${newUnit.unitNumber} on Deal ${deal.dealNumber}`,
        },
      });

      // Put new unit ON_HOLD
      const holdExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await tx.unit.update({ where: { id: unitId }, data: { status: "ON_HOLD", holdExpiresAt } });
      await tx.unitStatusHistory.create({
        data: {
          unitId:    unitId,
          oldStatus: "AVAILABLE",
          newStatus: "ON_HOLD",
          changedBy: req.auth!.userId,
          reason:    `Assigned to Deal ${deal.dealNumber} (unit change)`,
        },
      });

      // Update deal: new unit + price from the new unit
      return tx.deal.update({
        where: { id: req.params.id },
        data:  { unitId, salePrice: newUnit.price },
        include: { lead: true, unit: true },
      });
    });

    // Audit activity
    await prisma.activity.create({
      data: {
        dealId:    req.params.id,
        type:      "NOTE",
        summary:   `Unit changed from ${deal.unit.unitNumber} to ${newUnit.unitNumber}`,
        createdBy: req.auth.userId,
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to change unit", code: "CHANGE_UNIT_ERROR", statusCode: 400 });
  }
});

// Get required documents for moving to a given stage
// GET /api/deals/:id/stage-requirements?targetStage=SPA_SIGNED
router.get("/:id/stage-requirements", async (req, res) => {
  try {
    const { targetStage } = req.query;
    if (!targetStage || typeof targetStage !== "string") {
      return res.status(400).json({ error: "targetStage query param required", code: "MISSING_PARAM", statusCode: 400 });
    }
    const requirements = await getStageRequirements(req.params.id, targetStage as any);
    res.json({ requirements, allMet: requirements.every((r) => !r.required || r.uploaded) });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to get stage requirements", code: "STAGE_REQ_ERROR", statusCode: 400 });
  }
});

// Get activities for a deal
router.get("/:id/activities", async (req, res) => {
  try {
    const activities = await prisma.activity.findMany({
      where: { dealId: req.params.id },
      orderBy: { activityDate: "desc" },
    });
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch activities", code: "FETCH_ACTIVITIES_ERROR", statusCode: 500 });
  }
});

// Log an activity for a deal
router.post("/:id/activities", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const { type, summary, outcome, followUpDate, activityDate } = req.body;
    if (!type || !summary) {
      return res.status(400).json({ error: "type and summary are required", code: "MISSING_FIELDS", statusCode: 400 });
    }
    const activity = await prisma.activity.create({
      data: {
        dealId: req.params.id,
        type,
        summary,
        outcome: outcome || null,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        activityDate: activityDate ? new Date(activityDate) : new Date(),
        createdBy: req.auth.userId,
      },
    });
    res.status(201).json(activity);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to log activity", code: "ACTIVITY_CREATE_ERROR", statusCode: 400 });
  }
});

// Add custom milestone to an existing deal (ADMIN/FINANCE only)
router.post("/:id/payments", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const user = await prisma.user.findFirst({ where: { clerkId: req.auth.userId } });
    if (!user || !["ADMIN", "FINANCE"].includes(user.role)) {
      return res.status(403).json({ error: "Only ADMIN or FINANCE can add milestones", code: "FORBIDDEN", statusCode: 403 });
    }
    const { label, amount, dueDate, notes } = req.body;
    if (!label || !amount || !dueDate) {
      return res.status(400).json({ error: "label, amount, and dueDate are required", code: "MISSING_FIELDS", statusCode: 400 });
    }
    const payment = await addCustomMilestone(
      req.params.id,
      { label, amount: parseFloat(amount), dueDate: new Date(dueDate), notes },
      user.id
    );
    res.status(201).json(payment);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to add milestone", code: "ADD_MILESTONE_ERROR", statusCode: 400 });
  }
});

// Restructure payment schedule — shift all future payments by N days (ADMIN/FINANCE only)
router.post("/:id/restructure", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const user = await prisma.user.findFirst({ where: { clerkId: req.auth.userId } });
    if (!user || !["ADMIN", "FINANCE"].includes(user.role)) {
      return res.status(403).json({ error: "Only ADMIN or FINANCE can restructure schedules", code: "FORBIDDEN", statusCode: 403 });
    }
    const { shiftDays, reason } = req.body;
    if (!shiftDays || isNaN(parseInt(shiftDays)) || !reason) {
      return res.status(400).json({ error: "shiftDays and reason are required", code: "MISSING_FIELDS", statusCode: 400 });
    }
    const result = await restructureSchedule(req.params.id, parseInt(shiftDays), reason, user.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to restructure schedule", code: "RESTRUCTURE_ERROR", statusCode: 400 });
  }
});

// POST /:id/reserve — lock unit as RESERVED and confirm the reservation
// Transitions: deal RESERVATION_PENDING → RESERVATION_CONFIRMED, unit ON_HOLD → RESERVED
router.post("/:id/reserve", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id },
      include: { unit: true },
    });
    if (!deal) {
      return res.status(404).json({ error: "Deal not found", code: "NOT_FOUND", statusCode: 404 });
    }
    if (deal.stage !== "RESERVATION_PENDING") {
      return res.status(400).json({
        error: `Deal is already in ${deal.stage}. Reservation can only be confirmed from RESERVATION_PENDING.`,
        code: "INVALID_DEAL_STAGE",
        statusCode: 400,
      });
    }
    if (!["AVAILABLE", "ON_HOLD"].includes(deal.unit.status)) {
      return res.status(400).json({
        error: `Unit is ${deal.unit.status}. Can only reserve an AVAILABLE or ON_HOLD unit.`,
        code: "UNIT_NOT_AVAILABLE",
        statusCode: 400,
      });
    }

    const updated = await updateDealStage(deal.id, "RESERVATION_CONFIRMED", req.auth.userId);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({
      error:      error.message || "Failed to reserve unit",
      code:       "RESERVE_ERROR",
      statusCode: 400,
    });
  }
});

// Generate a system document (RESERVATION_FORM, SPA, or SALES_OFFER) for a deal
// POST /api/deals/:id/generate-document
router.post("/:id/generate-document", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const { type } = req.body;
    if (!["RESERVATION_FORM", "SPA", "SALES_OFFER"].includes(type)) {
      return res.status(400).json({
        error: "type must be RESERVATION_FORM, SPA, or SALES_OFFER",
        code: "INVALID_DOC_TYPE",
        statusCode: 400,
      });
    }

    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id },
      include: {
        lead: true,
        unit: { include: { project: { select: { id: true, name: true, location: true, handoverDate: true } } } },
        paymentPlan: true,
      },
    });
    if (!deal) {
      return res.status(404).json({ error: "Deal not found", code: "NOT_FOUND", statusCode: 404 });
    }

    const dataSnapshot = {
      dealId:           deal.id,
      dealNumber:       deal.dealNumber,
      salePrice:        deal.salePrice,
      discount:         deal.discount,
      reservationAmount: (deal as any).reservationAmount,
      reservationDate:  deal.reservationDate,
      oqoodDeadline:    deal.oqoodDeadline,
      dldFee:           deal.dldFee,
      adminFee:         deal.adminFee,
      paymentPlan:      { id: deal.paymentPlanId, name: deal.paymentPlan?.name },
      unitDetails: {
        unitNumber:    deal.unit.unitNumber,
        floor:         deal.unit.floor,
        type:          deal.unit.type,
        area:          deal.unit.area,
        view:          deal.unit.view,
        bathrooms:     deal.unit.bathrooms,
        parkingSpaces: deal.unit.parkingSpaces,
        internalArea:  deal.unit.internalArea,
        externalArea:  deal.unit.externalArea,
      },
      projectDetails: (deal.unit as any).project,
      buyerDetails: {
        name:        `${deal.lead.firstName} ${deal.lead.lastName}`,
        phone:       deal.lead.phone,
        email:       deal.lead.email,
        nationality: deal.lead.nationality,
      },
    };

    const labelMap: Record<string, string> = {
      RESERVATION_FORM: "Reservation Form",
      SPA:              "SPA Draft",
      SALES_OFFER:      "Sales Offer",
    };

    const doc = await createGeneratedDocument({
      type:        type as "RESERVATION_FORM" | "SPA" | "SALES_OFFER",
      name:        `${labelMap[type]} — ${deal.dealNumber}`,
      dealId:      deal.id,
      leadId:      deal.leadId,
      dataSnapshot,
      createdBy:   req.auth.userId,
    });

    // Log activity
    await prisma.activity.create({
      data: {
        dealId:    deal.id,
        leadId:    deal.leadId,
        type:      "NOTE",
        summary:   `${labelMap[type]} generated`,
        createdBy: req.auth.userId,
      },
    });

    res.status(201).json(doc);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to generate document", code: "GENERATE_DOC_ERROR", statusCode: 400 });
  }
});

// Delete deal (only RESERVATION_PENDING or CANCELLED)
router.delete("/:id", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const deal = await prisma.deal.findUnique({ where: { id: req.params.id } });
    if (!deal) {
      return res.status(404).json({ error: "Deal not found", code: "NOT_FOUND", statusCode: 404 });
    }
    if (!["RESERVATION_PENDING", "CANCELLED"].includes(deal.stage)) {
      return res.status(400).json({ error: "Only pending or cancelled deals can be deleted", code: "DEAL_CANNOT_DELETE", statusCode: 400 });
    }
    await prisma.deal.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to delete deal", code: "DEAL_DELETE_ERROR", statusCode: 400 });
  }
});

export default router;
