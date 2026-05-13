import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { validate } from "../middleware/validation";
import {
  updateProjectConfigSchema,
  upsertProjectBankAccountSchema,
  upsertProjectSpecificationsSchema,
} from "../schemas/validation";
import { prisma } from "../lib/prisma";
import { documentService } from "../services/documentService";

// Whitelist of SPA-particulars columns that pass through create/update.
const SPA_PROJECT_FIELDS = [
  "commercialLicense",
  "developerNumber",
  "developerAddress",
  "developerPhone",
  "developerEmail",
  "plotNumber",
  "buildingPermitRef",
  "buildingStructure",
  "masterDeveloper",
  "masterCommunity",
  "permittedUse",
] as const;

function pickSpaFields(body: any): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const key of SPA_PROJECT_FIELDS) {
    if (body[key] !== undefined) {
      const v = body[key];
      out[key] = v === "" || v === null ? null : v;
    }
  }
  return out;
}

const router = Router();

// ── Project document uploads (S3, mirrors deal-doc upload pattern) ──────────
const projectDocUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

// ── Project update media uploads (local disk; served via express.static) ────
const projectUpdateMediaDir = path.join(process.cwd(), "public", "uploads", "project-updates");
if (!fs.existsSync(projectUpdateMediaDir)) fs.mkdirSync(projectUpdateMediaDir, { recursive: true });

const projectUpdateMediaUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, projectUpdateMediaDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, "update-" + uniqueSuffix + path.extname(file.originalname));
    },
  }),
  fileFilter: (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"];
    if (ok.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG/PNG/WebP images or MP4/MOV videos are allowed"));
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

const projectUploadsDir = path.join(process.cwd(), "public", "uploads", "projects");
if (!fs.existsSync(projectUploadsDir)) fs.mkdirSync(projectUploadsDir, { recursive: true });

const projectUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, projectUploadsDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, "project-" + uniqueSuffix + path.extname(file.originalname));
    },
  }),
  fileFilter: (req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
  },
  limits: { fileSize: 15 * 1024 * 1024 },
});

// Get all projects (excludes soft-deleted).
router.get("/", async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { softDeleted: false },
      include: { _count: { select: { units: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch projects", code: "FETCH_PROJECTS_ERROR", statusCode: 500 });
  }
});

// Get project with units. Returns 404 on soft-deleted rows so deep-links
// to a deleted project don't quietly resurface stale data.
router.get("/:id", async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        units: { orderBy: [{ floor: "asc" }, { unitNumber: "asc" }] },
        images: { orderBy: { sortOrder: "asc" } },
        config: true,
      },
    });
    if (!project || project.softDeleted) {
      return res.status(404).json({ error: "Project not found", code: "NOT_FOUND", statusCode: 404 });
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch project", code: "FETCH_PROJECT_ERROR", statusCode: 500 });
  }
});

// Create project
router.post("/", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const { name, location, description, totalUnits, totalFloors, projectStatus, handoverDate, launchDate, startDate, completionStatus, purpose, furnishing } = req.body;
    const project = await prisma.project.create({
      data: {
        name,
        location,
        description: description || null,
        totalUnits,
        totalFloors: totalFloors || null,
        projectStatus: projectStatus || "ACTIVE",
        handoverDate: new Date(handoverDate),
        launchDate: launchDate ? new Date(launchDate) : null,
        startDate: startDate ? new Date(startDate) : null,
        completionStatus: completionStatus || "OFF_PLAN",
        purpose: purpose || "SALE",
        furnishing: furnishing || "UNFURNISHED",
        ...pickSpaFields(req.body),
      },
    });
    res.status(201).json(project);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to create project", code: "PROJECT_CREATE_ERROR", statusCode: 400 });
  }
});

