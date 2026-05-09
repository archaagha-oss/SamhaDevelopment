import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuthentication } from "../middleware/auth";

const router = Router();
router.use(requireAuthentication);

/**
 * Finance Dashboard API Endpoints
 * All endpoints include proper error handling, caching-ready design, and aggregation optimization
 */

// ===== DASHBOARD SUMMARY METRICS =====

/**
 * GET /api/finance/summary
 * Returns top-level metrics for finance dashboard header
 * Includes: Total Due, Collected, Overdue, At Risk
 */
router.get("/summary", async (req: Request, res: Response) => {
  try {
    // Parallel aggregation queries for performance
    const [totalDue, collected, overdue, atRisk] = await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: { in: ["PENDING", "OVERDUE", "PARTIAL"] },
        },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: "PAID" },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
          dueDate: { lt: new Date() },
        },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: "PENDING",
          dueDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Next 30 days
          },
        },
      }),
    ]);

    res.json({
      summary: {
        totalDue: totalDue._sum.amount || 0,
        collected: collected._sum.amount || 0,
        overdue: overdue._sum.amount || 0,
        atRisk: atRisk._sum.amount || 0,
        collectionRate: totalDue._sum.amount
          ? ((((collected._sum.amount || 0) / (totalDue._sum.amount || 1)) * 100).toFixed(1))
          : "0",
      },
    });
  } catch (error) {
    console.error("Finance summary error:", error);
    res.status(500).json({ error: "Failed to fetch summary metrics" });
  }
});

// ===== PAYMENT BREAKDOWN =====

/**
 * GET /api/finance/payment-breakdown
 * Returns payment status distribution for pie/donut chart
 */
router.get("/payment-breakdown", async (req: Request, res: Response) => {
  try {
    const breakdown = await prisma.payment.groupBy({
      by: ["status"],
      _count: { id: true },
      _sum: { amount: true },
      where: { status: { not: "CANCELLED" } },
    });

    const formatted = breakdown.reduce(
      (acc, item) => ({
        ...acc,
        [item.status]: {
          count: item._count.id,
          amount: item._sum.amount || 0,
        },
      }),
      {} as Record<string, { count: number; amount: number }>
    );

    res.json({ breakdown: formatted });
  } catch (error) {
    console.error("Payment breakdown error:", error);
    res.status(500).json({ error: "Failed to fetch payment breakdown" });
  }
});

// ===== EXPECTED VS RECEIVED =====

/**
 * GET /api/finance/expected-vs-received?months=6
 * Returns monthly comparison of expected vs received payments
 * Used for bar chart visualization
 */
router.get("/expected-vs-received", async (req: Request, res: Response) => {
  try {
    const months = parseInt(req.query.months as string) || 6;
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth() - months + 1, 1);

    // Get actual payments by month
    const payments = await prisma.payment.findMany({
      where: {
        paidDate: { gte: startDate },
        status: "PAID",
      },
      select: { paidDate: true, amount: true },
    });

    // Get due payments by month (expected)
    const duPayments = await prisma.payment.findMany({
      where: {
        dueDate: { gte: startDate },
        status: { in: ["PENDING", "OVERDUE", "PAID", "PARTIAL"] },
      },
      select: { dueDate: true, amount: true },
    });

    // Aggregate by month
    const monthlyReceived: Record<string, number> = {};
    const monthlyExpected: Record<string, number> = {};

    payments.forEach((p) => {
      const key = `${p.paidDate!.getFullYear()}-${String(p.paidDate!.getMonth() + 1).padStart(2, "0")}`;
      monthlyReceived[key] = (monthlyReceived[key] || 0) + p.amount;
    });

    duPayments.forEach((p) => {
      const key = `${p.dueDate.getFullYear()}-${String(p.dueDate.getMonth() + 1).padStart(2, "0")}`;
      monthlyExpected[key] = (monthlyExpected[key] || 0) + p.amount;
    });

    // Format for chart (ensure all months present)
    const result = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      result.unshift({
        month: key,
        expected: monthlyExpected[key] || 0,
        received: monthlyReceived[key] || 0,
      });
    }

    res.json({ data: result });
  } catch (error) {
    console.error("Expected vs received error:", error);
    res.status(500).json({ error: "Failed to fetch expected vs received data" });
  }
});

// ===== OVERDUE PAYMENTS =====

/**
 * GET /api/finance/overdue-payments?days=0&limit=50&offset=0
 * Returns list of overdue payments with deal and lead info
 * Sortable and paginated
 */
