import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { documentService } from "../services/documentService";
import {
  isWellFormedToken,
  resolveShareToken,
  recordShareTokenView,
} from "../services/shareTokenService";

const router = Router();

// ────────────────────────────────────────────────────────────────────────────
// Per-token + per-IP rate limiter (60s window, 30 req max).
// Runs before DB validation so hostile IPs don't trigger DB lookups.
// ────────────────────────────────────────────────────────────────────────────
const PUBLIC_RATE_WINDOW_MS = 60_000;
const PUBLIC_RATE_LIMIT = 30;
const publicRateMap = new Map<string, { count: number; resetAt: number }>();

router.use((req, res, next) => {
  const ip = req.ip ?? "unknown";
  const token = (req.params.token as string | undefined) ?? extractTokenFromPath(req.path);
  const key = `${ip}:${token ?? ""}`;
  const now = Date.now();
  const entry = publicRateMap.get(key);
  if (!entry || now > entry.resetAt) {
    publicRateMap.set(key, { count: 1, resetAt: now + PUBLIC_RATE_WINDOW_MS });
    return next();
  }
  entry.count++;
  if (entry.count > PUBLIC_RATE_LIMIT) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests", code: "RATE_LIMITED", statusCode: 429 });
  }
  next();
});

function extractTokenFromPath(path: string): string | null {
  // Path is mounted at /public/share, so a child path like /u/<token>/... starts with /u/
  const m = path.match(/^\/u\/([^/]+)/);
  return m ? m[1] : null;
}

// Common headers for any public share response
function applyPublicHeaders(res: Response) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
}

// ────────────────────────────────────────────────────────────────────────────
// Token validation middleware — resolves :token and attaches req.share
// ────────────────────────────────────────────────────────────────────────────
async function requireValidShareToken(req: Request, res: Response, next: NextFunction) {
  const token = req.params.token;
  applyPublicHeaders(res);
  if (!isWellFormedToken(token)) {
    return res.status(404).json({ error: "Not found", code: "NOT_FOUND", statusCode: 404 });
  }
  try {
    const result = await resolveShareToken(token);
    if (result.status === "NOT_FOUND" || !result.row) {
      return res.status(404).json({ error: "Not found", code: "NOT_FOUND", statusCode: 404 });
    }
    if (result.status === "REVOKED") {
      return res.status(410).json({ error: "Share link revoked", code: "SHARE_REVOKED", statusCode: 410 });
    }
    if (result.status === "EXPIRED") {
      return res.status(410).json({ error: "Share link expired", code: "SHARE_EXPIRED", statusCode: 410 });
    }
    (req as any).share = {
      tokenRow: result.row,
      unitId: result.row.unitId,
      showPrice: result.row.showPrice,
    };
    next();
  } catch (err) {
    res.status(500).json({ error: "Failed to resolve share token", code: "SHARE_RESOLVE_ERROR", statusCode: 500 });
  }
}

