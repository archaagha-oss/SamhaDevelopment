import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { validate } from "../middleware/validation";
import { updateProjectConfigSchema } from "../schemas/validation";
import { prisma } from "../lib/prisma";

const router = Router();

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

// Get all projects
router.get("/", async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      include: { _count: { select: { units: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch projects", code: "FETCH_PROJECTS_ERROR", statusCode: 500 });
  }
});

// Get project with units
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
    if (!project) {
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
      },
    });
    res.status(201).json(project);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to create project", code: "PROJECT_CREATE_ERROR", statusCode: 400 });
  }
});

// Update project
router.patch("/:id", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const { name, location, description, totalUnits, totalFloors, projectStatus, handoverDate, launchDate, startDate, completionStatus, purpose, furnishing } = req.body;
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

    const project = await prisma.project.update({ where: { id: req.params.id }, data });
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
    if (!source) {
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

// Also include images in project GET /:id
router.delete("/:id", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }
    const project = await prisma.project.findUnique({ where: { id: req.params.id }, include: { units: true } });
    if (!project) {
      return res.status(404).json({ error: "Project not found", code: "NOT_FOUND", statusCode: 404 });
    }
    if (project.units.length > 0) {
      return res.status(400).json({ error: "Cannot delete project with units", code: "PROJECT_HAS_UNITS", statusCode: 400 });
    }
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to delete project", code: "PROJECT_DELETE_ERROR", statusCode: 400 });
  }
});

export default router;