// Update project — also writes ProjectStatusHistory rows for projectStatus,
// completionStatus, and handoverDate changes (mirrors UnitStatusHistory pattern).
router.patch("/:id", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const { name, location, description, totalUnits, totalFloors, projectStatus, handoverDate, launchDate, startDate, completionStatus, purpose, furnishing, reason } = req.body;
    const data: any = {};

    if (name !== undefined) data.name = name;
    if (location !== undefined) data.location = location;
    if (description !== undefined) data.description = description || null;
    if (totalFloors !== undefined) data.totalFloors = totalFloors || null;
    if (projectStatus !== undefined) data.projectStatus = projectStatus;
    if (handoverDate !== undefined) data.handoverDate = handoverDate ? new Date(handoverDate) : null;
    if (launchDate !== undefined) data.launchDate = launchDate ? new Date(launchDate) : null;
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
    if (completionStatus !== undefined) data.completionStatus = completionStatus;
    if (purpose !== undefined) data.purpose = purpose;
    if (furnishing !== undefined) data.furnishing = furnishing;

    // totalUnits is now editable — must be >= actual unit count
    if (totalUnits !== undefined) {
      const actualCount = await prisma.unit.count({ where: { projectId: req.params.id } });
      if (totalUnits < actualCount) {
        return res.status(400).json({
          error: `Cannot set Total Units below actual unit count (${actualCount})`,
          code: "TOTAL_UNITS_TOO_LOW",
          statusCode: 400,
        });
      }
      data.totalUnits = totalUnits;
    }

    Object.assign(data, pickSpaFields(req.body));

    const existing = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { projectStatus: true, completionStatus: true, handoverDate: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "Project not found", code: "NOT_FOUND", statusCode: 404 });
    }

    const project = await prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({ where: { id: req.params.id }, data });
      const writes: any[] = [];
      const changedBy = req.auth!.userId;
      const reasonStr = typeof reason === "string" && reason.length ? reason : null;

      if (data.projectStatus !== undefined && data.projectStatus !== existing.projectStatus) {
        writes.push({
          projectId: req.params.id,
          field: "projectStatus",
          oldValue: existing.projectStatus,
          newValue: data.projectStatus,
          oldProjectStatus: existing.projectStatus,
          newProjectStatus: data.projectStatus,
          changedBy,
          reason: reasonStr,
        });
      }
      if (data.completionStatus !== undefined && data.completionStatus !== existing.completionStatus) {
        writes.push({
          projectId: req.params.id,
          field: "completionStatus",
          oldValue: existing.completionStatus,
          newValue: data.completionStatus,
          oldCompletionStatus: existing.completionStatus,
          newCompletionStatus: data.completionStatus,
          changedBy,
          reason: reasonStr,
        });
      }
      if (data.handoverDate !== undefined) {
        const oldIso = existing.handoverDate ? existing.handoverDate.toISOString() : null;
        const newIso = data.handoverDate ? (data.handoverDate as Date).toISOString() : null;
        if (oldIso !== newIso) {
          writes.push({
            projectId: req.params.id,
            field: "handoverDate",
            oldValue: oldIso,
            newValue: newIso ?? "",
            oldHandoverDate: existing.handoverDate,
            newHandoverDate: data.handoverDate ?? null,
            changedBy,
            reason: reasonStr,
          });
        }
      }
      if (writes.length) {
        await tx.projectStatusHistory.createMany({ data: writes });
      }
      return updated;
    });


    res.json(project);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update project", code: "PROJECT_UPDATE_ERROR", statusCode: 400 });
  }
});

// Clone project
router.post("/:id/clone", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const source = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: { config: true, units: true },
    });
    if (!source || source.softDeleted) {
      return res.status(404).json({ error: "Project not found", code: "NOT_FOUND", statusCode: 404 });
    }

    const newName = req.body.name || `${source.name} (Copy)`;
    const includeUnits = req.body.includeUnits === true;

    const newProject = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: newName,
          location: source.location,
          description: source.description,
          totalUnits: source.totalUnits,
          totalFloors: source.totalFloors,
          projectStatus: "ACTIVE",
          handoverDate: source.handoverDate,
          launchDate: source.launchDate,
          startDate: source.startDate,
        },
      });

      if (source.config) {
        await tx.projectConfig.create({
          data: {
            projectId: project.id,
            dldPercent: source.config.dldPercent,
            adminFee: source.config.adminFee,
            reservationDays: source.config.reservationDays,
            oqoodDays: source.config.oqoodDays,
            vatPercent: source.config.vatPercent,
            agencyFeePercent: source.config.agencyFeePercent,
            unitsPerFloor: source.config.unitsPerFloor,
          },
        });
      }

      if (includeUnits && source.units.length > 0) {
        await tx.unit.createMany({
          data: source.units.map((u) => ({
            projectId: project.id,
            unitNumber: u.unitNumber,
            floor: u.floor,
            type: u.type,
            area: u.area,
            basePrice: u.basePrice,
            price: u.price,
            view: u.view,
            status: "NOT_RELEASED" as const,
          })),
          skipDuplicates: true,
        });
      }

      return project;
    });

    res.status(201).json(newProject);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to clone project", code: "PROJECT_CLONE_ERROR", statusCode: 400 });
  }
});