// ────────────────────────────────────────────────────────────────────────────
// GET /public/share/u/:token — curated unit view
// ────────────────────────────────────────────────────────────────────────────
router.get("/u/:token", requireValidShareToken, async (req, res) => {
  const share = (req as any).share as { tokenRow: any; unitId: string; showPrice: boolean };
  try {
    const unit = await prisma.unit.findUnique({
      where: { id: share.unitId },
      select: {
        id: true,
        unitNumber: true,
        floor: true,
        type: true,
        area: true,
        view: true,
        bathrooms: true,
        parkingSpaces: true,
        internalArea: true,
        externalArea: true,
        price: true,
        projectId: true,
        images: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, url: true, caption: true, type: true, sortOrder: true },
        },
        project: {
          select: {
            id: true,
            name: true,
            location: true,
            projectStatus: true,
            completionStatus: true,
            handoverDate: true,
          },
        },
      },
    });
    if (!unit || !unit.project) {
      return res.status(404).json({ error: "Not found", code: "NOT_FOUND", statusCode: 404 });
    }

    const [documents, statusHistory, updates] = await Promise.all([
      prisma.document.findMany({
        where: {
          projectId: unit.projectId,
          visibility: "PUBLIC",
          softDeleted: false,
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          type: true,
          mimeType: true,
          uploadedAt: true,
        },
      }),
      prisma.projectStatusHistory.findMany({
        where: {
          projectId: unit.projectId,
          field: { in: ["projectStatus", "completionStatus", "handoverDate"] },
        },
        orderBy: { changedAt: "desc" },
        take: 20,
        select: {
          id: true,
          field: true,
          oldValue: true,
          newValue: true,
          changedAt: true,
        },
      }),
      prisma.projectUpdate.findMany({
        where: { projectId: unit.projectId, isPublic: true },
        orderBy: { publishedAt: "desc" },
        take: 20,
        include: {
          media: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, type: true, url: true, caption: true, sortOrder: true },
          },
        },
      }),
    ]);

    recordShareTokenView(share.tokenRow.id);

    const downloadPathFor = (docId: string) => `/public/share/u/${share.tokenRow.token}/documents/${docId}/download`;

    res.json({
      unit: {
        unitNumber: unit.unitNumber,
        floor: unit.floor,
        type: unit.type,
        area: unit.area,
        view: unit.view,
        bathrooms: unit.bathrooms,
        parkingSpaces: unit.parkingSpaces,
        internalArea: unit.internalArea,
        externalArea: unit.externalArea,
        price: share.showPrice ? unit.price : null,
        images: unit.images,
      },
      project: unit.project,
      documents: documents.map((d) => ({ ...d, downloadPath: downloadPathFor(d.id) })),
      statusHistory,
      updates: updates.map((u) => ({
        id: u.id,
        title: u.title,
        body: u.body,
        publishedAt: u.publishedAt,
        media: u.media,
      })),
      shareMeta: {
        showPrice: share.showPrice,
        expiresAt: share.tokenRow.expiresAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load shared unit", code: "PUBLIC_SHARE_ERROR", statusCode: 500 });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /public/share/u/:token/documents/:docId/download
// Issues a short-lived presigned S3 URL only if the doc is PUBLIC and belongs
// to the unit's project.
// ────────────────────────────────────────────────────────────────────────────
router.get("/u/:token/documents/:docId/download", requireValidShareToken, async (req, res) => {
  const share = (req as any).share as { unitId: string };
  try {
    const unit = await prisma.unit.findUnique({
      where: { id: share.unitId },
      select: { projectId: true },
    });
    if (!unit) {
      return res.status(404).json({ error: "Not found", code: "NOT_FOUND", statusCode: 404 });
    }
    const doc = await prisma.document.findUnique({
      where: { id: req.params.docId },
      select: { id: true, key: true, projectId: true, visibility: true, softDeleted: true },
    });
    if (
      !doc ||
      doc.softDeleted ||
      doc.visibility !== "PUBLIC" ||
      doc.projectId !== unit.projectId ||
      !doc.key
    ) {
      return res.status(404).json({ error: "Not found", code: "NOT_FOUND", statusCode: 404 });
    }
    const url = await documentService.generatePresignedUrl(doc.key, 600);
    res.json({ url, expiresIn: 600 });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate download URL", code: "PUBLIC_DOWNLOAD_ERROR", statusCode: 500 });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /public/share/u/:token/updates — paginated list of public updates
// ────────────────────────────────────────────────────────────────────────────
router.get("/u/:token/updates", requireValidShareToken, async (req, res) => {
  const share = (req as any).share as { unitId: string };
  try {
    const unit = await prisma.unit.findUnique({
      where: { id: share.unitId },
      select: { projectId: true },
    });
    if (!unit) {
      return res.status(404).json({ error: "Not found", code: "NOT_FOUND", statusCode: 404 });
    }
    const limit = Math.min(50, parseInt((req.query.limit as string) || "20", 10) || 20);
    const updates = await prisma.projectUpdate.findMany({
      where: { projectId: unit.projectId, isPublic: true },
      orderBy: { publishedAt: "desc" },
      take: limit,
      include: {
        media: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, type: true, url: true, caption: true, sortOrder: true },
        },
      },
    });
    res.json({
      data: updates.map((u) => ({
        id: u.id,
        title: u.title,
        body: u.body,
        publishedAt: u.publishedAt,
        media: u.media,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load updates", code: "PUBLIC_UPDATES_ERROR", statusCode: 500 });
  }
});

export default router;
