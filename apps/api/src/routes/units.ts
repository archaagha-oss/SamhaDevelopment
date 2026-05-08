import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { validate } from "../middleware/validation";
import {
  updateUnitStatusSchema,
  createUnitSchema,
  updateUnitSchema,
  bulkCreateUnitsSchema,
  bulkOpsSchema,
} from "../schemas/validation";
import { updateUnitStatus, isDealOwnedStatus } from "../services/unitService";
import { prisma } from "../lib/prisma";

const router = Router();

const UNIT_NUMBER_PATTERN = /^\d{1,3}-\d{2}$/;

// File upload configuration
const uploadsDir = path.join(process.cwd(), "public", "uploads", "units");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// GET / — list units with optional projectId filter + search
router.get("/", async (req, res) => {
  try {
    const { projectId, status, type, limit = "500", search } = req.query;
    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (type) where.type = type;

    // Add search logic
    if (search) {
      const searchStr = (search as string).toUpperCase();
      where.OR = [
        { unitNumber: { contains: searchStr, mode: "insensitive" } },
        { type: { contains: searchStr, mode: "insensitive" } },
        { view: { contains: searchStr, mode: "insensitive" } },
        { status: { contains: searchStr, mode: "insensitive" } },
      ];
    }

    const units = await prisma.unit.findMany({
      where,
      orderBy: [{ floor: "asc" }, { unitNumber: "asc" }],
      take: Math.min(1000, parseInt(limit as string) || 500),
    });
    res.json({ data: units });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch units", code: "FETCH_UNITS_ERROR", statusCode: 500 });
  }
});