// GET /:id/summary — inventory KPIs for a project
router.get("/:id/summary", async (req, res) => {
  try {
    const units = await prisma.unit.findMany({
      where: { projectId: req.params.id },
      select: { status: true, price: true, area: true },
    });

    if (!units.length) {
      return res.json({
        total: 0, byStatus: {}, totalValue: 0, soldValue: 0,
        remainingValue: 0, avgPricePerSqft: 0, absorptionPct: 0, releasedPct: 0,
      });
    }

    const byStatus: Record<string, number> = {};
    let totalValue = 0;
    let soldValue = 0;
    let releasedCount = 0;
    let soldCount = 0;
    const sqftPrices: number[] = [];

    for (const u of units) {
      byStatus[u.status] = (byStatus[u.status] || 0) + 1;
      totalValue += u.price;
      if (u.status === "SOLD" || u.status === "HANDED_OVER") {
        soldValue += u.price;
        soldCount++;
      }
      if (u.status !== "NOT_RELEASED") releasedCount++;
      if (u.area > 0) sqftPrices.push(u.price / (u.area * 10.764));
    }

    const total = units.length;
    const availableCount = byStatus["AVAILABLE"] || 0;
    const remainingValue = (availableCount * totalValue) / total;
    const avgPricePerSqft = sqftPrices.length
      ? Math.round(sqftPrices.reduce((a, b) => a + b, 0) / sqftPrices.length)
      : 0;

    res.json({
      total,
      byStatus,
      totalValue: Math.round(totalValue),
      soldValue: Math.round(soldValue),
      remainingValue: Math.round(remainingValue),
      avgPricePerSqft,
      absorptionPct: total > 0 ? Math.round((soldCount / total) * 100) : 0,
      releasedPct: total > 0 ? Math.round((releasedCount / total) * 100) : 0,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch project summary", code: "FETCH_SUMMARY_ERROR", statusCode: 500 });
  }
});

// GET /:id/config — fetch project configuration
// Uses upsert so Prisma fills in schema defaults on first access (schema is single source of truth)
router.get("/:id/config", async (req, res) => {
  try {
    const config = await prisma.projectConfig.upsert({
      where: { projectId: req.params.id },
      create: { projectId: req.params.id },
      update: {},
    });
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch project config", code: "FETCH_CONFIG_ERROR", statusCode: 500 });
  }
});

// PATCH /:id/config — upsert project configuration
router.patch("/:id/config", validate(updateProjectConfigSchema), async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const config = await prisma.projectConfig.upsert({
      where: { projectId: req.params.id },
      create: { projectId: req.params.id, ...req.body },
      update: req.body,
    });
    res.json(config);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to save project config", code: "SAVE_CONFIG_ERROR", statusCode: 400 });
  }
});

// ----- Project bank accounts (SPA Particulars Items IX & X) ----------------

router.get("/:id/bank-accounts", async (req, res) => {
  try {
    const accounts = await prisma.projectBankAccount.findMany({
      where: { projectId: req.params.id },
      orderBy: { purpose: "asc" },
    });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bank accounts", code: "FETCH_BANK_ACCOUNTS_ERROR", statusCode: 500 });
  }
});

// PUT /:id/bank-accounts — upsert by purpose (one ESCROW + one CURRENT per project).
router.put("/:id/bank-accounts", validate(upsertProjectBankAccountSchema), async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const account = await prisma.projectBankAccount.upsert({
      where: {
        projectId_purpose: {
          projectId: req.params.id,
          purpose: req.body.purpose,
        },
      },
      create: { projectId: req.params.id, ...req.body },
      update: req.body,
    });
    res.json(account);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to save bank account", code: "SAVE_BANK_ACCOUNT_ERROR", statusCode: 400 });
  }
});

