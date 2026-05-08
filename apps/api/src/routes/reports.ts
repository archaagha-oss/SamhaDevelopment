import { Router } from "express";
import {
  generateCommissionStatement,
  generateDealReport,
  generateRevenueReport,
  generateInventoryReport,
  generateAgentReport,
  generateCollectionsReport,
  generatePaymentsReport,
  generateLeadsReport,
} from "../services/excelService";
import { prisma } from "../lib/prisma";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse optional ISO date query params into Date objects. */
function parseDateRange(req: any): { startDate?: Date; endDate?: Date } {
  const out: { startDate?: Date; endDate?: Date } = {};
  if (req.query.startDate) {
    const d = new Date(String(req.query.startDate));
    if (!isNaN(d.getTime())) out.startDate = d;
  }
  if (req.query.endDate) {
    const d = new Date(String(req.query.endDate));
    if (!isNaN(d.getTime())) {
      // include the entire end day
      d.setHours(23, 59, 59, 999);
      out.endDate = d;
    }
  }
  return out;
}

/** Build a Prisma date-range filter object for a field. */
function dateFilter(field: string, range: { startDate?: Date; endDate?: Date }) {
  if (!range.startDate && !range.endDate) return {};
  const f: any = {};
  if (range.startDate) f.gte = range.startDate;
  if (range.endDate) f.lte = range.endDate;
  return { [field]: f };
}

/** Send an XLSX buffer with proper headers. */
function sendXlsx(res: any, buffer: Buffer, filename: string) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${safe}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(buffer);
}

const today = () => new Date().toISOString().split("T")[0];

// ===== UI ENDPOINTS =====