// GET /project/:projectId — paginated units for a project
router.get("/project/:projectId", async (req, res) => {
  try {
    const { page = "1", limit = "50" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const skip = (pageNum - 1) * pageSize;

    const total = await prisma.unit.count({ where: { projectId: req.params.projectId } });
    const units = await prisma.unit.findMany({
      where: { projectId: req.params.projectId },
      include: { statusHistory: { orderBy: { changedAt: "desc" }, take: 1 } },
      orderBy: [{ floor: "asc" }, { unitNumber: "asc" }],
      skip,
      take: pageSize,
    });

    res.json({
      data: units,
      pagination: { page: pageNum, limit: pageSize, total, pages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch units", code: "FETCH_UNITS_ERROR", statusCode: 500 });
  }
});

// POST /bulk-ops — bulk status/price/agent operations (atomic via $transaction)
router.post("/bulk-ops", validate(bulkOpsSchema), async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const { unitIds, operation, value, reason } = req.body;

    const units = await prisma.unit.findMany({ where: { id: { in: unitIds } } });
    if (units.length !== unitIds.length) {
      return res.status(404).json({ error: "One or more units not found", code: "UNITS_NOT_FOUND", statusCode: 404 });
    }

    if (operation === "BLOCK" && !reason) {
      return res.status(400).json({ error: "Reason is required for BLOCK operation", code: "REASON_REQUIRED", statusCode: 400 });
    }

    const results: { id: string; unitNumber: string; success: boolean; error?: string }[] = [];

    await prisma.$transaction(async (tx) => {
      for (const unit of units) {
        try {
          if (operation === "RELEASE") {
            if (unit.status !== "NOT_RELEASED") {
              results.push({ id: unit.id, unitNumber: unit.unitNumber, success: false, error: `Not in NOT_RELEASED status (current: ${unit.status})` });
              continue;
            }
            await tx.unit.update({ where: { id: unit.id }, data: { status: "AVAILABLE" } });
            await tx.unitStatusHistory.create({
              data: { unitId: unit.id, oldStatus: unit.status, newStatus: "AVAILABLE", changedBy: req.auth!.userId, reason: reason || "Bulk release" },
            });

          } else if (operation === "BLOCK") {
            if (["SOLD", "HANDED_OVER", "RESERVED", "BOOKED"].includes(unit.status)) {
              results.push({ id: unit.id, unitNumber: unit.unitNumber, success: false, error: `Cannot block unit with status ${unit.status}` });
              continue;
            }
            await tx.unit.update({ where: { id: unit.id }, data: { status: "BLOCKED" } });
            await tx.unitStatusHistory.create({
              data: { unitId: unit.id, oldStatus: unit.status, newStatus: "BLOCKED", changedBy: req.auth!.userId, reason },
            });

          } else if (operation === "UNBLOCK") {
            if (unit.status !== "BLOCKED") {
              results.push({ id: unit.id, unitNumber: unit.unitNumber, success: false, error: `Unit is not BLOCKED (current: ${unit.status})` });
              continue;
            }
            await tx.unit.update({ where: { id: unit.id }, data: { status: "AVAILABLE" } });
            await tx.unitStatusHistory.create({
              data: { unitId: unit.id, oldStatus: "BLOCKED", newStatus: "AVAILABLE", changedBy: req.auth!.userId, reason: reason || "Bulk unblock" },
            });

          } else if (operation === "PRICE_UPDATE") {
            if (value === undefined || value === null) throw new Error("value is required for PRICE_UPDATE");
            let newPrice: number;
            if (typeof value === "object" && value.type === "PERCENT") {
              newPrice = unit.price * (1 + value.amount / 100);
            } else if (typeof value === "object" && value.type === "FIXED_DELTA") {
              newPrice = unit.price + value.amount;
            } else {
              newPrice = Number(value);
            }
            if (newPrice <= 0) {
              results.push({ id: unit.id, unitNumber: unit.unitNumber, success: false, error: `New price would be ≤ 0` });
              continue;
            }
            await tx.unit.update({ where: { id: unit.id }, data: { price: newPrice } });
            await tx.unitPriceHistory.create({
              data: { unitId: unit.id, oldPrice: unit.price, newPrice, changedBy: req.auth!.userId, reason: reason || "Bulk price update" },
            });

          } else if (operation === "ASSIGN_AGENT") {
            await tx.unit.update({ where: { id: unit.id }, data: { assignedAgentId: value || null } });
          }

          results.push({ id: unit.id, unitNumber: unit.unitNumber, success: true });
        } catch (err: any) {
          results.push({ id: unit.id, unitNumber: unit.unitNumber, success: false, error: err.message });
        }
      }
    });

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    res.json({ succeeded, failed, results });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Bulk operation failed", code: "BULK_OPS_ERROR", statusCode: 400 });
  }
});

// POST /bulk — bulk create units (atomic via $transaction)
// Accepts either:
//   A) { projectId, floor, startUnit, count, type, area, price, view } — uniform floor batch
//   B) { projectId, units: [{unitNumber, floor, type, area, price, view}] } — per-unit array (from BulkUnitModal)
router.post("/bulk", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: "projectId is required", code: "VALIDATION_ERROR", statusCode: 400 });

    let unitData: any[];

    if (Array.isArray(req.body.units)) {
      // Mode B: per-unit array from BulkUnitModal
      unitData = req.body.units.map((u: any) => ({
        projectId,
        unitNumber: u.unitNumber,
        floor: u.floor,
        type: u.type,
        area: u.area,
        basePrice: u.price,
        price: u.price,
        view: u.view,
        status: "NOT_RELEASED" as const,
      }));
    } else {
      // Mode A: uniform floor batch (legacy)
      const { floor, startUnit, count, type, area, price, view } = req.body;
      const unitNumbers: string[] = [];
      for (let i = startUnit; i < startUnit + count; i++) {
        unitNumbers.push(`${floor}-${String(i).padStart(2, "0")}`);
      }
      unitData = unitNumbers.map((unitNumber) => ({
        projectId, unitNumber, floor, type, area, basePrice: price, price, view, status: "NOT_RELEASED" as const,
      }));
    }

    // Atomic transaction: create all or none
    const unitNumbers = unitData.map((u) => u.unitNumber);
    const existing = await prisma.unit.findMany({ where: { projectId, unitNumber: { in: unitNumbers } }, select: { unitNumber: true } });
    const existingSet = new Set(existing.map((u) => u.unitNumber));
    const toCreate = unitData.filter((u) => !existingSet.has(u.unitNumber));

    if (toCreate.length > 0) {
      await prisma.$transaction(toCreate.map((u) => prisma.unit.create({ data: u })));
    }

    const created = await prisma.unit.findMany({
      where: { projectId, unitNumber: { in: unitNumbers } },
      orderBy: [{ floor: "asc" }, { unitNumber: "asc" }],
    });
    const skipped = existing.length;
    res.status(201).json({ created: toCreate.length, skipped, units: created });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to bulk create units", code: "BULK_CREATE_ERROR", statusCode: 400 });
  }
});