router.delete("/:id/bank-accounts/:purpose", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const purpose = req.params.purpose;
    if (purpose !== "ESCROW" && purpose !== "CURRENT") {
      return res.status(400).json({ error: "purpose must be ESCROW or CURRENT", code: "INVALID_PURPOSE", statusCode: 400 });
    }
    await prisma.projectBankAccount.delete({
      where: { projectId_purpose: { projectId: req.params.id, purpose } },
    });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message, code: "DELETE_BANK_ACCOUNT_ERROR", statusCode: 400 });
  }
});

// ----- Project specifications (SPA Schedule 2) -----------------------------

router.get("/:id/specifications", async (req, res) => {
  try {
    const specs = await prisma.projectSpecification.findMany({
      where: { projectId: req.params.id },
      orderBy: { sortOrder: "asc" },
    });
    res.json(specs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch specifications", code: "FETCH_SPECS_ERROR", statusCode: 500 });
  }
});

// PUT /:id/specifications — replace the project's spec table in one shot.
// Bulk replace keeps the editor UX simple (one Save button, no row-level state).
router.put("/:id/specifications", validate(upsertProjectSpecificationsSchema), async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const projectId = req.params.id;
    const incoming = req.body.specifications as Array<{
      area: string;
      floorFinish?: string | null;
      wallFinish?: string | null;
      ceilingFinish?: string | null;
      additionalFinishes?: string | null;
      sortOrder?: number;
    }>;

    await prisma.$transaction([
      prisma.projectSpecification.deleteMany({ where: { projectId } }),
      ...incoming.map((s, idx) =>
        prisma.projectSpecification.create({
          data: {
            projectId,
            area: s.area as any,
            floorFinish: s.floorFinish ?? null,
            wallFinish: s.wallFinish ?? null,
            ceilingFinish: s.ceilingFinish ?? null,
            additionalFinishes: s.additionalFinishes ?? null,
            sortOrder: s.sortOrder ?? idx,
          },
        })
      ),
    ]);

    const specs = await prisma.projectSpecification.findMany({
      where: { projectId },
      orderBy: { sortOrder: "asc" },
    });
    res.json(specs);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to save specifications", code: "SAVE_SPECS_ERROR", statusCode: 400 });
  }
});

// Delete project (only if no units)
// GET /:id/images
router.get("/:id/images", async (req, res) => {
  try {
    const images = await prisma.projectImage.findMany({
      where: { projectId: req.params.id },
      orderBy: { sortOrder: "asc" },
    });
    res.json({ data: images });
  } catch {
    res.status(500).json({ error: "Failed to fetch images" });
  }
});

// POST /:id/images
router.post("/:id/images", projectUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    const { caption = "" } = req.body;
    const max = await prisma.projectImage.aggregate({ where: { projectId: req.params.id }, _max: { sortOrder: true } });
    const image = await prisma.projectImage.create({
      data: {
        projectId: req.params.id,
        url: `/uploads/projects/${req.file.filename}`,
        caption: caption || null,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
    res.status(201).json(image);
  } catch (error: any) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: error.message || "Failed to upload image" });
  }
});

// DELETE /:id/images/:imageId
router.delete("/:id/images/:imageId", async (req, res) => {
  try {
    const image = await prisma.projectImage.findUnique({ where: { id: req.params.imageId } });
    if (!image || image.projectId !== req.params.id) return res.status(404).json({ error: "Image not found" });
    const filePath = path.join(projectUploadsDir, path.basename(image.url));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await prisma.projectImage.delete({ where: { id: req.params.imageId } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete image" });
  }
});

// ============================================================================
// PROJECT DOCUMENTS — propagate to child units via union endpoint on units
// ============================================================================

router.get("/:id/documents", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const where: any = { projectId: req.params.id, softDeleted: false };
    if (req.query.visibility) where.visibility = req.query.visibility;
    const docs = await prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        mimeType: true,
        visibility: true,
        contractStatus: true,
        expiryDate: true,
        uploadedAt: true,
        createdAt: true,
      },
    });
    res.json({ data: docs });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch project documents", code: "FETCH_PROJECT_DOCS_ERROR", statusCode: 500 });
  }
});

