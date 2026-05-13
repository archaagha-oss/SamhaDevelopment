import { Router } from "express";
import { validate } from "../middleware/validation";
import {
  createDealSchema,
  updateDealStageSchema,
  replaceDealPurchasersSchema,
} from "../schemas/validation";
import {
  createDeal as createDealService,
  updateDealStage,
  getStageRequirements,
} from "../services/dealService";
import { addCustomMilestone, restructureSchedule, generatePaymentSchedule } from "../services/paymentService";
import { createGeneratedDocument } from "../services/documentService";
import { buildSpaSnapshot } from "../services/spaService";
import { renderBilingualSpaHtml, collectMissingArabic } from "../services/spa/bilingualTemplate";
import { calculateDealSpaRules } from "../services/spaRulesService";
import { prisma } from "../lib/prisma";
import { requireFinanceAccess } from "../middleware/auth";
import { idempotencyKey } from "../middleware/idempotency";
import { dealAccessFilter } from "../lib/pii";

const router = Router();

// Get all deals with pagination
router.get("/", async (req, res) => {
  try {
    const { stage, search, page = "1", limit = "50" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const skip = (pageNum - 1) * pageSize;

    // Single-org access scope: VIEWER / MEMBER see only deals on their own leads.
    const where: any = { ...(await dealAccessFilter(req)) };
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

// Get deal detail with Oqood countdown and commission unlock status.
// Scoped: VIEWER / MEMBER see only deals on their own leads.
router.get("/:id", async (req, res) => {
  try {
    const accessScope = await dealAccessFilter(req);
    const deal = await prisma.deal.findFirst({
      where: { id: req.params.id, ...accessScope },
      include: {
        lead: { include: { communicationPreference: true } },
        unit: {
          include: {
            project: {
              include: {
                config: true,
                bankAccounts: true,
                specifications: { orderBy: { sortOrder: "asc" } },
              },
            },
            images: { orderBy: { sortOrder: "asc" } },
          },
        },
        paymentPlan: { include: { milestones: { orderBy: { sortOrder: "asc" } } } },
        payments: { orderBy: { dueDate: "asc" }, include: { auditLog: true } },
        purchasers: { orderBy: { sortOrder: "asc" } },
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

// SPA business-rule calculator. Late fees, disposal eligibility, delay
// compensation, liquidated damages — all read-only, all derived from
// ProjectConfig overrides + the SAMHA SPA defaults. Optional `asOf=ISO`
// query parameter supports back-dated and forward-dated reporting.
// GET /api/deals/:id/spa-rules
router.get("/:id/spa-rules", async (req, res) => {
  try {
    const asOf = req.query.asOf ? new Date(String(req.query.asOf)) : new Date();
    if (Number.isNaN(asOf.getTime())) {
      return res.status(400).json({
        error: "Invalid asOf date",
        code: "INVALID_ASOF",
        statusCode: 400,
      });
    }
    const summary = await calculateDealSpaRules(req.params.id, asOf);
    res.json(summary);
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Deal not found", code: "NOT_FOUND", statusCode: 404 });
    }
    res.status(500).json({
      error: error.message || "Failed to compute SPA rules",
      code: "SPA_RULES_ERROR",
      statusCode: 500,
    });
  }
});

// SPA snapshot — the canonical shape consumed by the legal SPA renderer.
// Live preview, but the same builder produces the persisted dataSnapshot.
// GET /api/deals/:id/spa-snapshot
router.get("/:id/spa-snapshot", async (req, res) => {
  try {
    const snapshot = await buildSpaSnapshot(req.params.id);
    res.json(snapshot);
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Deal not found", code: "NOT_FOUND", statusCode: 404 });
    }
    res.status(500).json({
      error: "Failed to build SPA snapshot",
      code: "SPA_SNAPSHOT_ERROR",
      statusCode: 500,
    });
  }
});

// ── Bilingual SPA preview (Phase 4b) ───────────────────────────────────────
// POST /api/deals/:id/spa/preview
// Returns { html, missingArabic } where `html` is a full, browser-renderable
// document the operator can open in a tab to eyeball the bilingual layout,
// and `missingArabic` is the list of tokens (e.g. "buyer.nameAr") that
// still need an Arabic value. This is preview-only and does NOT touch the
// existing /generate-document pipeline — PDF rendering ships separately.
router.post("/:id/spa/preview", async (req, res) => {
  try {
    const snapshot = await buildSpaSnapshot(req.params.id);
    const html = renderBilingualSpaHtml(snapshot);
    const missingArabic = collectMissingArabic(snapshot).map((m) => m.token);
    res.json({ html, missingArabic });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: "Deal not found", code: "NOT_FOUND", statusCode: 404 });
    }
    res.status(500).json({
      error: "Failed to build SPA preview",
      code: "SPA_PREVIEW_ERROR",
      statusCode: 500,
    });
  }
});

// ----- Deal purchasers (joint purchasers, SPA Particulars Item II) ---------

router.get("/:id/purchasers", async (req, res) => {
  try {
    const purchasers = await prisma.dealPurchaser.findMany({
      where: { dealId: req.params.id },
      orderBy: { sortOrder: "asc" },
    });
    res.json(purchasers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch purchasers", code: "FETCH_PURCHASERS_ERROR", statusCode: 500 });
  }
});

// PUT /:id/purchasers — replace the deal's purchaser list in one shot.
// Bulk replace keeps the joint-purchaser editor simple (one Save button).
// Sum of ownershipPercentage must equal 100.
router.put("/:id/purchasers", validate(replaceDealPurchasersSchema), async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const dealId = req.params.id;
    const incoming = req.body.purchasers as Array<{
      leadId?: string | null;
      name: string;
      ownershipPercentage: number;
      address?: string | null;
      phone?: string | null;
      email?: string | null;
      nationality?: string | null;
      emiratesId?: string | null;
      passportNumber?: string | null;
      companyRegistrationNumber?: string | null;
      authorizedSignatory?: string | null;
      sourceOfFunds?: string | null;
      isPrimary?: boolean;
      sortOrder?: number;
    }>;

    const totalPct = incoming.reduce((s, p) => s + p.ownershipPercentage, 0);
    if (Math.abs(totalPct - 100) > 0.01) {
      return res.status(400).json({
        error: `Ownership percentages must sum to 100% (got ${totalPct.toFixed(2)}%)`,
        code: "OWNERSHIP_SUM_INVALID",
        statusCode: 400,
      });
    }

    const primaries = incoming.filter((p) => p.isPrimary);
    if (primaries.length !== 1) {
      return res.status(400).json({
        error: "Exactly one purchaser must be marked as primary",
        code: "PRIMARY_PURCHASER_INVALID",
        statusCode: 400,
      });
    }

    await prisma.$transaction([
      prisma.dealPurchaser.deleteMany({ where: { dealId } }),
      ...incoming.map((p, idx) =>
        prisma.dealPurchaser.create({
          data: {
            dealId,
            leadId: p.leadId ?? null,
            name: p.name,
            ownershipPercentage: p.ownershipPercentage,
            address: p.address ?? null,
            phone: p.phone ?? null,
            email: p.email || null,
            nationality: p.nationality ?? null,
            emiratesId: p.emiratesId ?? null,
            passportNumber: p.passportNumber ?? null,
            companyRegistrationNumber: p.companyRegistrationNumber ?? null,
            authorizedSignatory: p.authorizedSignatory ?? null,
            sourceOfFunds: p.sourceOfFunds ?? null,
            isPrimary: p.isPrimary ?? false,
            sortOrder: p.sortOrder ?? idx,
          },
        })
      ),
    ]);

    const purchasers = await prisma.dealPurchaser.findMany({
      where: { dealId },
      orderBy: { sortOrder: "asc" },
    });
    res.json(purchasers);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to save purchasers", code: "SAVE_PURCHASERS_ERROR", statusCode: 400 });
  }
});

// Create deal — idempotent on Idempotency-Key header (replays cached response
// for 24h on retry, preventing duplicate deals from network retries).
router.post("/", idempotencyKey, validate(createDealSchema), async (req, res) => {
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

// Update deal stage. Idempotent: a retry with the same Idempotency-Key
// replays the cached response instead of re-transitioning (and re-firing
// side effects like commission unlock or unit-status flips).
router.patch(
  "/:id/stage",
  idempotencyKey,
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

// Change the unit assigned to a deal. Idempotent — a retried double-click
// won't release-and-reacquire a unit twice.
// Allowed while the deal is pre-SPA-signed (RESERVATION_PENDING /
// RESERVATION_CONFIRMED / SPA_PENDING / SPA_SENT). Past SPA_SIGNED, the
// unit is contractually committed and a swap would break the audit trail.
// Releases old unit → AVAILABLE, puts new unit → ON_HOLD, updates deal + logs audit.
router.patch("/:id/unit", idempotencyKey, async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const { unitId, salePrice: bodySalePrice } = req.body;
    if (!unitId) {
      return res.status(400).json({ error: "unitId is required", code: "MISSING_UNIT", statusCode: 400 });
    }

    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id },
      include: {
        unit: true,
        payments: { select: { id: true, status: true } },
        paymentPlan: { include: { milestones: { orderBy: { sortOrder: "asc" } } } },
      },
    });
    if (!deal) {
      return res.status(404).json({ error: "Deal not found", code: "NOT_FOUND", statusCode: 404 });
    }
    // Swap is legitimate only while the deal hasn't bound the buyer to the
    // specific unit on paper. Past SPA_SIGNED the unit is contractually
    // committed and a swap would invalidate signed documents.
    const SWAP_ALLOWED_STAGES = ["RESERVATION_PENDING", "RESERVATION_CONFIRMED", "SPA_PENDING", "SPA_SENT"];
    if (!SWAP_ALLOWED_STAGES.includes(deal.stage)) {
      return res.status(400).json({
        error: `Unit can only be changed before the SPA is signed (current stage: ${deal.stage}).`,
        code: "WRONG_STAGE",
        statusCode: 400,
      });
    }
    if (deal.unitId === unitId) {
      return res.json(deal);
    }

    // Block when any payment has already moved past PENDING. Once money has
    // been booked against the old unit, regenerating the schedule would
    // either lose receipts or produce an inconsistent ledger. Operator
    // must waive/refund the paid rows first, or cancel + recreate the deal.
    const lockedStatuses = ["PAID", "PARTIAL", "PDC_CLEARED", "WAIVED"];
    const blockingPayments = deal.payments.filter((p) => lockedStatuses.includes(p.status));
    if (blockingPayments.length > 0) {
      return res.status(409).json({
        error: `${blockingPayments.length} payment(s) on this deal have been received or waived. Refund/clear them before swapping units, or cancel this deal and create a new one.`,
        code: "DEAL_HAS_RECEIVED_PAYMENTS",
        statusCode: 409,
      });
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

    // Resolve effective sale price for the new unit. The operator can pass
    // an explicit salePrice (negotiated number); otherwise we fall back to
    // the new unit's list price. This matters because the payment schedule
    // is regenerated against this value.
    const newSalePrice = typeof bodySalePrice === "number" && bodySalePrice > 0
      ? bodySalePrice
      : newUnit.price;

    // Atomic swap: release old unit, hold new unit, regenerate payment
    // schedule against the new sale price, update the deal.
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

      // Drop the existing PENDING payment rows so the schedule can be
      // regenerated against the new sale price. We already proved upstream
      // that no row is PAID/PARTIAL/PDC_CLEARED/WAIVED.
      await tx.payment.deleteMany({
        where: { dealId: req.params.id, status: { in: ["PENDING", "CANCELLED", "PDC_PENDING", "PDC_BOUNCED", "OVERDUE"] } },
      });

      // Update deal: new unit + recomputed sale price
      return tx.deal.update({
        where: { id: req.params.id },
        data:  { unitId, salePrice: newSalePrice },
        include: { lead: true, unit: true, paymentPlan: { include: { milestones: true } } },
      });
    });

    // Regenerate payment schedule outside the swap transaction. generatePaymentSchedule
    // uses its own $transaction; nesting would re-enter the prisma engine.
    if (deal.paymentPlan?.milestones?.length) {
      await generatePaymentSchedule(
        deal.id,
        deal.paymentPlan.milestones as any,
        newSalePrice,
        deal.dldFee,
        deal.adminFee,
        deal.reservationDate,
        { dldPaidBy: deal.dldPaidBy as "BUYER" | "DEVELOPER", adminFeeWaived: deal.adminFeeWaived },
      );
    }

    // Audit activity
    const priceDelta = newSalePrice - deal.salePrice;
    const priceNote = priceDelta === 0 ? "" : ` (price ${priceDelta > 0 ? "+" : ""}AED ${priceDelta.toLocaleString()})`;
    await prisma.activity.create({
      data: {
        dealId:    req.params.id,
        type:      "NOTE",
        summary:   `Unit changed from ${deal.unit.unitNumber} to ${newUnit.unitNumber}${priceNote}. Payment schedule regenerated.`,
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

// Add custom milestone to an existing deal — ADMIN or Finance department.
// Idempotent on Idempotency-Key header.
router.post("/:id/payments", idempotencyKey, requireFinanceAccess, async (req, res) => {
  try {
    const user = (req as any).resolvedUser;
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

// Restructure payment schedule — shift all future payments by N days. ADMIN or Finance.
router.post("/:id/restructure", requireFinanceAccess, async (req, res) => {
  try {
    const user = (req as any).resolvedUser;
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

// POST /:id/reserve — atomically lock the unit and confirm the reservation.
//
// Everything runs inside a single Serializable transaction so that two agents
// racing to reserve the same unit cannot both succeed.
//
// Flow (all in one transaction):
//   1. Re-fetch deal + unit with latest DB state
//   2. Validate deal stage == RESERVATION_PENDING
//   3. Validate unit status is ON_HOLD or AVAILABLE (not already RESERVED/SOLD)
//   4. unit: ON_HOLD → RESERVED  (writes UnitStatusHistory)
//   5. deal: RESERVATION_PENDING → RESERVATION_CONFIRMED (writes DealStageHistory)
//   6. lead: auto-advance to CLOSED_WON (writes LeadStageHistory)
// After commit: write Activity audit row (fire-and-forget).
router.post("/:id/reserve", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const dealId   = req.params.id;
    const userId   = req.auth.userId;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch deal + unit with latest committed data
      const deal = await tx.deal.findUnique({
        where:   { id: dealId },
        include: { unit: true, lead: true },
      });
      if (!deal) {
        const err: any = new Error("Deal not found"); err.status = 404; throw err;
      }

      // 2. Validate deal stage
      if (deal.stage !== "RESERVATION_PENDING") {
        const err: any = new Error(
          deal.stage === "RESERVATION_CONFIRMED"
            ? "Unit has already been reserved on this deal."
            : `Deal is not ready for reservation — current stage is ${deal.stage.replace(/_/g, " ")}.`
        );
        err.status = 400; err.code = "INVALID_DEAL_STAGE"; throw err;
      }

      // 3. Re-fetch unit inside the transaction to get the latest status
      const unit = await tx.unit.findUnique({ where: { id: deal.unitId } });
      if (!unit) {
        const err: any = new Error("Unit not found"); err.status = 404; throw err;
      }
      if (!["AVAILABLE", "ON_HOLD"].includes(unit.status)) {
        const err: any = new Error(
          `This unit has already been reserved or sold by another deal (status: ${unit.status}).`
        );
        err.status = 409; err.code = "UNIT_ALREADY_TAKEN"; throw err;
      }

      // 4. Lock unit → RESERVED
      await tx.unit.update({
        where: { id: unit.id },
        data:  { status: "RESERVED", holdExpiresAt: null },
      });
      await tx.unitStatusHistory.create({
        data: {
          unitId:    unit.id,
          oldStatus: unit.status,
          newStatus: "RESERVED",
          changedBy: userId,
          reason:    `Reservation confirmed — Deal ${deal.dealNumber}`,
        },
      });

      // 5. Advance deal → RESERVATION_CONFIRMED
      const updatedDeal = await tx.deal.update({
        where:   { id: dealId },
        data:    { stage: "RESERVATION_CONFIRMED" },
        include: { lead: true, unit: true },
      });
      await tx.dealStageHistory.create({
        data: {
          dealId,
          oldStage:  "RESERVATION_PENDING",
          newStage:  "RESERVATION_CONFIRMED",
          changedBy: userId,
        },
      });

      // 6. Auto-close lead as CLOSED_WON (if not already closed)
      if (!["CLOSED_WON", "CLOSED_LOST"].includes(deal.lead.stage)) {
        await tx.lead.update({ where: { id: deal.leadId }, data: { stage: "CLOSED_WON" } });
        await tx.leadStageHistory.create({
          data: {
            leadId:    deal.leadId,
            oldStage:  deal.lead.stage as any,
            newStage:  "CLOSED_WON",
            changedBy: userId,
            reason:    `Unit reserved — Deal ${deal.dealNumber}`,
          },
        });
      }

      return updatedDeal;
    }, { isolationLevel: "Serializable" });

    // Audit activity (outside transaction — non-critical)
    prisma.activity.create({
      data: {
        dealId,
        leadId:    result.leadId,
        type:      "NOTE",
        summary:   `Unit ${result.unit.unitNumber} reserved — deal confirmed`,
        createdBy: userId,
      },
    }).catch(() => {});

    res.json(result);
  } catch (error: any) {
    const status = error.status ?? 400;
    res.status(status).json({
      error:      error.message || "Failed to reserve unit",
      code:       error.code   || "RESERVE_ERROR",
      statusCode: status,
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

    // SALES_OFFER-specific guards
    if (type === "SALES_OFFER") {
      const reservedStages = [
        "RESERVATION_CONFIRMED", "SPA_PENDING", "SPA_SENT", "SPA_SIGNED",
        "OQOOD_PENDING", "OQOOD_REGISTERED", "INSTALLMENTS_ACTIVE", "HANDOVER_PENDING", "COMPLETED",
      ];
      if (!reservedStages.includes(deal.stage)) {
        return res.status(400).json({
          error: "Sales offer can only be generated after reservation is confirmed",
          code: "DEAL_NOT_RESERVED",
          statusCode: 400,
        });
      }
      if (!deal.lead.firstName) {
        return res.status(400).json({
          error: "Missing buyer details — lead must have a name",
          code: "MISSING_BUYER_DATA",
          statusCode: 400,
        });
      }
      if (!deal.unitId) {
        return res.status(400).json({
          error: "Missing unit — assign a unit to the deal before generating a sales offer",
          code: "MISSING_UNIT",
          statusCode: 400,
        });
      }
    }

    // SPA gets the full legal snapshot (purchasers, escrow, specs, schedules,
    // business-rule constants). Other doc types keep the lightweight shape.
    const dataSnapshot =
      type === "SPA"
        ? await buildSpaSnapshot(deal.id)
        : {
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
      name:        `${deal.dealNumber}_${type.toLowerCase().replace("_", "-")}_v`,
      dealId:      deal.id,
      leadId:      deal.leadId,
      dataSnapshot,
      createdBy:   req.auth.userId,
    });

    // Log activity with version
    await prisma.activity.create({
      data: {
        dealId:    deal.id,
        leadId:    deal.leadId,
        type:      "NOTE",
        summary:   `${labelMap[type]} v${doc.version} generated for ${deal.dealNumber}`,
        createdBy: req.auth.userId,
      },
    });

    const printPathMap: Record<string, string> = {
      RESERVATION_FORM: "reservation-form",
      SPA:              "spa-draft",
      SALES_OFFER:      "sales-offer",
    };
    res.status(201).json({
      ...doc,
      previewUrl: `/deals/${deal.id}/print/${printPathMap[type]}?docId=${doc.id}`,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to generate document", code: "GENERATE_DOC_ERROR", statusCode: 400 });
  }
});

// List all documents for a deal, sorted by version DESC
// GET /api/deals/:id/documents
router.get("/:id/documents", async (req, res) => {
  try {
    const docs = await prisma.document.findMany({
      where: { dealId: req.params.id, softDeleted: false },
      orderBy: [{ type: "asc" }, { version: "desc" }],
    });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch documents", code: "FETCH_DOCS_ERROR", statusCode: 500 });
  }
});

// Get a single document with its dataSnapshot (used by print pages for historical versions)
// GET /api/deals/:id/documents/:docId
router.get("/:id/documents/:docId", async (req, res) => {
  try {
    const doc = await prisma.document.findFirst({
      where: { id: req.params.docId, dealId: req.params.id, softDeleted: false },
    });
    if (!doc) {
      return res.status(404).json({ error: "Document not found", code: "NOT_FOUND", statusCode: 404 });
    }
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch document", code: "FETCH_DOC_ERROR", statusCode: 500 });
  }
});

// Pause / resume payment reminders for a deal
router.patch("/:id/pause-reminders", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const { paused, reason, pausedUntil } = req.body;
    const updated = await prisma.deal.update({
      where: { id: req.params.id },
      data: {
        remindersPaused:       !!paused,
        remindersPausedReason: paused ? (reason ?? null) : null,
        remindersPausedUntil:  paused && pausedUntil ? new Date(pausedUntil) : null,
      } as any,
    });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update reminder settings", code: "PAUSE_REMINDERS_ERROR", statusCode: 400 });
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
