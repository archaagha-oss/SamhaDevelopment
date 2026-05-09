import { Router } from "express";
import { generateCommissionStatement, generateDealReport } from "../services/excelService";
import { prisma } from "../lib/prisma";
import { requireAuthentication } from "../middleware/auth";

const router = Router();
router.use(requireAuthentication);

// ===== NEW UI ENDPOINTS =====

// GET /overview — ExecutiveDashboard KPI cards
router.get("/overview", async (req, res) => {
  try {
    const [
      totalUnits, soldUnits, totalLeads, totalDeals,
      revenueResult, pipelineResult, overdueResult,
      dldWaivedResult, adminFeeWaivedCount,
    ] = await Promise.all([
      prisma.unit.count(),
      prisma.unit.count({ where: { status: "SOLD" } }),
      prisma.lead.count(),
      prisma.deal.count(),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
      prisma.deal.aggregate({ _sum: { salePrice: true }, where: { stage: { notIn: ["COMPLETED","CANCELLED"] } } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "OVERDUE" } }),
      prisma.deal.aggregate({ _sum: { dldFee: true }, where: { dldPaidBy: "DEVELOPER", stage: { notIn: ["CANCELLED"] } } }),
      prisma.deal.count({ where: { adminFeeWaived: true, stage: { notIn: ["CANCELLED"] } } }),
    ]);
    const pipelineDeals = await prisma.deal.findMany({
      where: { stage: { notIn: ["COMPLETED","CANCELLED"] } },
      select: { salePrice: true, discount: true },
    });
    const pipelineNetValue = pipelineDeals.reduce((s, d) => s + d.salePrice - (d.discount ?? 0), 0);
    res.json({
      unitsSold: soldUnits,
      totalUnits,
      soldPercentage: totalUnits > 0 ? ((soldUnits / totalUnits) * 100).toFixed(1) : "0",
      revenueCollected: revenueResult._sum.amount || 0,
      pipelineValue: pipelineNetValue,
      overduePayments: overdueResult._sum.amount || 0,
      totalLeads,
      totalDeals,
      developerIncentives: {
        dldWaivedTotal: dldWaivedResult._sum.dldFee || 0,
        adminFeeWaivedCount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch overview", code: "FETCH_OVERVIEW_ERROR", statusCode: 500 });
  }
});

// GET /units-by-status — ExecutiveDashboard bar chart
router.get("/units-by-status", async (req, res) => {
  try {
    const groups = await prisma.unit.groupBy({ by: ["status"], _count: { id: true } });
    const result: Record<string, number> = {};
    groups.forEach((g) => { result[g.status] = g._count.id; });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch units by status", code: "FETCH_UNITS_STATUS_ERROR", statusCode: 500 });
  }
});

// GET /leads — ExecutiveDashboard lead pipeline
router.get("/leads", async (req, res) => {
  try {
    const [stageGroups, sourceGroups, totalLeads, convertedToDeals] = await Promise.all([
      prisma.lead.groupBy({ by: ["stage"], _count: { id: true } }),
      prisma.lead.groupBy({ by: ["source"], _count: { id: true } }),
      prisma.lead.count(),
      prisma.lead.count({ where: { stage: "CLOSED_WON" } }),
    ]);
    const byStage: Record<string, number> = {};
    stageGroups.forEach((g) => { byStage[g.stage] = g._count.id; });
    const bySource: Record<string, number> = {};
    sourceGroups.forEach((g) => { bySource[g.source] = g._count.id; });
    res.json({
      byStage, bySource,
      conversionRate: totalLeads > 0 ? ((convertedToDeals / totalLeads) * 100).toFixed(1) : "0",
      totalLeads, convertedToDeals,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch leads report", code: "FETCH_LEADS_REPORT_ERROR", statusCode: 500 });
  }
});

// GET /payments — PaymentReportPage grouped by status
router.get("/payments", async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      include: { deal: { include: { unit: true, lead: true } } },
      orderBy: { dueDate: "asc" },
    });
    const byStatus: Record<string, any[]> = {};
    const totals: Record<string, number> = {};
    payments.forEach((p) => {
      // Waived payments (CANCELLED + isWaived=true) get their own bucket
      const bucket = (p.status === "CANCELLED" && (p as any).isWaived) ? "WAIVED" : p.status;
      if (!byStatus[bucket]) byStatus[bucket] = [];
      byStatus[bucket].push(p);
      totals[bucket] = (totals[bucket] || 0) + p.amount;
    });
    res.json({ byStatus, totals });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payments report", code: "FETCH_PAYMENTS_REPORT_ERROR", statusCode: 500 });
  }
});