// GET /:id/history — paginated status + price history
router.get("/:id/history", async (req, res) => {
  try {
    const { page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * pageSize;

    const unit = await prisma.unit.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!unit) return res.status(404).json({ error: "Unit not found", code: "NOT_FOUND", statusCode: 404 });

    const [statusHistory, priceHistory] = await Promise.all([
      prisma.unitStatusHistory.findMany({
        where: { unitId: req.params.id },
        orderBy: { changedAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.unitPriceHistory.findMany({
        where: { unitId: req.params.id },
        orderBy: { changedAt: "desc" },
        take: 50,
      }),
    ]);

    res.json({ data: { statusHistory, priceHistory } });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch unit history", code: "FETCH_HISTORY_ERROR", statusCode: 500 });
  }
});

// GET /:id — unit detail with active deal, reservation, history
router.get("/:id", async (req, res) => {
  try {
    const unit = await prisma.unit.findUnique({
      where: { id: req.params.id },
      include: {
        project: {
          select: {
            id: true, name: true, location: true, handoverDate: true,
            projectStatus: true, completionStatus: true, purpose: true, furnishing: true,
          },
        },
        statusHistory: { orderBy: { changedAt: "desc" } },
        priceHistory: { orderBy: { changedAt: "desc" } },
        interests: { include: { lead: true } },
        deals: { where: { isActive: true }, include: { lead: true }, take: 1 },
        reservations: { where: { status: "ACTIVE" }, include: { lead: true }, take: 1 },
        images: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!unit) {
      return res.status(404).json({ error: "Unit not found", code: "NOT_FOUND", statusCode: 404 });
    }

    // Compute analytics
    const inquiryCount = unit.interests.length;
    const visitCount = await prisma.activity.count({
      where: { siteVisitUnitId: req.params.id },
    });
    const pricePerSqft = unit.area > 0 ? Math.round((unit.price / unit.area) * 10.764) : null;

    res.json({ ...unit, inquiryCount, visitCount, pricePerSqft });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch unit", code: "FETCH_UNIT_ERROR", statusCode: 500 });
  }
});

// POST / — create single unit (status=NOT_RELEASED, basePrice=price)
router.post("/", validate(createUnitSchema), async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const {
      projectId, unitNumber, floor, type, area, price, view,
      bathrooms, parkingSpaces, internalArea, externalArea, internalNotes, tags,
      areaSqft, ratePerSqft, smartHome, anticipatedCompletionDate,
    } = req.body;

    if (!UNIT_NUMBER_PATTERN.test(unitNumber)) {
      return res.status(400).json({
        error: `Unit number "${unitNumber}" must follow format: floor-unit (e.g. 3-02)`,
        code: "INVALID_UNIT_NUMBER",
        statusCode: 400,
      });
    }

    const unit = await prisma.unit.create({
      data: {
        projectId, unitNumber, floor, type, area, basePrice: price, price, view, status: "NOT_RELEASED",
        ...(bathrooms !== undefined && { bathrooms }),
        ...(parkingSpaces !== undefined && { parkingSpaces }),
        ...(internalArea !== undefined && { internalArea }),
        ...(externalArea !== undefined && { externalArea }),
        ...(internalNotes && { internalNotes }),
        ...(tags && { tags }),
        ...(areaSqft !== undefined && { areaSqft }),
        ...(ratePerSqft !== undefined && { ratePerSqft }),
        ...(smartHome !== undefined && { smartHome }),
        ...(anticipatedCompletionDate && { anticipatedCompletionDate: new Date(anticipatedCompletionDate) }),
      },
    });
    res.status(201).json(unit);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({
        error: `Unit number "${req.body.unitNumber}" already exists in this project`,
        code: "UNIT_NUMBER_EXISTS",
        statusCode: 409,
      });
    }
    res.status(400).json({ error: error.message || "Failed to create unit", code: "CREATE_UNIT_ERROR", statusCode: 400 });
  }
});

// PATCH /:id — edit unit properties (NOT status — use /:id/status for that)
router.patch("/:id", validate(updateUnitSchema), async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const {
      type, area, price, view, floor, assignedAgentId,
      bathrooms, parkingSpaces, internalArea, externalArea,
      blockExpiresAt, internalNotes, tags, paymentPlan,
      areaSqft, ratePerSqft, smartHome, anticipatedCompletionDate,
    } = req.body;

    const unit = await prisma.unit.findUnique({ where: { id: req.params.id } });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found", code: "NOT_FOUND", statusCode: 404 });
    }

    const activeDeal = await prisma.deal.findFirst({ where: { unitId: req.params.id, isActive: true } });
    if (activeDeal && (type !== undefined || area !== undefined || price !== undefined || internalArea !== undefined || externalArea !== undefined)) {
      return res.status(409).json({
        error: `Unit has active deal ${activeDeal.dealNumber} — price, type, area, and physical data cannot be changed`,
        code: "UNIT_HAS_ACTIVE_DEAL",
        statusCode: 409,
      });
    }

    const data: any = {};
    if (type !== undefined) data.type = type;
    if (area !== undefined) data.area = area;
    if (view !== undefined) data.view = view;
    if (floor !== undefined) data.floor = floor;
    if (assignedAgentId !== undefined) data.assignedAgentId = assignedAgentId;
    if (bathrooms !== undefined) data.bathrooms = bathrooms;
    if (parkingSpaces !== undefined) data.parkingSpaces = parkingSpaces;
    if (internalArea !== undefined) data.internalArea = internalArea;
    if (externalArea !== undefined) data.externalArea = externalArea;
    if (blockExpiresAt !== undefined) data.blockExpiresAt = new Date(blockExpiresAt);
    if (internalNotes !== undefined) data.internalNotes = internalNotes;
    if (tags !== undefined) data.tags = tags;
    if (paymentPlan !== undefined) data.paymentPlan = paymentPlan || null;
    if (areaSqft !== undefined) data.areaSqft = areaSqft;
    if (ratePerSqft !== undefined) data.ratePerSqft = ratePerSqft;
    if (smartHome !== undefined) data.smartHome = smartHome;
    if (anticipatedCompletionDate !== undefined) {
      data.anticipatedCompletionDate = anticipatedCompletionDate ? new Date(anticipatedCompletionDate) : null;
    }

    if (price !== undefined && price !== unit.price) {
      data.price = price;
      await prisma.unitPriceHistory.create({
        data: { unitId: unit.id, oldPrice: unit.price, newPrice: price, changedBy: req.auth.userId, reason: "Manual price edit" },
      });
    }

    const updated = await prisma.unit.update({ where: { id: req.params.id }, data });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update unit", code: "UPDATE_UNIT_ERROR", statusCode: 400 });
  }
});