// GET /overview — ExecutiveDashboard KPI cards (supports ?startDate&endDate)
router.get("/overview", async (req, res) => {
  try {
    const range = parseDateRange(req);
    const dealRange = dateFilter("createdAt", range);
    const paymentRange = dateFilter("dueDate", range);

    const [
      totalUnits, soldUnits, totalLeads, totalDeals,
      revenueResult, pipelineResult, overdueResult,
      dldWaivedResult, adminFeeWaivedCount,
    ] = await Promise.all([
      prisma.unit.count(),
      prisma.unit.count({ where: { status: "SOLD" } }),
      prisma.lead.count({ where: { ...dateFilter("createdAt", range) } }),
      prisma.deal.count({ where: { ...dealRange } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID", ...paymentRange } }),
      prisma.deal.aggregate({ _sum: { salePrice: true }, where: { stage: { notIn: ["COMPLETED","CANCELLED"] }, ...dealRange } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "OVERDUE", ...paymentRange } }),
      prisma.deal.aggregate({ _sum: { dldFee: true }, where: { dldPaidBy: "DEVELOPER", stage: { notIn: ["CANCELLED"] }, ...dealRange } }),
      prisma.deal.count({ where: { adminFeeWaived: true, stage: { notIn: ["CANCELLED"] }, ...dealRange } }),
    ]);
    const pipelineDeals = await prisma.deal.findMany({
      where: { stage: { notIn: ["COMPLETED","CANCELLED"] }, ...dealRange },
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
      meta: {
        generatedAt: new Date().toISOString(),
        filters: {
          startDate: range.startDate?.toISOString() ?? null,
          endDate:   range.endDate?.toISOString() ?? null,
        },
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

// GET /leads — pipeline (supports ?startDate&endDate)
router.get("/leads", async (req, res) => {
  try {
    const range = parseDateRange(req);
    const where = { ...dateFilter("createdAt", range) };
    const [stageGroups, sourceGroups, totalLeads, convertedToDeals] = await Promise.all([
      prisma.lead.groupBy({ by: ["stage"], _count: { id: true }, where }),
      prisma.lead.groupBy({ by: ["source"], _count: { id: true }, where }),
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, stage: "CLOSED_WON" } }),
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

// GET /payments — grouped by status
router.get("/payments", async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      include: { deal: { include: { unit: true, lead: true } } },
      orderBy: { dueDate: "asc" },
    });
    const byStatus: Record<string, any[]> = {};
    const totals: Record<string, number> = {};
    payments.forEach((p) => {
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

// GET /revenue/monthly — last 12 months (or custom range) of collected vs expected
router.get("/revenue/monthly", async (req, res) => {
  try {
    const range = parseDateRange(req);
    const now = range.endDate ?? new Date();
    const start = range.startDate ?? new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const months: { key: string; label: string; collected: number; expected: number; collectionRate: number }[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= now) {
      months.push({
        key:   `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
        label: cursor.toLocaleDateString("en-AE", { month: "short", year: "2-digit" }),
        collected: 0,
        expected: 0,
        collectionRate: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const [paid, allDue] = await Promise.all([
      prisma.payment.findMany({
        where: { status: { in: ["PAID", "PDC_CLEARED"] }, paidDate: { not: null } },
        select: { amount: true, paidDate: true },
      }),
      prisma.payment.findMany({
        where: { status: { notIn: ["CANCELLED"] } },
        select: { amount: true, dueDate: true },
      }),
    ]);

    paid.forEach((p) => {
      if (!p.paidDate) return;
      const k = `${p.paidDate.getFullYear()}-${String(p.paidDate.getMonth() + 1).padStart(2, "0")}`;
      const m = months.find((x) => x.key === k);
      if (m) m.collected += p.amount;
    });
    allDue.forEach((p) => {
      const k = `${p.dueDate.getFullYear()}-${String(p.dueDate.getMonth() + 1).padStart(2, "0")}`;
      const m = months.find((x) => x.key === k);
      if (m) m.expected += p.amount;
    });
    months.forEach((m) => { m.collectionRate = m.expected > 0 ? +(m.collected / m.expected).toFixed(4) : 0; });

    res.json(months);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch monthly revenue", code: "FETCH_MONTHLY_ERROR", statusCode: 500 });
  }
});

// GET /collections — overdue summary, aging, upcoming + overdue rows for the UI table
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

    const aging = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    const agingAmt = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    const overdueRows = overduePayments.map((p) => {
      const days = Math.floor((now.getTime() - new Date(p.dueDate).getTime()) / 86400000);
      const bucket = (days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+") as keyof typeof aging;
      aging[bucket]++;
      agingAmt[bucket] += p.amount;
      return { ...p, daysLate: days, agingBucket: bucket };
    });

    res.json({
      overdue: {
        count: overduePayments.length,
        total: overduePayments.reduce((s, p) => s + p.amount, 0),
        payments: overdueRows,
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
      where: { role: { in: ["SALES_AGENT", "ADMIN"] } },
      select: {
        id: true, name: true, role: true,
        assignedLeads: { select: { id: true, stage: true } },
        _count: { select: { assignedLeads: true } },
      },
    });

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

router.get("/agents/performance", async (req, res) => {
  try {
    const agents = await prisma.user.findMany({
      where: { role: "SALES_AGENT" },
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

router.get("/export/commissions/:brokerCompanyId", async (req, res) => {
  try {
    const buffer = await generateCommissionStatement(req.params.brokerCompanyId);
    sendXlsx(res, buffer, `commission-statement-${today()}.xlsx`);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate commission statement", code: "EXPORT_COMMISSION_ERROR", statusCode: 500 });
  }
});

router.get("/export/deals", async (req, res) => {
  try {
    const range = parseDateRange(req);
    const filters: any = { ...range };
    if (req.query.stage) filters.stage = String(req.query.stage);
    const buffer = await generateDealReport(filters);
    sendXlsx(res, buffer, `deals-report-${today()}.xlsx`);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate deal report", code: "EXPORT_DEAL_ERROR", statusCode: 500 });
  }
});

router.get("/export/revenue", async (req, res) => {
  try {
    const range = parseDateRange(req);
    const buffer = await generateRevenueReport(range);
    sendXlsx(res, buffer, `revenue-report-${today()}.xlsx`);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate revenue report", code: "EXPORT_REVENUE_ERROR", statusCode: 500 });
  }
});

router.get("/export/inventory", async (req, res) => {
  try {
    const buffer = await generateInventoryReport();
    sendXlsx(res, buffer, `inventory-report-${today()}.xlsx`);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate inventory report", code: "EXPORT_INVENTORY_ERROR", statusCode: 500 });
  }
});

router.get("/export/agents", async (req, res) => {
  try {
    const buffer = await generateAgentReport();
    sendXlsx(res, buffer, `agent-performance-${today()}.xlsx`);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate agent report", code: "EXPORT_AGENT_ERROR", statusCode: 500 });
  }
});

router.get("/export/collections", async (req, res) => {
  try {
    const buffer = await generateCollectionsReport();
    sendXlsx(res, buffer, `collections-report-${today()}.xlsx`);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate collections report", code: "EXPORT_COLLECTIONS_ERROR", statusCode: 500 });
  }
});

router.get("/export/payments", async (req, res) => {
  try {
    const range = parseDateRange(req);
    const filters: any = { ...range };
    if (req.query.status) filters.status = String(req.query.status);
    const buffer = await generatePaymentsReport(filters);
    sendXlsx(res, buffer, `payments-report-${today()}.xlsx`);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate payments report", code: "EXPORT_PAYMENTS_ERROR", statusCode: 500 });
  }
});

router.get("/export/leads", async (req, res) => {
  try {
    const range = parseDateRange(req);
    const filters: any = { ...range };
    if (req.query.stage)  filters.stage = String(req.query.stage);
    if (req.query.source) filters.source = String(req.query.source);
    const buffer = await generateLeadsReport(filters);
    sendXlsx(res, buffer, `leads-report-${today()}.xlsx`);
  } catch (error) {
    res.status(500).json({ error: "Failed to generate leads report", code: "EXPORT_LEADS_ERROR", statusCode: 500 });
  }
});

export default router;