router.post("/:id/documents/upload", projectDocUpload.single("file"), async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file provided", code: "NO_FILE", statusCode: 400 });
    }
    const project = await prisma.project.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!project) {
      return res.status(404).json({ error: "Project not found", code: "NOT_FOUND", statusCode: 404 });
    }
    const { name, type = "OTHER", visibility = "INTERNAL" } = req.body ?? {};
    if (!["INTERNAL", "PUBLIC"].includes(visibility)) {
      return res.status(400).json({ error: "Invalid visibility", code: "VALIDATION_ERROR", statusCode: 400 });
    }
    const { key } = await documentService.uploadFile(req.file, { scope: "project", id: req.params.id });
    const created = await prisma.document.create({
      data: {
        projectId: req.params.id,
        type: type as any,
        source: "UPLOADED",
        visibility: visibility as any,
        name: name || req.file.originalname,
        key,
        mimeType: req.file.mimetype,
        uploadedBy: req.auth.userId,
      },
    });
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to upload project document", code: "PROJECT_DOC_UPLOAD_ERROR", statusCode: 500 });
  }
});

router.patch("/:id/documents/:docId", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const existing = await prisma.document.findUnique({ where: { id: req.params.docId } });
    if (!existing || existing.projectId !== req.params.id) {
      return res.status(404).json({ error: "Document not found", code: "DOC_NOT_FOUND", statusCode: 404 });
    }
    const { visibility, name } = req.body ?? {};
    const data: any = {};
    if (visibility !== undefined) {
      if (!["INTERNAL", "PUBLIC"].includes(visibility)) {
        return res.status(400).json({ error: "Invalid visibility", code: "VALIDATION_ERROR", statusCode: 400 });
      }
      data.visibility = visibility;
    }
    if (name !== undefined) data.name = name;
    const updated = await prisma.document.update({ where: { id: req.params.docId }, data });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update document", code: "PROJECT_DOC_UPDATE_ERROR", statusCode: 500 });
  }
});

router.delete("/:id/documents/:docId", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const existing = await prisma.document.findUnique({ where: { id: req.params.docId } });
    if (!existing || existing.projectId !== req.params.id) {
      return res.status(404).json({ error: "Document not found", code: "DOC_NOT_FOUND", statusCode: 404 });
    }
    if (existing.key) {
      try { await documentService.deleteFile(existing.key); } catch { /* best effort */ }
    }
    await prisma.document.delete({ where: { id: req.params.docId } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete document", code: "PROJECT_DOC_DELETE_ERROR", statusCode: 500 });
  }
});

// ============================================================================
// PROJECT STATUS HISTORY
// ============================================================================

router.get("/:id/status-history", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const limit = Math.min(200, parseInt((req.query.limit as string) || "50", 10) || 50);
    const data = await prisma.projectStatusHistory.findMany({
      where: { projectId: req.params.id },
      orderBy: { changedAt: "desc" },
      take: limit,
    });
    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch status history", code: "FETCH_STATUS_HISTORY_ERROR", statusCode: 500 });
  }
});

// ============================================================================
// PROJECT UPDATES — manually-posted updates with photos/videos
// ============================================================================

router.get("/:id/updates", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const updates = await prisma.projectUpdate.findMany({
      where: { projectId: req.params.id },
      orderBy: { publishedAt: "desc" },
      include: {
        media: { orderBy: { sortOrder: "asc" } },
      },
    });
    res.json({ data: updates });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch updates", code: "FETCH_UPDATES_ERROR", statusCode: 500 });
  }
});

router.post("/:id/updates", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const project = await prisma.project.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!project) {
      return res.status(404).json({ error: "Project not found", code: "NOT_FOUND", statusCode: 404 });
    }
    const { title, body, isPublic = true } = req.body ?? {};
    if (!title || !body) {
      return res.status(400).json({ error: "title and body are required", code: "VALIDATION_ERROR", statusCode: 400 });
    }
    const created = await prisma.projectUpdate.create({
      data: {
        projectId: req.params.id,
        title,
        body,
        isPublic: Boolean(isPublic),
        createdBy: req.auth.userId,
      },
      include: { media: true },
    });
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create update", code: "CREATE_UPDATE_ERROR", statusCode: 500 });
  }
});

router.patch("/:id/updates/:updateId", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const existing = await prisma.projectUpdate.findUnique({ where: { id: req.params.updateId } });
    if (!existing || existing.projectId !== req.params.id) {
      return res.status(404).json({ error: "Update not found", code: "UPDATE_NOT_FOUND", statusCode: 404 });
    }
    const { title, body, isPublic } = req.body ?? {};
    const data: any = {};
    if (title !== undefined) data.title = title;
    if (body !== undefined) data.body = body;
    if (isPublic !== undefined) data.isPublic = Boolean(isPublic);
    const updated = await prisma.projectUpdate.update({
      where: { id: req.params.updateId },
      data,
      include: { media: { orderBy: { sortOrder: "asc" } } },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update", code: "UPDATE_PATCH_ERROR", statusCode: 500 });
  }
});