router.get("/overdue-payments", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 0;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: {
          status: { in: ["PENDING", "OVERDUE", "PARTIAL"] },
          dueDate: { lte: threshold },
        },
        include: {
          deal: {
            select: {
              id: true,
              dealNumber: true,
              stage: true,
              lead: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { dueDate: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.payment.count({
        where: {
          status: { in: ["PENDING", "OVERDUE", "PARTIAL"] },
          dueDate: { lte: threshold },
        },
      }),
    ]);

    const formatted = payments.map((p) => ({
      id: p.id,
      paymentId: p.id,
      dealNumber: p.deal?.dealNumber || "N/A",
      dealId: p.deal?.id,
      dealStage: p.deal?.stage,
      leadName: p.deal?.lead ? `${p.deal.lead.firstName} ${p.deal.lead.lastName}` : "N/A",
      amount: p.amount,
      dueDate: p.dueDate,
      daysOverdue: Math.floor((Date.now() - p.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
      milestoneLabel: p.milestoneLabel,
    }));

    res.json({
      data: formatted,
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    });
  } catch (error) {
    console.error("Overdue payments error:", error);
    res.status(500).json({ error: "Failed to fetch overdue payments" });
  }
});

// ===== BROKER COLLECTION PERFORMANCE =====

/**
 * GET /api/finance/broker-performance?limit=20
 * Returns collection metrics by broker agent
 */
router.get("/broker-performance", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    // Get brokers with deal and payment info
    const brokers = await prisma.brokerAgent.findMany({
      include: {
        _count: {
          select: { deals: true },
        },
      },
      take: limit,
    });

    const performance = await Promise.all(
      brokers.map(async (broker) => {
        // Get all deals for this broker
        const deals = await prisma.deal.findMany({
          where: { brokerAgentId: broker.id },
          select: { id: true, salePrice: true },
        });

        // Get all payments for these deals
        const payments = await prisma.payment.findMany({
          where: {
            deal: { brokerAgentId: broker.id },
          },
          select: { amount: true, status: true, paidDate: true, dueDate: true },
        });

        const totalDue = payments.reduce((sum, p) => sum + p.amount, 0);
        const paid = payments
          .filter((p) => p.status === "PAID")
          .reduce((sum, p) => sum + p.amount, 0);
        const collectionRate = totalDue > 0 ? (paid / totalDue) * 100 : 0;

        // Calculate average days to first payment
        const paidPayments = payments.filter((p) => p.status === "PAID");
        const avgPaymentDays =
          paidPayments.length > 0
            ? paidPayments.reduce((sum, p) => sum + Math.floor((p.paidDate!.getTime() - p.dueDate.getTime()) / (1000 * 60 * 60 * 24)), 0) /
              paidPayments.length
            : 0;

        return {
          brokerId: broker.id,
          brokerName: broker.name,
          dealCount: deals.length,
          totalSalePrice: deals.reduce((sum, d) => sum + d.salePrice, 0),
          collectionAmount: paid,
          collectionRate: collectionRate.toFixed(1),
          avgPaymentDays: Math.round(avgPaymentDays),
        };
      })
    );

    res.json({
      data: performance.sort((a, b) => parseFloat(b.collectionRate) - parseFloat(a.collectionRate)),
    });
  } catch (error) {
    console.error("Broker performance error:", error);
    res.status(500).json({ error: "Failed to fetch broker performance" });
  }
});

// ===== UPCOMING PAYMENTS =====

/**
 * GET /api/finance/upcoming-payments?days=30
 * Returns payments due in next N days, grouped by date
 */
router.get("/upcoming-payments", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const today = new Date();
    const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

    const payments = await prisma.payment.findMany({
      where: {
        status: { in: ["PENDING", "OVERDUE"] },
        dueDate: {
          gte: today,
          lte: futureDate,
        },
      },
      include: {
        deal: {
          select: {
            dealNumber: true,
            lead: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    // Group by date
    const grouped: Record<string, any[]> = {};
    payments.forEach((p) => {
      const dateKey = p.dueDate.toISOString().split("T")[0];
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push({
        id: p.id,
        dealNumber: p.deal?.dealNumber,
        leadName: p.deal?.lead ? `${p.deal.lead.firstName} ${p.deal.lead.lastName}` : "N/A",
        amount: p.amount,
        milestoneLabel: p.milestoneLabel,
      });
    });

    const result = Object.entries(grouped).map(([date, items]) => ({
      date,
      count: items.length,
      totalAmount: items.reduce((sum, i) => sum + i.amount, 0),
      payments: items,
    }));

    res.json({ data: result });
  } catch (error) {
    console.error("Upcoming payments error:", error);
    res.status(500).json({ error: "Failed to fetch upcoming payments" });
  }
});

// ===== COLLECTION METRICS BY STAGE =====

/**
 * GET /api/finance/metrics-by-stage
 * Returns payment collection metrics grouped by deal stage
 */
router.get("/metrics-by-stage", async (req: Request, res: Response) => {
  try {
    const stages = [
      "RESERVATION_PENDING",
      "RESERVATION_CONFIRMED",
      "SPA_PENDING",
      "SPA_SENT",
      "SPA_SIGNED",
      "OQOOD_PENDING",
      "OQOOD_REGISTERED",
      "INSTALLMENTS_ACTIVE",
      "HANDOVER_PENDING",
      "COMPLETED",
    ];

    const metrics = await Promise.all(
      stages.map(async (stage) => {
        const deals = await prisma.deal.findMany({
          where: { stage: stage as any },
          select: { id: true, salePrice: true },
        });

        const payments = await prisma.payment.findMany({
          where: { deal: { stage: stage as any } },
          select: { amount: true, status: true },
        });

        const totalDue = payments.reduce((sum, p) => sum + p.amount, 0);
        const paid = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0);

        return {
          stage,
          dealCount: deals.length,
          totalDue,
          totalPaid: paid,
          collectionRate: totalDue > 0 ? ((paid / totalDue) * 100).toFixed(1) : "0",
        };
      })
    );

    res.json({ data: metrics });
  } catch (error) {
    console.error("Metrics by stage error:", error);
    res.status(500).json({ error: "Failed to fetch metrics by stage" });
  }
});

export default router;