// DELETE /:id — delete unit (only if NOT_RELEASED or AVAILABLE, no deals)
router.delete("/:id", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const unit = await prisma.unit.findUnique({ where: { id: req.params.id }, include: { deals: true } });
    if (!unit) {
      return res.status(404).json({ error: "Unit not found", code: "NOT_FOUND", statusCode: 404 });
    }
    if (!["AVAILABLE", "NOT_RELEASED"].includes(unit.status)) {
      return res.status(409).json({ error: "Only AVAILABLE or NOT_RELEASED units can be deleted", code: "CANNOT_DELETE_UNIT", statusCode: 409 });
    }
    if (unit.deals.length > 0) {
      return res.status(409).json({ error: "Unit has associated deals and cannot be deleted", code: "UNIT_HAS_DEALS", statusCode: 409 });
    }

    await prisma.unit.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to delete unit", code: "DELETE_UNIT_ERROR", statusCode: 400 });
  }
});

// PATCH /:id/status — update unit status (deal-owned statuses blocked)
router.patch("/:id/status", validate(updateUnitStatusSchema), async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const { newStatus, reason } = req.body;

    if (isDealOwnedStatus(newStatus)) {
      return res.status(400).json({
        error: `Status "${newStatus}" is managed by the deal system and cannot be set manually`,
        code: "DEAL_OWNED_STATUS",
        statusCode: 400,
      });
    }

    if (newStatus === "BLOCKED" && !reason) {
      return res.status(400).json({ error: "A reason is required when blocking a unit", code: "REASON_REQUIRED", statusCode: 400 });
    }

    const updated = await updateUnitStatus(req.params.id, newStatus, req.auth.userId, reason);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update unit status", code: "UNIT_STATUS_UPDATE_ERROR", statusCode: 400 });
  }
});