router.delete("/:id/updates/:updateId", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const existing = await prisma.projectUpdate.findUnique({
      where: { id: req.params.updateId },
      include: { media: true },
    });
    if (!existing || existing.projectId !== req.params.id) {
      return res.status(404).json({ error: "Update not found", code: "UPDATE_NOT_FOUND", statusCode: 404 });
    }
    for (const m of existing.media) {
      if (m.storage === "LOCAL" && m.url.startsWith("/uploads/project-updates/")) {
        const filePath = path.join(projectUpdateMediaDir, path.basename(m.url));
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch { /* best effort */ }
        }
      }
    }
    await prisma.projectUpdate.delete({ where: { id: req.params.updateId } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete update", code: "DELETE_UPDATE_ERROR", statusCode: 500 });
  }
});

router.post("/:id/updates/:updateId/media", projectUpdateMediaUpload.single("file"), async (req, res) => {
  try {
    if (!req.auth?.userId) {
      if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const existing = await prisma.projectUpdate.findUnique({ where: { id: req.params.updateId } });
    if (!existing || existing.projectId !== req.params.id) {
      if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(404).json({ error: "Update not found", code: "UPDATE_NOT_FOUND", statusCode: 404 });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file provided", code: "NO_FILE", statusCode: 400 });
    }
    const max = await prisma.projectUpdateMedia.aggregate({
      where: { updateId: req.params.updateId },
      _max: { sortOrder: true },
    });
    const isVideo = req.file.mimetype.startsWith("video/");
    const created = await prisma.projectUpdateMedia.create({
      data: {
        updateId: req.params.updateId,
        type: isVideo ? "VIDEO" : "PHOTO",
        url: `/uploads/project-updates/${req.file.filename}`,
        storage: "LOCAL",
        caption: req.body?.caption || null,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
    res.status(201).json(created);
  } catch (error: any) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: error.message || "Failed to upload media", code: "UPLOAD_MEDIA_ERROR", statusCode: 500 });
  }
});

router.delete("/:id/updates/:updateId/media/:mediaId", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const media = await prisma.projectUpdateMedia.findUnique({
      where: { id: req.params.mediaId },
      include: { update: true },
    });
    if (!media || media.update.projectId !== req.params.id || media.updateId !== req.params.updateId) {
      return res.status(404).json({ error: "Media not found", code: "MEDIA_NOT_FOUND", statusCode: 404 });
    }
    if (media.storage === "LOCAL" && media.url.startsWith("/uploads/project-updates/")) {
      const filePath = path.join(projectUpdateMediaDir, path.basename(media.url));
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch { /* best effort */ }
      }
    }
    await prisma.projectUpdateMedia.delete({ where: { id: req.params.mediaId } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete media", code: "DELETE_MEDIA_ERROR", statusCode: 500 });
  }
});

// Soft-delete a project. Sets softDeleted=true rather than removing the row
// so the audit trail survives. Still blocked while units exist — the caller
// must clean up inventory first (intentional friction; we don't want one
// click to orphan dozens of units).
router.delete("/:id", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const project = await prisma.project.findUnique({ where: { id: req.params.id }, include: { units: true } });
    if (!project || project.softDeleted) {
      return res.status(404).json({ error: "Project not found", code: "NOT_FOUND", statusCode: 404 });
    }
    if (project.units.length > 0) {
      return res.status(400).json({ error: "Cannot delete project with units", code: "PROJECT_HAS_UNITS", statusCode: 400 });
    }
    // Name is @unique. Suffix the soft-deleted row so the original name is
    // free for a brand-new project. The original is preserved in the audit
    // log via the suffix itself ("Marina Tower (deleted 2026-05-13)").
    const suffix = ` (deleted ${new Date().toISOString().slice(0, 10)})`;
    await prisma.project.update({
      where: { id: req.params.id },
      data:  {
        softDeleted: true,
        name: project.name.endsWith(suffix) ? project.name : project.name + suffix,
      },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to delete project", code: "PROJECT_DELETE_ERROR", statusCode: 400 });
  }
});

export default router;