// GET /revenue/monthly — last 12 months of collected payments
router.get("/revenue/monthly", async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { status: { in: ["PAID", "PDC_CLEARED"] } },
      select: { amount: true, paidDate: true },
      orderBy: { paidDate: "asc" },
    });

    // Build last 12 months buckets
    const now = new Date();
    const months: { key: string; label: string; collected: number; expected: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-AE", { month: "short", year: "2-digit" }),
        collected: 0,
        expected:  0,
      });
    }

    payments.forEach((p) => {
      if (!p.paidDate) return;
      const key = `${p.paidDate.getFullYear()}-${String(p.paidDate.getMonth() + 1).padStart(2, "0")}`;
      const bucket = months.find((m) => m.key === key);
      if (bucket) bucket.collected += p.amount;
    });

    // Expected: all non-cancelled payments due in those months
    const allDue = await prisma.payment.findMany({
      where: { status: { notIn: ["CANCELLED"] } },
      select: { amount: true, dueDate: true },
    });
    allDue.forEach((p) => {
      const key = `${p.dueDate.getFullYear()}-${String(p.dueDate.getMonth() + 1).padStart(2, "0")}`;
      const bucket = months.find((m) => m.key === key);
      if (bucket) bucket.expected += p.amount;
    });

    res.json(months);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch monthly revenue", code: "FETCH_MONTHLY_ERROR", statusCode: 500 });
  }
});

