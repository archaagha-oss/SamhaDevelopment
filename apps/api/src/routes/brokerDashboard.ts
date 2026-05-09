import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuthentication } from "../middleware/auth";

/**
 * Broker Dashboard API Endpoints
 * Role-based access:
 * - BROKER_AGENT: Own commissions only
 * - BROKER_MANAGER: Company commissions
 * - FINANCE/ADMIN: All commissions with approval rights
 */

const router = Router();
router.use(requireAuthentication);

// ===== COMMISSION SUMMARY FOR DASHBOARD =====

/**
 * GET /api/broker-dashboard/commission-summary
 * Returns commission metrics filtered by user role
 */
router.get("/commission-summary", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.userId;
    const userRole = (req as any).auth?.role;

    // Get user's broker context
    let brokerAgentId: string | null = null;
    let brokerCompanyId: string | null = null;

    if (userRole === "BROKER_AGENT") {
      const agent = await prisma.brokerAgent.findFirst({
        where: { userId } as any,
        select: { id: true, companyId: true },
      });
      brokerAgentId = agent?.id || null;
      brokerCompanyId = agent?.companyId || null;
    } else if (userRole === "BROKER_MANAGER") {
      const agent = await prisma.brokerAgent.findFirst({
        where: { userId } as any,
        select: { companyId: true },
      });
      brokerCompanyId = agent?.companyId || null;
    }

    // Build query based on role
    const commissionWhere =
      userRole === "BROKER_AGENT" && brokerAgentId
        ? { deal: { brokerAgentId } }
        : userRole === "BROKER_MANAGER" && brokerCompanyId
          ? { deal: { brokerCompanyId } }
          : {};

    // Fetch commission data
    const [totalEarned, approved, pending, paid] = await Promise.all([
      prisma.commission.aggregate({
        _sum: { amount: true },
        where: commissionWhere,
      }),
      prisma.commission.aggregate({
        _sum: { amount: true },
        where: {
          ...commissionWhere,
          status: "APPROVED",
        },
      }),
      prisma.commission.aggregate({
        _sum: { amount: true },
        where: {
          ...commissionWhere,
          status: "PENDING_APPROVAL",
        },
      }),
      prisma.commission.aggregate({
        _sum: { amount: true },
        where: {
          ...commissionWhere,
          status: "PAID",
        },
      }),
    ]);

    // Count deals
    const dealWhere = userRole === "BROKER_AGENT" && brokerAgentId
      ? { brokerAgentId }
      : userRole === "BROKER_MANAGER" && brokerCompanyId
        ? { brokerCompanyId }
        : {};

    const [totalDeals, approvedDeals, pendingDeals, paidDeals] = await Promise.all([
      prisma.deal.count({ where: { ...dealWhere, stage: { not: "CANCELLED" } } }),
      prisma.deal.count({
        where: {
          ...dealWhere,
          commission: { status: "APPROVED" },
          stage: { not: "CANCELLED" },
        },
      }),
      prisma.deal.count({
        where: {
          ...dealWhere,
          commission: { status: "PENDING_APPROVAL" },
          stage: { not: "CANCELLED" },
        },
      }),
      prisma.deal.count({
        where: {
          ...dealWhere,
          commission: { status: "PAID" },
          stage: { not: "CANCELLED" },
        },
      }),
    ]);

    res.json({
      summary: {
        totalEarned: totalEarned._sum.amount || 0,
        approved: approved._sum.amount || 0,
        pending: pending._sum.amount || 0,
        paid: paid._sum.amount || 0,
        totalDeals,
        approvedDeals,
        pendingDeals,
        paidDeals,
      },
    });
  } catch (error) {
    console.error("Commission summary error:", error);
    res.status(500).json({ error: "Failed to fetch commission summary" });
  }
});

// ===== COMMISSION UNLOCK STATUS =====

/**
 * GET /api/broker-dashboard/unlock-status
 * Returns deals with commission unlock conditions (waiting for SPA, Oqood, etc.)
 */
