import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";

interface Deal {
  id: string;
  dealNumber: string;
  lead: { firstName: string; lastName: string };
  unit: { unitNumber: string; type: string };
  stage: string;
  salePrice: number;
  oqoodDeadline: string;
  payments?: { id: string; status: string; amount: number; dueDate: string; milestoneLabel: string }[];
  commission?: { status: string; amount: number };
}

interface TabType {
  label: string;
  id: "overview" | "overdue" | "upcoming" | "pipeline";
  icon: string;
}

const TABS: TabType[] = [
  { label: "Overview", id: "overview", icon: "📊" },
  { label: "Overdue", id: "overdue", icon: "⚠️" },
  { label: "Upcoming", id: "upcoming", icon: "📅" },
  { label: "Collections Pipeline", id: "pipeline", icon: "🎯" },
];

export default function FinanceDashboard() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "overdue" | "upcoming" | "pipeline">("overview");
  const [dateRange, setDateRange] = useState<"month" | "quarter" | "year">("month");

  // Fetch all deals with full payment data
  useEffect(() => {
    const fetchDeals = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get("/api/deals?limit=1000");
        setDeals(response.data.data || []);
      } catch (err: any) {
        toast.error("Failed to fetch deals");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDeals();
  }, []);

  // Calculate metrics
  const metrics = useMemo(() => {
    let totalReceivable = 0;
    let totalPaid = 0;
    let totalOverdue = 0;
    let overdueCount = 0;
    let upcomingCount = 0;
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    deals.forEach((deal) => {
      deal.payments?.forEach((p) => {
        totalReceivable += p.amount;
        if (p.status === "PAID") totalPaid += p.amount;

        const dueDate = new Date(p.dueDate);
        if (p.status !== "PAID" && p.status !== "CANCELLED") {
          if (dueDate < now) {
            totalOverdue += p.amount;
            overdueCount++;
          } else if (dueDate <= monthEnd && p.status !== "PDC_CLEARED") {
            upcomingCount++;
          }
        }
      });
    });

    return {
      totalReceivable,
      totalPaid,
      totalOverdue,
      paidPercentage: totalReceivable > 0 ? Math.round((totalPaid / totalReceivable) * 100) : 0,
      overdueCount,
      upcomingCount,
      atRisk: deals.filter((d) => {
        const deadline = new Date(d.oqoodDeadline);
        const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysLeft < 7 && !["COMPLETED", "CANCELLED"].includes(d.stage);
      }).length,
    };
  }, [deals]);

  // Get overdue payments
  const overduePayments = useMemo(() => {
    const now = new Date();
    const payments: any[] = [];

    deals.forEach((deal) => {
      deal.payments?.forEach((p) => {
        const dueDate = new Date(p.dueDate);
        if (dueDate < now && p.status !== "PAID" && p.status !== "CANCELLED" && p.status !== "WAIVED") {
          const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          payments.push({
            ...p,
            dealNumber: deal.dealNumber,
            buyerName: `${deal.lead.firstName} ${deal.lead.lastName}`,
            unitNumber: deal.unit.unitNumber,
            dealStage: deal.stage,
            daysOverdue,
          });
        }
      });
    });

    return payments.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [deals]);

  // Get upcoming payments
  const upcomingPayments = useMemo(() => {
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const payments: any[] = [];

    deals.forEach((deal) => {
      deal.payments?.forEach((p) => {
        const dueDate = new Date(p.dueDate);
        if (
          dueDate >= now &&
          dueDate <= monthEnd &&
          p.status !== "PAID" &&
          p.status !== "CANCELLED" &&
          p.status !== "WAIVED" &&
          p.status !== "PDC_CLEARED"
        ) {
          const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          payments.push({
            ...p,
            dealNumber: deal.dealNumber,
            buyerName: `${deal.lead.firstName} ${deal.lead.lastName}`,
            unitNumber: deal.unit.unitNumber,
            dealStage: deal.stage,
            daysUntilDue,
          });
        }
      });
    });

    return payments.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }, [deals]);

  // Collections pipeline
  const pipeline = useMemo(() => {
    const stages = [
      "RESERVATION_PENDING",
      "RESERVATION_CONFIRMED",
      "SPA_PENDING",
      "SPA_SIGNED",
      "OQOOD_REGISTERED",
      "INSTALLMENTS_ACTIVE",
      "COMPLETED",
    ];

    return stages.map((stage) => {
      const stageDeals = deals.filter((d) => d.stage === stage);
      const totalValue = stageDeals.reduce((sum, d) => sum + d.salePrice, 0);
      const totalPaid = stageDeals.reduce((sum, d) => {
        const paid = d.payments?.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0) || 0;
        return sum + paid;
      }, 0);

      return {
        stage,
        dealCount: stageDeals.length,
        totalValue,
        totalPaid,
        outstanding: totalValue - totalPaid,
        collectionRate: totalValue > 0 ? Math.round((totalPaid / totalValue) * 100) : 0,
      };
    });
  }, [deals]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200">
        <h1 className="text-lg font-bold text-slate-900 mb-1">Finance Dashboard</h1>
        <p className="text-xs text-slate-400">Receivables tracking, overdue alerts, collections pipeline</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 py-3 border-b border-slate-200 bg-white overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="p-6 space-y-6">
            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Total Receivable</p>
                <p className="text-2xl font-bold text-slate-900">
                  AED {(metrics.totalReceivable / 1_000_000).toFixed(1)}M
                </p>
                <p className="text-xs text-slate-400 mt-1">{deals.length} deals</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Collected</p>
                <p className="text-2xl font-bold text-emerald-600">
                  AED {(metrics.totalPaid / 1_000_000).toFixed(1)}M
                </p>
                <p className="text-xs text-slate-400 mt-1">{metrics.paidPercentage}% collected</p>
              </div>

              <div className="bg-white border border-red-200 rounded-lg p-4 bg-red-50">
                <p className="text-xs text-red-600 uppercase tracking-wide font-semibold mb-2">🚨 Overdue</p>
                <p className="text-2xl font-bold text-red-700">AED {(metrics.totalOverdue / 1_000_000).toFixed(1)}M</p>
                <p className="text-xs text-red-600 mt-1">{metrics.overdueCount} payments</p>
              </div>

              <div className="bg-white border border-amber-200 rounded-lg p-4 bg-amber-50">
                <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold mb-2">📅 This Month</p>
                <p className="text-2xl font-bold text-amber-700">{metrics.upcomingCount}</p>
                <p className="text-xs text-amber-600 mt-1">payments due</p>
              </div>

              <div className="bg-white border border-orange-200 rounded-lg p-4 bg-orange-50">
                <p className="text-xs text-orange-600 uppercase tracking-wide font-semibold mb-2">⏰ At Risk</p>
                <p className="text-2xl font-bold text-orange-700">{metrics.atRisk}</p>
                <p className="text-xs text-orange-600 mt-1">Oqood deadline {'<'} 7 days</p>
              </div>
            </div>

            {/* Collection Rate by Stage */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h3 className="font-semibold text-slate-800 mb-4">Collection Rate by Stage</h3>
              <div className="space-y-3">
                {pipeline.map((item) => (
                  <div key={item.stage}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">{item.stage.replace(/_/g, " ")}</span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-slate-800">{item.collectionRate}%</span>
                        <span className="text-xs text-slate-400 ml-2">
                          ({item.dealCount} {item.dealCount === 1 ? "deal" : "deals"})
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${item.collectionRate}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      AED {(item.totalPaid / 1_000_000).toFixed(1)}M / {(item.totalValue / 1_000_000).toFixed(1)}M
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Overdue Tab */}
        {activeTab === "overdue" && (
          <div className="p-6">
            {overduePayments.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-3xl mb-2">✅</p>
                <p className="font-semibold text-slate-800">No overdue payments</p>
                <p className="text-sm text-slate-400">All payments are current or paid</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Deal</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Buyer</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Milestone</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-700">Amount</th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-700">Days Overdue</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overduePayments.map((p) => (
                      <tr key={p.id} className="hover:bg-red-50/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.dealNumber}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{p.buyerName}</p>
                          <p className="text-xs text-slate-400">{p.unitNumber}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{p.milestoneLabel}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          AED {p.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 font-semibold text-xs">
                            {p.daysOverdue}d
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs capitalize text-slate-600">{p.status.replace(/_/g, " ")}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Upcoming Tab */}
        {activeTab === "upcoming" && (
          <div className="p-6">
            {upcomingPayments.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-3xl mb-2">📅</p>
                <p className="font-semibold text-slate-800">No upcoming payments this month</p>
                <p className="text-sm text-slate-400">Expand date range to see more</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Deal</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Buyer</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Milestone</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-700">Amount</th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-700">Days Until Due</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {upcomingPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-amber-50/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.dealNumber}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{p.buyerName}</p>
                          <p className="text-xs text-slate-400">{p.unitNumber}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{p.milestoneLabel}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          AED {p.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold text-xs">
                            {p.daysUntilDue}d
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs capitalize text-slate-600">{p.status.replace(/_/g, " ")}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Pipeline Tab */}
        {activeTab === "pipeline" && (
          <div className="p-6 space-y-4">
            {pipeline.map((item) => (
              <div key={item.stage} className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800">{item.stage.replace(/_/g, " ")}</h3>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-600">{item.collectionRate}% collected</p>
                    <p className="text-xs text-slate-400">{item.dealCount} deals</p>
                  </div>
                </div>
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${item.collectionRate}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs">Total Value</p>
                    <p className="font-semibold text-slate-800">AED {(item.totalValue / 1_000_000).toFixed(1)}M</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Paid</p>
                    <p className="font-semibold text-emerald-600">AED {(item.totalPaid / 1_000_000).toFixed(1)}M</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Outstanding</p>
                    <p className="font-semibold text-red-600">AED {(item.outstanding / 1_000_000).toFixed(1)}M</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