// ============================================================================
// IMAGE MANAGEMENT
// ============================================================================

// POST /:id/images — upload image(s) for a unit
router.post("/:id/images", upload.single("file"), async (req, res) => {
  try {
    if (!req.auth?.userId) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const unit = await prisma.unit.findUnique({ where: { id: req.params.id } });
    if (!unit) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "Unit not found", code: "UNIT_NOT_FOUND", statusCode: 404 });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file provided", code: "NO_FILE", statusCode: 400 });
    }

    const { caption = "", type = "PHOTO" } = req.body;
    const maxSortOrder = await prisma.unitImage.aggregate({
      where: { unitId: req.params.id },
      _max: { sortOrder: true },
    });
    const nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;

    const imageUrl = `/uploads/units/${req.file.filename}`;
    const image = await prisma.unitImage.create({
      data: {
        unitId: req.params.id,
        url: imageUrl,
        caption,
        type,
        sortOrder: nextSortOrder,
      },
    });

    res.status(201).json(image);
  } catch (error: any) {
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
    }
    res.status(500).json({ error: error.message || "Failed to upload image", code: "IMAGE_UPLOAD_ERROR", statusCode: 500 });
  }
});

// DELETE /:id/images/:imageId — delete image
router.delete("/:id/images/:imageId", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const image = await prisma.unitImage.findUnique({
      where: { id: req.params.imageId },
    });

    if (!image) {
      return res.status(404).json({ error: "Image not found", code: "IMAGE_NOT_FOUND", statusCode: 404 });
    }

    if (image.unitId !== req.params.id) {
      return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN", statusCode: 403 });
    }

    const filePath = path.join(uploadsDir, path.basename(image.url));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.unitImage.delete({ where: { id: req.params.imageId } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete image", code: "IMAGE_DELETE_ERROR", statusCode: 500 });
  }
});

// PATCH /:id/images/:imageId — update image (caption, type, sortOrder)
router.patch("/:id/images/:imageId", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const { caption, type, sortOrder } = req.body;
    const image = await prisma.unitImage.findUnique({
      where: { id: req.params.imageId },
    });

    if (!image) {
      return res.status(404).json({ error: "Image not found", code: "IMAGE_NOT_FOUND", statusCode: 404 });
    }

    if (image.unitId !== req.params.id) {
      return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN", statusCode: 403 });
    }

    const updated = await prisma.unitImage.update({
      where: { id: req.params.imageId },
      data: {
        ...(caption !== undefined && { caption }),
        ...(type !== undefined && { type }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update image", code: "IMAGE_UPDATE_ERROR", statusCode: 500 });
  }
});

// GET /:id/activities — get all activities logged against a unit
router.get("/:id/activities", async (req, res) => {
  try {
    const activities = await prisma.activity.findMany({
      where: {
        OR: [{ unitId: req.params.id }, { siteVisitUnitId: req.params.id }],
      },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ data: activities });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch activities", code: "FETCH_ACTIVITIES_ERROR", statusCode: 500 });
  }
});

// POST /:id/activities — log an activity against a unit (optionally linked to a lead)
router.post("/:id/activities", async (req, res) => {
  try {
    const { type, summary, outcome, leadId } = req.body;
    if (!type || !summary) {
      return res.status(400).json({ error: "type and summary are required", code: "VALIDATION_ERROR", statusCode: 400 });
    }

    const activity = await prisma.activity.create({
      data: {
        unitId: req.params.id,
        leadId: leadId || null,
        siteVisitUnitId: type === "SITE_VISIT" ? req.params.id : null,
        type,
        summary,
        outcome: outcome || null,
        createdBy: req.auth?.userId || "dev-user-1",
      },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(201).json(activity);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to log activity", code: "LOG_ACTIVITY_ERROR", statusCode: 500 });
  }
});

// GET /:id/images — get all images for a unit (optional, for detailed fetching)
router.get("/:id/images", async (req, res) => {
  try {
    const images = await prisma.unitImage.findMany({
      where: { unitId: req.params.id },
      orderBy: { sortOrder: "asc" },
    });
    res.json({ data: images });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch images", code: "FETCH_IMAGES_ERROR", statusCode: 500 });
  }
});

export default router;
