import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireFinanceAccess, requireAuthentication } from "../middleware/auth";
import { commissionLogger } from "../lib/logger";

const router = Router();
router.use(requireAuthentication);

// Get commission for deal
router.get("/deal/:dealId", async (req, res) => {
  try {
    const commission = await prisma.commission.findUnique({
      where: { dealId: req.params.dealId },
      include: { deal: { include: { lead: true, unit: true } } },
    });

    res.json(commission);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch commission",
      code: "FETCH_COMMISSION_ERROR",
      statusCode: 500,
    });
  }
});

// Get all commissions with filters
router.get("/", async (req, res) => {
  try {
    const { status, brokerCompanyId, page = "1", limit = "50" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const skip = (pageNum - 1) * pageSize;

    const where: any = {};
    if (status) where.status = status;
    if (brokerCompanyId) where.brokerCompanyId = brokerCompanyId;

    const total = await prisma.commission.count({ where });

    const commissions = await prisma.commission.findMany({
      where,
      include: {
        deal: { include: { lead: true, unit: true } },
        brokerCompany: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    res.json({
      data: commissions,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch commissions",
      code: "FETCH_COMMISSIONS_ERROR",
      statusCode: 500,
    });
  }
});

// GET /pending — CommissionDashboard pending approvals list
router.get("/pending", async (req, res) => {
  try {
    const commissions = await prisma.commission.findMany({
      where: { status: "PENDING_APPROVAL" },
      include: {
        deal: { include: { lead: true, unit: true } },
        brokerCompany: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(commissions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pending commissions", code: "FETCH_PENDING_ERROR", statusCode: 500 });
  }
});

// GET /stats — CommissionDashboard KPI cards
router.get("/stats", async (req, res) => {
  try {
    const groups = await prisma.commission.groupBy({
      by: ["status"],
      _count: { id: true },
      _sum: { amount: true },
    });
    const stats: Record<string, { count: number; total: number }> = {};
    groups.forEach((g) => {
      stats[g.status] = { count: g._count.id, total: g._sum.amount || 0 };
    });
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch commission stats", code: "FETCH_STATS_ERROR", statusCode: 500 });
  }
});

// PATCH /:id/approve — FINANCE or ADMIN only
router.patch("/:id/approve", requireFinanceAccess, async (req, res) => {
  try {
    const resolvedUser = (req as any).resolvedUser as { id: string; name: string; role: string } | undefined;
    // requireFinanceAccess attaches resolvedUser when the role check passes.
    // If we land here without one, the middleware contract has been broken —
    // refuse rather than silently writing approvedBy=null and losing the audit
    // trail of who signed off on the commission.
    if (!resolvedUser?.id) {
      commissionLogger.error("Commission approve: missing resolvedUser despite passing requireFinanceAccess", {
        commissionId: req.params.id,
      });
      return res.status(500).json({
        error: "Approver identity could not be resolved. Please retry; if this persists, contact an administrator.",
        code: "APPROVER_UNRESOLVED",
        statusCode: 500,
      });
    }

    const commission = await prisma.commission.findUnique({
      where: { id: req.params.id },
      include: { deal: { select: { spaSignedDate: true, oqoodRegisteredDate: true } } },
    });
    if (!commission) {
      return res.status(404).json({ error: "Commission not found", code: "NOT_FOUND", statusCode: 404 });
    }
    if (commission.status !== "PENDING_APPROVAL") {
      return res.status(400).json({ error: `Commission is ${commission.status}, not PENDING_APPROVAL`, code: "INVALID_STATUS", statusCode: 400 });
    }

    // Two-gate lock: both SPA signed and Oqood registered must be on record
    const spaOk   = !!commission.deal?.spaSignedDate;
    const oqoodOk = !!commission.deal?.oqoodRegisteredDate;
    if (!spaOk || !oqoodOk) {
      const missing = [!spaOk && "SPA signing", !oqoodOk && "Oqood registration"].filter(Boolean).join(", ");
      return res.status(400).json({
        error: `Commission cannot be approved until both gates are met. Missing: ${missing}`,
        code: "COMMISSION_GATES_NOT_MET",
        statusCode: 400,
        gates: { spaSignedMet: spaOk, oqoodMet: oqoodOk },
      });
    }
    const updated = await prisma.commission.update({
      where: { id: req.params.id },
      data: {
        status: "APPROVED",
        approvedBy: resolvedUser.id,
        approvedDate: new Date(),
      },
    });
    commissionLogger.info("Commission approved", {
      commissionId: updated.id, dealId: updated.dealId,
      amount: updated.amount, approvedBy: resolvedUser.id, approverName: resolvedUser.name,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to approve commission", code: "APPROVE_ERROR", statusCode: 500 });
  }
});

// Mark commission as paid — FINANCE or ADMIN only
router.patch("/:id/paid", requireFinanceAccess, async (req, res) => {
  try {
    const commission = await prisma.commission.findUnique({ where: { id: req.params.id } });
    if (!commission) {
      return res.status(404).json({ error: "Commission not found", code: "NOT_FOUND", statusCode: 404 });
    }
    if (commission.status === "PAID") {
      return res.status(400).json({ error: "Commission is already paid", code: "ALREADY_PAID", statusCode: 400 });
    }
    const { paidAmount, paidVia, receiptKey } = req.body;

    // Resolve and validate the amount we're about to record. The amount is
    // money — we refuse anything that isn't a finite, non-negative number, and
    // we reject overpayments since approving > commission.amount can hide an
    // off-by-one or stale UI state.
    let resolvedPaidAmount = Number(commission.amount);
    if (paidAmount !== undefined && paidAmount !== null && paidAmount !== "") {
      const parsed = typeof paidAmount === "number" ? paidAmount : Number(paidAmount);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({
          error: "paidAmount must be a finite number",
          code: "INVALID_PAID_AMOUNT",
          statusCode: 400,
        });
      }
      if (parsed < 0) {
        return res.status(400).json({
          error: "paidAmount must be non-negative",
          code: "INVALID_PAID_AMOUNT",
          statusCode: 400,
        });
      }
      if (parsed > Number(commission.amount) + 0.005) {
        return res.status(400).json({
          error: `paidAmount (${parsed}) exceeds approved commission amount (${commission.amount})`,
          code: "PAID_AMOUNT_EXCEEDS_APPROVED",
          statusCode: 400,
        });
      }
      resolvedPaidAmount = parsed;
    }

    const updated = await prisma.commission.update({
      where: { id: req.params.id },
      data: {
        status: "PAID",
        paidDate: new Date(),
        paidAmount: resolvedPaidAmount,
        paidVia: paidVia || null,
        receiptKey: receiptKey || null,
      },
    });
    commissionLogger.info("Commission paid", {
      commissionId: updated.id, dealId: updated.dealId,
      paidAmount: updated.paidAmount, paidVia: updated.paidVia,
    });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to mark commission as paid", code: "COMMISSION_UPDATE_ERROR", statusCode: 400 });
  }
});

export default router;