// GET /collections — finance collections overview (overdue summary, aging, upcoming)
router.get("/collections", async (req, res) => {
  try {
    const now = new Date();
    const in7  = new Date(now.getTime() + 7  * 86400000);
    const in30 = new Date(now.getTime() + 30 * 86400000);

    const [overduePayments, upcoming7, upcoming30] = await Promise.all([
      prisma.payment.findMany({
        where: { status: { in: ["OVERDUE", "PARTIAL"] }, dueDate: { lt: now } },
        include: { deal: { include: { lead: true, unit: true } } },
        orderBy: { dueDate: "asc" },
      }),
      prisma.payment.findMany({
        where: { status: "PENDING", dueDate: { gte: now, lte: in7 } },
        include: { deal: { include: { lead: true, unit: true } } },
        orderBy: { dueDate: "asc" },
      }),
      prisma.payment.findMany({
        where: { status: "PENDING", dueDate: { gte: now, lte: in30 } },
        include: { deal: { include: { lead: true, unit: true } } },
        orderBy: { dueDate: "asc" },
      }),
    ]);

    // Build aging buckets
    const aging = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    const agingAmt = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    for (const p of overduePayments) {
      const days = Math.floor((now.getTime() - new Date(p.dueDate).getTime()) / 86400000);
      const bucket = days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
      aging[bucket]++;
      agingAmt[bucket] += p.amount;
    }

    res.json({
      overdue: {
        count: overduePayments.length,
        total: overduePayments.reduce((s, p) => s + p.amount, 0),
      },
      aging: Object.entries(aging).map(([range, count]) => ({
        range,
        count,
        amount: agingAmt[range as keyof typeof agingAmt],
      })),
      upcoming: {
        next7Days:  { count: upcoming7.length,  total: upcoming7.reduce((s, p) => s + p.amount, 0),  payments: upcoming7 },
        next30Days: { count: upcoming30.length, total: upcoming30.reduce((s, p) => s + p.amount, 0), payments: upcoming30 },
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch collections overview", code: "FETCH_COLLECTIONS_ERROR", statusCode: 500 });
  }
});

// GET /inventory — units grouped by project and status
router.get("/inventory", async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      select: {
        id: true, name: true,
        units: { select: { status: true, price: true } },
      },
      orderBy: { name: "asc" },
    });

    const result = projects.map((p) => {
      const byStatus: Record<string, number> = {};
      let totalValue = 0;
      p.units.forEach((u) => {
        byStatus[u.status] = (byStatus[u.status] || 0) + 1;
        totalValue += u.price;
      });
      return {
        projectId:   p.id,
        projectName: p.name,
        total:       p.units.length,
        byStatus,
        totalValue,
        availableRate: p.units.length > 0 ? ((byStatus["AVAILABLE"] || 0) / p.units.length * 100).toFixed(1) : "0",
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch inventory", code: "FETCH_INVENTORY_ERROR", statusCode: 500 });
  }
});

// GET /agents/summary — agents with deals + commissions
router.get("/agents/summary", async (req, res) => {
  try {
    const agents = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: { in: ["ADMIN", "MANAGER", "MEMBER"] },
      },
      select: {
        id: true, name: true, role: true,
        assignedLeads: { select: { id: true, stage: true } },
        _count: { select: { assignedLeads: true } },
      },
    });

    // Group deals and commissions by the lead's assigned agent
    const allLeads = await prisma.lead.findMany({
      select: { id: true, stage: true, assignedAgentId: true },
    });
    const leadAgentMap = new Map(allLeads.map((l) => [l.id, l.assignedAgentId]));

    const allDeals = await prisma.deal.findMany({
      select: { id: true, salePrice: true, leadId: true },
    });
    const allComms = await prisma.commission.findMany({
      where: { status: "PAID" },
      include: { deal: { select: { leadId: true } } },
    });

    const dealMap = new Map<string, { count: number; revenue: number }>();
    for (const d of allDeals) {
      const uid = leadAgentMap.get(d.leadId);
      if (!uid) continue;
      const e = dealMap.get(uid) ?? { count: 0, revenue: 0 };
      e.count++;
      e.revenue += d.salePrice ?? 0;
      dealMap.set(uid, e);
    }

    const commMap = new Map<string, number>();
    for (const c of allComms) {
      const uid = leadAgentMap.get(c.deal?.leadId ?? "");
      if (!uid) continue;
      commMap.set(uid, (commMap.get(uid) ?? 0) + (c.amount ?? 0));
    }

    const summary = agents.map((a) => {
      const closedLeads = a.assignedLeads.filter((l: any) => l.stage === "CLOSED_WON").length;
      const deals       = dealMap.get(a.id);
      return {
        agentId:          a.id,
        agentName:        a.name,
        role:             a.role,
        totalLeads:       a._count.assignedLeads,
        closedLeads,
        closeRate:        a._count.assignedLeads > 0 ? ((closedLeads / a._count.assignedLeads) * 100).toFixed(1) : "0",
        totalDeals:       deals?.count        ?? 0,
        dealRevenue:      deals?.revenue      ?? 0,
        commissionEarned: commMap.get(a.id)   ?? 0,
      };
    });

    res.json(summary.sort((a, b) => b.totalDeals - a.totalDeals));
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch agent summary", code: "FETCH_AGENT_SUMMARY_ERROR", statusCode: 500 });
  }
});

// ===== LEGACY ENDPOINTS =====

// Get dashboard summary
router.get("/dashboard/summary", async (req, res) => {
  try {
    const [totalLeads, leadsNewCount, totalDeals, dealsCompletedCount] =
      await Promise.all([
        prisma.lead.count(),
        prisma.lead.count({ where: { stage: "NEW" } }),
        prisma.deal.count(),
        prisma.deal.count({ where: { stage: "COMPLETED" } }),
      ]);

    const totalRevenue = await prisma.deal.aggregate({
      _sum: { salePrice: true },
      where: { stage: "COMPLETED" },
    });

    res.json({
      totalLeads,
      newLeads: leadsNewCount,
      totalDeals,
      completedDeals: dealsCompletedCount,
      totalRevenue: totalRevenue._sum.salePrice || 0,
      conversionRate: totalLeads > 0 ? (dealsCompletedCount / totalLeads) * 100 : 0,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch dashboard summary",
      code: "FETCH_SUMMARY_ERROR",
      statusCode: 500,
    });
  }
});

