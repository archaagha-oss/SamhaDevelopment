import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  createReservation,
  cancelReservation,
  convertReservationToDeal,
  getActiveReservation,
} from "../services/reservationService";

const router = Router();

const DEFAULT_RESERVATION_DAYS = 7;

// ── helpers ──────────────────────────────────────────────────────────────────

/** Safely cast prisma to any so we can access dynamic models (Reservation, ProjectConfig). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

async function getReservationDays(unitId: string): Promise<number> {
  try {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { projectId: true },
    });
    if (!unit) return DEFAULT_RESERVATION_DAYS;

    if (typeof db.projectConfig?.findUnique === "function") {
      const config = await db.projectConfig.findUnique({
        where: { projectId: unit.projectId },
        select: { reservationDays: true },
      });
      if (config?.reservationDays) return config.reservationDays;
    }
  } catch {
    // Schema migration may not have run yet — fall back to default
  }
  return DEFAULT_RESERVATION_DAYS;
}

// ── GET / — list reservations ────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    if (typeof db.reservation?.findMany !== "function") {
      return res.json({ data: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } });
    }

    const { status, unitId, leadId, page = "1", limit = "50" } = req.query;
    const pageNum  = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const skip     = (pageNum - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (status)  where.status  = status;
    if (unitId)  where.unitId  = unitId;
    if (leadId)  where.leadId  = leadId;

    const [total, data] = await Promise.all([
      db.reservation.count({ where }),
      db.reservation.findMany({
        where,
        include: {
          unit: { select: { unitNumber: true, status: true, askingPrice: true } },
          lead: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    res.json({
      data,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch reservations", code: "FETCH_RESERVATIONS_ERROR", statusCode: 500 });
  }
});

// ── GET /:id — single reservation ────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  try {
    if (typeof db.reservation?.findUnique !== "function") {
      return res.status(404).json({ error: "Reservation not found", code: "NOT_FOUND", statusCode: 404 });
    }

    const reservation = await db.reservation.findUnique({
      where: { id: req.params.id },
      include: {
        unit: true,
        lead: true,
      },
    });

    if (!reservation) {
      return res.status(404).json({ error: "Reservation not found", code: "NOT_FOUND", statusCode: 404 });
    }

    res.json(reservation);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch reservation", code: "FETCH_RESERVATION_ERROR", statusCode: 500 });
  }
});

// ── POST / — create reservation ───────────────────────────────────────────────

router.post("/", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const { unitId, leadId, notes } = req.body;

    if (!unitId || !leadId) {
      return res.status(400).json({
        error: "unitId and leadId are required",
        code: "VALIDATION_ERROR",
        statusCode: 400,
      });
    }

    const reservationDays = await getReservationDays(unitId);
    const projectConfig   = { reservationDays };

    const reservation = await createReservation(
      unitId,
      leadId,
      req.auth.userId,
      projectConfig,
      notes
    );

    res.status(201).json(reservation);
  } catch (error: any) {
    const statusCode = error.message?.includes("not available") ? 409 : 400;
    res.status(statusCode).json({
      error: error.message || "Failed to create reservation",
      code: "RESERVATION_CREATION_ERROR",
      statusCode,
    });
  }
});

// ── PATCH /:id/cancel — cancel reservation ───────────────────────────────────

router.patch("/:id/cancel", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const { reason } = req.body;
    const updated = await cancelReservation(req.params.id, req.auth.userId, reason);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({
      error: error.message || "Failed to cancel reservation",
      code: "RESERVATION_CANCEL_ERROR",
      statusCode: 400,
    });
  }
});

// ── PATCH /:id/convert — convert to deal ─────────────────────────────────────

router.patch("/:id/convert", async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Unauthorized", code: "UNAUTHENTICATED", statusCode: 401 });
    }

    const { salePrice, discount = 0, paymentPlanId, brokerCompanyId, brokerAgentId } = req.body;

    if (!salePrice || !paymentPlanId) {
      return res.status(400).json({
        error: "salePrice and paymentPlanId are required",
        code: "VALIDATION_ERROR",
        statusCode: 400,
      });
    }

    const deal = await convertReservationToDeal(
      req.params.id,
      { salePrice, discount, paymentPlanId, brokerCompanyId, brokerAgentId },
      req.auth.userId
    );

    res.status(201).json(deal);
  } catch (error: any) {
    res.status(400).json({
      error: error.message || "Failed to convert reservation to deal",
      code: "RESERVATION_CONVERT_ERROR",
      statusCode: 400,
    });
  }
});

// ── GET /unit/:unitId/active — active reservation for a unit ─────────────────

router.get("/unit/:unitId/active", async (req, res) => {
  try {
    const reservation = await getActiveReservation(req.params.unitId);
    if (!reservation) {
      return res.status(404).json({ error: "No active reservation", code: "NOT_FOUND", statusCode: 404 });
    }
    res.json(reservation);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch active reservation", code: "FETCH_RESERVATION_ERROR", statusCode: 500 });
  }
});

export default router;