router.get("/unlock-status", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.userId;
    const userRole = (req as any).auth?.role;

    // Build query filter
    let whereClause: any = {};

    if (userRole === "BROKER_AGENT") {
      const agent = await prisma.brokerAgent.findFirst({
        where: { userId } as any,
        select: { id: true },
      });
      if (agent) whereClause = { brokerAgentId: agent.id };
    } else if (userRole === "BROKER_MANAGER") {
      const agent = await prisma.brokerAgent.findFirst({
        where: { userId } as any,
        select: { companyId: true },
      });
      if (agent) whereClause = { brokerCompanyId: agent.companyId };
    }

    const deals = await prisma.deal.findMany({
      where: {
        ...whereClause,
        stage: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      select: {
        id: true,
        dealNumber: true,
        stage: true,
        spaSignedDate: true,
        oqoodRegisteredDate: true,
        oqoodDeadline: true,
        lead: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        unit: {
          select: {
            unitNumber: true,
          },
        },
        commission: {
          select: {
            id: true,
            status: true,
            amount: true,
          },
        },
      },
    });

    // Determine unlock status for each deal
    const withStatus = deals.map((deal) => {
      let unlockStatus = "LOCKED";
      let unlockReason = "";

      if (deal.stage === "SPA_SIGNED" || deal.stage === "OQOOD_PENDING" || deal.stage === "OQOOD_REGISTERED" || deal.stage.includes("INSTALLMENTS") || deal.stage === "HANDOVER_PENDING") {
        if (deal.spaSignedDate && deal.oqoodRegisteredDate) {
          unlockStatus = "UNLOCKED";
          unlockReason = "Ready for approval";
        } else if (deal.spaSignedDate && !deal.oqoodRegisteredDate) {
          unlockStatus = "PENDING";
          unlockReason = "Waiting for Oqood registration";
        } else if (!deal.spaSignedDate && deal.stage.includes("SPA")) {
          unlockStatus = "PENDING";
          unlockReason = "Waiting for SPA signature";
        }
      } else {
        unlockStatus = "NOT_DUE";
        unlockReason = `Waiting for ${deal.stage.replace(/_/g, " ")}`;
      }

      return {
        id: deal.id,
        dealNumber: deal.dealNumber,
        stage: deal.stage,
        leadName: `${deal.lead.firstName} ${deal.lead.lastName}`,
        unitNumber: deal.unit.unitNumber,
        unlockStatus,
        unlockReason,
        spaSignedDate: deal.spaSignedDate,
        oqoodRegisteredDate: deal.oqoodRegisteredDate,
        oqoodDeadline: deal.oqoodDeadline,
        commission: deal.commission || null,
      };
    });

    res.json({ data: withStatus });
  } catch (error) {
    console.error("Unlock status error:", error);
    res.status(500).json({ error: "Failed to fetch unlock status" });
  }
});

// ===== PENDING APPROVALS QUEUE (FINANCE/ADMIN ONLY) =====

/**
 * GET /api/broker-dashboard/pending-approvals
 * Returns commissions pending approval (FINANCE/ADMIN only)
 */