// Get leads by stage distribution
router.get("/leads/by-stage", async (req, res) => {
  try {
    const stages = await prisma.lead.groupBy({
      by: ["stage"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    res.json(
      stages.map((s) => ({
        stage: s.stage,
        count: s._count.id,
      }))
    );
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch stage distribution",
      code: "FETCH_DISTRIBUTION_ERROR",
      statusCode: 500,
    });
  }
});

// Get deals by stage
router.get("/deals/by-stage", async (req, res) => {
  try {
    const stages = await prisma.deal.groupBy({
      by: ["stage"],
      _count: { id: true },
      _sum: { salePrice: true },
      orderBy: { _count: { id: "desc" } },
    });

    res.json(
      stages.map((s) => ({
        stage: s.stage,
        count: s._count.id,
        totalValue: s._sum.salePrice || 0,
      }))
    );
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch deal distribution",
      code: "FETCH_DEAL_DISTRIBUTION_ERROR",
      statusCode: 500,
    });
  }
});

// Get agent performance
router.get("/agents/performance", async (req, res) => {
  try {
    const agents = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: { in: ["ADMIN", "MANAGER", "MEMBER"] },
      },
      include: {
        assignedLeads: {
          select: { id: true, stage: true },
        },
        _count: { select: { assignedLeads: true } },
      },
    });

    const performance = agents.map((agent) => {
      const dealsCount = agent.assignedLeads.filter(
        (l: any) => l.stage === "CLOSED_WON"
      ).length;
      return {
        agentId: agent.id,
        agentName: agent.name,
        totalLeads: agent._count.assignedLeads,
        closedDeals: dealsCount,
        closeRate:
          agent._count.assignedLeads > 0
            ? (dealsCount / agent._count.assignedLeads) * 100
            : 0,
      };
    });

    res.json(performance.sort((a, b) => b.closeRate - a.closeRate));
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch agent performance",
      code: "FETCH_PERFORMANCE_ERROR",
      statusCode: 500,
    });
  }
});

// Get broker performance
router.get("/brokers/performance", async (req, res) => {
  try {
    const brokers = await prisma.brokerCompany.findMany({
      include: {
        deals: {
          select: { id: true, stage: true, salePrice: true, discount: true },
        },
        commissions: {
          select: { status: true, amount: true },
        },
      },
    });

    const performance = brokers.map((broker) => {
      const dealsCount = broker.deals.length;
      const totalCommission = broker.commissions.reduce(
        (sum, c) => sum + c.amount,
        0
      );
      const paidCommission = broker.commissions
        .filter((c) => c.status === "PAID")
        .reduce((sum, c) => sum + c.amount, 0);

      return {
        brokerId: broker.id,
        brokerName: broker.name,
        totalDeals: dealsCount,
        totalRevenue: broker.deals.reduce((sum, d) => sum + d.salePrice - (d.discount ?? 0), 0),
        commissionEarned: totalCommission,
        commissionPaid: paidCommission,
      };
    });

    res.json(performance.sort((a, b) => b.totalRevenue - a.totalRevenue));
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch broker performance",
      code: "FETCH_BROKER_PERFORMANCE_ERROR",
      statusCode: 500,
    });
  }
});

// ===== EXCEL EXPORTS =====

// Export commission statement for broker
router.get("/export/commissions/:brokerCompanyId", async (req, res) => {
  try {
    const buffer = await generateCommissionStatement(req.params.brokerCompanyId);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="commission-statement-${new Date().toISOString().split("T")[0]}.xlsx"`
    );
    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate commission statement",
      code: "EXPORT_COMMISSION_ERROR",
      statusCode: 500,
    });
  }
});

// Export deal report with optional filters
router.get("/export/deals", async (req, res) => {
  try {
    const { stage, startDate, endDate } = req.query;

    const filters: any = {};
    if (stage) filters.stage = stage;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const buffer = await generateDealReport(filters);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="deal-report-${new Date().toISOString().split("T")[0]}.xlsx"`
    );
    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate deal report",
      code: "EXPORT_DEAL_ERROR",
      statusCode: 500,
    });
  }
});

export default router;
