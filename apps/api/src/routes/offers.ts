import { Router } from "express";
import { prisma } from "../lib/prisma";
import { createGeneratedDocument } from "../services/documentService";
import { requireAuthentication } from "../middleware/auth";

const router = Router();
router.use(requireAuthentication);

const OFFER_INCLUDE = {
  lead: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, nationality: true, budget: true, stage: true } },
  unit: {
    include: {
      images: { orderBy: { sortOrder: "asc" } as any },
      project: { select: { id: true, name: true, location: true, handoverDate: true } },
    },
  },
  paymentPlan: { select: { id: true, name: true } },
} as const;

// ─── List offers ──────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const { leadId, unitId } = req.query;
    const where: any = {};
    if (leadId) where.leadId = leadId;
    if (unitId) where.unitId = unitId;

    const offers = await prisma.offer.findMany({
      where,
      include: OFFER_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    res.json(offers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch offers", code: "FETCH_OFFERS_ERROR", statusCode: 500 });
  }
});

// ─── Get single offer ─────────────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  try {
    const offer = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: OFFER_INCLUDE,
    });

    if (!offer) {
      return res.status(404).json({ error: "Offer not found", code: "NOT_FOUND", statusCode: 404 });
    }

    res.json(offer);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch offer", code: "FETCH_OFFER_ERROR", statusCode: 500 });
  }
});

// ─── Create offer ─────────────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const { leadId, unitId, offeredPrice, discountAmount, paymentPlanId, expiresAt, notes } = req.body;
    if (!leadId || !unitId) {
      return res.status(400).json({ error: "leadId and unitId are required", code: "MISSING_FIELDS", statusCode: 400 });
    }

    const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { price: true } });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found", code: "NOT_FOUND", statusCode: 404 });
    }

    // Validate payment plan if provided
    if (paymentPlanId) {
      const plan = await prisma.paymentPlan.findUnique({ where: { id: paymentPlanId }, select: { id: true, isActive: true } });
      if (!plan || !plan.isActive) {
        return res.status(400).json({ error: "Payment plan not found or inactive", code: "INVALID_PLAN", statusCode: 400 });
      }
    }

    const originalPrice = unit.price;
    const finalPrice    = offeredPrice ?? originalPrice;
    const discount      = discountAmount ?? 0;
    const discountPct   = originalPrice > 0 ? (discount / originalPrice) * 100 : 0;

    const offer = await prisma.offer.create({
      data: {
        leadId,
        unitId,
        paymentPlanId: paymentPlanId ?? null,
        offeredPrice:   finalPrice,
        originalPrice,
        discountAmount: discount,
        discountPct,
        notes:          notes ?? null,
        status:         "ACTIVE",
        expiresAt:      expiresAt ? new Date(expiresAt) : null,
        createdBy:      req.auth.userId,
      },
      include: OFFER_INCLUDE,
    });

    // Version number = total offers for this lead+unit after creation
    const offerCount = await prisma.offer.count({ where: { leadId, unitId } });

    // Resolve payment plan name for snapshot
    const planName = (offer as any).paymentPlan?.name ?? null;

    // SALES_OFFER document with full snapshot
    const dataSnapshot = {
      offerId:        offer.id,
      version:        offerCount,
      offeredPrice:   finalPrice,
      originalPrice,
      discountAmount: discount,
      discountPct,
      paymentPlan:    planName ? { id: paymentPlanId, name: planName } : null,
      notes:          notes ?? null,
      expiresAt:      expiresAt ?? null,
      unitDetails: {
        id:            unitId,
        unitNumber:    (offer as any).unit?.unitNumber,
        floor:         (offer as any).unit?.floor,
        type:          (offer as any).unit?.type,
        area:          (offer as any).unit?.area,
        view:          (offer as any).unit?.view,
        bathrooms:     (offer as any).unit?.bathrooms,
        parkingSpaces: (offer as any).unit?.parkingSpaces,
        internalArea:  (offer as any).unit?.internalArea,
        externalArea:  (offer as any).unit?.externalArea,
      },
      projectDetails: (offer as any).unit?.project,
      buyerDetails: {
        id:          leadId,
        name:        `${(offer as any).lead?.firstName} ${(offer as any).lead?.lastName}`,
        phone:       (offer as any).lead?.phone,
        email:       (offer as any).lead?.email,
        nationality: (offer as any).lead?.nationality,
        budget:      (offer as any).lead?.budget,
      },
    };

    await createGeneratedDocument({
      type:         "SALES_OFFER",
      name:         `Sales Offer v${offerCount} — ${finalPrice.toLocaleString()} AED`,
      leadId,
      dataSnapshot,
      createdBy:    req.auth.userId,
    });

    // Auto-advance lead to PROPOSAL if still in early stage
    const lead = (offer as any).lead;
    const advanceableStages = ["NEW", "CONTACTED", "QUALIFIED", "VIEWING"];
    if (lead && advanceableStages.includes(lead.stage)) {
      await prisma.lead.update({ where: { id: leadId }, data: { stage: "PROPOSAL" } });
      await prisma.leadStageHistory.create({
        data: {
          leadId,
          oldStage:  lead.stage,
          newStage:  "PROPOSAL",
          changedBy: req.auth.userId,
          reason:    "Offer generated",
        },
      });
    }

    // Activity log
    const planNote = planName ? ` · ${planName}` : "";
    const discountNote = discount > 0 ? ` (discount: ${discount.toLocaleString()} AED)` : "";
    await prisma.activity.create({
      data: {
        leadId,
        type:    "NOTE",
        summary: `Sales Offer v${offerCount} generated — ${finalPrice.toLocaleString()} AED${discountNote}${planNote}`,
        createdBy: req.auth.userId,
      },
    });

    res.status(201).json(offer);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to create offer", code: "OFFER_CREATE_ERROR", statusCode: 400 });
  }
});

// ─── Update offer status (accept / reject / withdraw) ────────────────────────

router.patch("/:id/status", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const { status, rejectedReason } = req.body;
    const validStatuses = ["ACTIVE", "ACCEPTED", "REJECTED", "EXPIRED", "WITHDRAWN"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status", code: "INVALID_STATUS", statusCode: 400 });
    }

    const offer = await prisma.offer.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === "ACCEPTED" ? { acceptedBy: req.auth.userId } : {}),
        ...(rejectedReason        ? { rejectedReason }              : {}),
      },
      include: OFFER_INCLUDE,
    });

    // Log activity
    const actionLabel: Record<string, string> = {
      ACCEPTED:  "accepted",
      REJECTED:  "rejected",
      WITHDRAWN: "withdrawn",
    };
    if (actionLabel[status]) {
      await prisma.activity.create({
        data: {
          leadId:    offer.leadId,
          type:      "NOTE",
          summary:   `Offer ${actionLabel[status]} — ${offer.offeredPrice.toLocaleString()} AED`,
          createdBy: req.auth.userId,
        },
      });
    }

    res.json(offer);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update offer", code: "OFFER_UPDATE_ERROR", statusCode: 400 });
  }
});

export default router;
