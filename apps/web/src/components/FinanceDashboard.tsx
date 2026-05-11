import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { AlertTriangle, Calendar, CheckCircle2 } from "lucide-react";
import { PageHeader, PageContainer } from "./layout";

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
}

const TABS: TabType[] = [
  { label: "Overview",             id: "overview" },
  { label: "Overdue",              id: "overdue"  },
  { label: "Upcoming",             id: "upcoming" },
  { label: "Collections pipeline", id: "pipeline" },
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
      <div className="flex flex-col h-full bg-background">
        <PageHeader
          crumbs={[{ label: "Home", path: "/" }, { label: "Finance" }]}
          title="Finance"
          subtitle="Loading…"
        />
        <div className="flex-1 overflow-auto">
          <PageContainer>
            <div
              className="bg-card rounded-xl border border-border flex items-center justify-center h-72"
              role="status" aria-busy="true" aria-label="Loading"
            >
              <div className="w-7 h-7 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
            </div>
          </PageContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Finance" }]}
        title="Finance"
        subtitle="Receivables tracking, overdue alerts, collections pipeline"
        tabs={
          <div
            className="flex gap-1.5 overflow-x-auto sm:flex-wrap -mx-1 px-1 scrollbar-thin py-2 items-center"
            role="tablist"
            aria-label="Finance view"
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  aria-selected={active}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        }
      />

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <PageContainer>
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Total Receivable</p>
                <p className="text-2xl font-bold text-foreground">
                  AED {(metrics.totalReceivable / 1_000_000).toFixed(1)}M
                </p>
                <p className="text-xs text-muted-foreground mt-1">{deals.length} deals</p>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Collected</p>
                <p className="text-2xl font-bold text-success">
                  AED {(metrics.totalPaid / 1_000_000).toFixed(1)}M
                </p>
                <p className="text-xs text-muted-foreground mt-1">{metrics.paidPercentage}% collected</p>
              </div>

              <div className="bg-card border border-destructive/30 rounded-lg p-4 bg-destructive-soft">
                <p className="text-xs text-destructive uppercase tracking-wide font-semibold mb-2 inline-flex items-center gap-1"><AlertTriangle className="size-3.5" /> Overdue</p>
                <p className="text-2xl font-bold text-destructive">AED {(metrics.totalOverdue / 1_000_000).toFixed(1)}M</p>
                <p className="text-xs text-destructive mt-1">{metrics.overdueCount} payments</p>
              </div>

              <div className="bg-card border border-warning/30 rounded-lg p-4 bg-warning-soft">
                <p className="text-xs text-warning uppercase tracking-wide font-semibold mb-2 inline-flex items-center gap-1"><Calendar className="size-3.5" /> This Month</p>
                <p className="text-2xl font-bold text-warning">{metrics.upcomingCount}</p>
                <p className="text-xs text-warning mt-1">payments due</p>
              </div>

              <div className="bg-card border border-warning/30 rounded-lg p-4 bg-warning-soft">
                <p className="text-xs text-warning uppercase tracking-wide font-semibold mb-2">⏰ At Risk</p>
                <p className="text-2xl font-bold text-warning">{metrics.atRisk}</p>
                <p className="text-xs text-warning mt-1">Oqood deadline {'<'} 7 days</p>
              </div>
            </div>

            {/* Collection Rate by Stage */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-semibold text-foreground mb-4">Collection Rate by Stage</h3>
              <div className="space-y-3">
                {pipeline.map((item) => (
                  <div key={item.stage}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{item.stage.replace(/_/g, " ")}</span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-foreground">{item.collectionRate}%</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({item.dealCount} {item.dealCount === 1 ? "deal" : "deals"})
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${item.collectionRate}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
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
          <div>
            {overduePayments.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="size-8 mb-2 mx-auto text-success" />
                <p className="font-semibold text-foreground">No overdue payments</p>
                <p className="text-sm text-muted-foreground">All payments are current or paid</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">Deal</th>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">Buyer</th>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">Milestone</th>
                      <th className="text-right px-4 py-3 font-semibold text-foreground">Amount</th>
                      <th className="text-center px-4 py-3 font-semibold text-foreground">Days Overdue</th>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {overduePayments.map((p) => (
                      <tr key={p.id} className="hover:bg-destructive-soft/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.dealNumber}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{p.buyerName}</p>
                          <p className="text-xs text-muted-foreground">{p.unitNumber}</p>
                        </td>
                        <td className="px-4 py-3 text-foreground">{p.milestoneLabel}</td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                          AED {p.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 rounded-full bg-destructive-soft text-destructive font-semibold text-xs">
                            {p.daysOverdue}d
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs capitalize text-muted-foreground">{p.status.replace(/_/g, " ")}</span>
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
          <div>
            {upcomingPayments.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="size-8 mb-2 mx-auto text-muted-foreground" />
                <p className="font-semibold text-foreground">No upcoming payments this month</p>
                <p className="text-sm text-muted-foreground">Expand date range to see more</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">Deal</th>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">Buyer</th>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">Milestone</th>
                      <th className="text-right px-4 py-3 font-semibold text-foreground">Amount</th>
                      <th className="text-center px-4 py-3 font-semibold text-foreground">Days Until Due</th>
                      <th className="text-left px-4 py-3 font-semibold text-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {upcomingPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-warning-soft/50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.dealNumber}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{p.buyerName}</p>
                          <p className="text-xs text-muted-foreground">{p.unitNumber}</p>
                        </td>
                        <td className="px-4 py-3 text-foreground">{p.milestoneLabel}</td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                          AED {p.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 rounded-full bg-warning-soft text-warning font-semibold text-xs">
                            {p.daysUntilDue}d
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs capitalize text-muted-foreground">{p.status.replace(/_/g, " ")}</span>
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
          <div className="space-y-4">
            {pipeline.map((item) => (
              <div key={item.stage} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">{item.stage.replace(/_/g, " ")}</h3>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">{item.collectionRate}% collected</p>
                    <p className="text-xs text-muted-foreground">{item.dealCount} deals</p>
                  </div>
                </div>
                <div className="w-full h-3 bg-neutral-200 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${item.collectionRate}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Total Value</p>
                    <p className="font-semibold text-foreground">AED {(item.totalValue / 1_000_000).toFixed(1)}M</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Paid</p>
                    <p className="font-semibold text-success">AED {(item.totalPaid / 1_000_000).toFixed(1)}M</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Outstanding</p>
                    <p className="font-semibold text-destructive">AED {(item.outstanding / 1_000_000).toFixed(1)}M</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </PageContainer>
      </div>
    </div>
  );
}