router.get("/pending-approvals", async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).auth?.role;

    // Only FINANCE and ADMIN can see pending approvals
    if (!["FINANCE", "ADMIN"].includes(userRole)) {
      return res.status(403).json({ error: "Not authorized to view pending approvals" });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const [commissions, total] = await Promise.all([
      prisma.commission.findMany({
        where: { status: "PENDING_APPROVAL" },
        include: {
          deal: {
            select: {
              id: true,
              dealNumber: true,
              salePrice: true,
              spaSignedDate: true,
              oqoodRegisteredDate: true,
              lead: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
              brokerAgent: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.commission.count({ where: { status: "PENDING_APPROVAL" } }),
    ]);

    const formatted = commissions.map((c) => ({
      id: c.id,
      dealNumber: c.deal?.dealNumber,
      dealId: c.deal?.id,
      brokerName: c.deal?.brokerAgent?.name,
      leadName: c.deal?.lead ? `${c.deal.lead.firstName} ${c.deal.lead.lastName}` : "N/A",
      amount: c.amount,
      rate: c.rate,
      status: c.status,
      reason: c.deal?.spaSignedDate && c.deal?.oqoodRegisteredDate ? "SPA signed & Oqood registered" : "Requirements met",
    }));

    res.json({
      data: formatted,
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    });
  } catch (error) {
    console.error("Pending approvals error:", error);
    res.status(500).json({ error: "Failed to fetch pending approvals" });
  }
});

// ===== APPROVED COMMISSIONS (WITH PAYMENT TRACKING) =====

/**
 * GET /api/broker-dashboard/approved-commissions
 * Returns approved commissions with payment status
 */
router.get("/approved-commissions", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.userId;
    const userRole = (req as any).auth?.role;

    // Build filter based on role
    let whereClause: any = { status: "APPROVED" };

    if (userRole === "BROKER_AGENT") {
      const agent = await prisma.brokerAgent.findFirst({
        where: { userId } as any,
        select: { id: true },
      });
      if (agent) whereClause = { ...whereClause, deal: { brokerAgentId: agent.id } };
    } else if (userRole === "BROKER_MANAGER") {
      const agent = await prisma.brokerAgent.findFirst({
        where: { userId } as any,
        select: { companyId: true },
      });
      if (agent) whereClause = { ...whereClause, deal: { brokerCompanyId: agent.companyId } };
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const [commissions, total] = await Promise.all([
      prisma.commission.findMany({
        where: whereClause,
        include: {
          deal: {
            select: {
              dealNumber: true,
              lead: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.commission.count({ where: whereClause }),
    ]);

    const formatted = commissions.map((c) => ({
      id: c.id,
      dealNumber: c.deal?.dealNumber,
      brokerName: "Self", // Would need to fetch broker name from deal
      leadName: c.deal?.lead ? `${c.deal.lead.firstName} ${c.deal.lead.lastName}` : "N/A",
      amount: c.amount,
      status: c.status,
      paidStatus: c.paidDate ? "PAID" : "PENDING",
      paidDate: c.paidDate,
      approvedDate: c.approvedDate,
    }));

    res.json({
      data: formatted,
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    });
  } catch (error) {
    console.error("Approved commissions error:", error);
    res.status(500).json({ error: "Failed to fetch approved commissions" });
  }
});

// ===== BROKER PERFORMANCE SUMMARY =====

/**
 * GET /api/broker-dashboard/performance
 * Returns broker performance metrics (FINANCE/ADMIN only)
 */
router.get("/performance", async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).auth?.role;

    // Only FINANCE and ADMIN can see all broker performance
    if (!["FINANCE", "ADMIN"].includes(userRole)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const brokers = await prisma.brokerAgent.findMany({
      include: {
        _count: {
          select: { deals: true },
        },
      },
    });

    const performance = await Promise.all(
      brokers.map(async (broker) => {
        const commissions = await prisma.commission.findMany({
          where: { deal: { brokerAgentId: broker.id } },
          select: { amount: true, status: true },
        });

        const totalEarned = commissions.reduce((sum, c) => sum + c.amount, 0);
        const approved = commissions
          .filter((c) => ["APPROVED", "PAID"].includes(c.status))
          .reduce((sum, c) => sum + c.amount, 0);
        const pending = commissions
          .filter((c) => c.status === "PENDING_APPROVAL")
          .reduce((sum, c) => sum + c.amount, 0);

        return {
          agentId: broker.id,
          agentName: broker.name,
          dealCount: broker._count.deals,
          totalEarned,
          approved,
          pending,
          approvalRate: broker._count.deals > 0 ? ((approved / totalEarned) * 100).toFixed(1) : "0",
        };
      })
    );

    res.json({
      data: performance.sort((a, b) => b.totalEarned - a.totalEarned),
    });
  } catch (error) {
    console.error("Performance error:", error);
    res.status(500).json({ error: "Failed to fetch performance data" });
  }
});

export default router;
