import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { formatDirham } from "@/lib/money";
import PaymentActionModal, { PaymentAction, PaymentSummary } from "./PaymentActionModal";
import { PageContainer, PageHeader } from "./layout";
import { Button } from "@/components/ui/button";

interface Payment extends PaymentSummary {
  percentage: number;
  paidDate?: string;
  isWaived?: boolean;
}

interface PaymentReport {
  byStatus: Record<string, Payment[]>;
  totals: Record<string, number>;
}

interface CollectionsData {
  overdue: { count: number; total: number };
  aging: Array<{ range: string; count: number; amount: number }>;
  upcoming: {
    next7Days:  { count: number; total: number; payments: Payment[] };
    next30Days: { count: number; total: number; payments: Payment[] };
  };
}

const STATUS_ORDER = ["OVERDUE", "PENDING", "PARTIAL", "PDC_PENDING", "PAID", "PDC_CLEARED", "CANCELLED", "PDC_BOUNCED", "UPCOMING"];

const STATUS_CONFIG: Record<string, { label: string; badge: string; kpi: string }> = {
  OVERDUE:     { label: "Overdue",      badge: "bg-destructive-soft text-destructive",         kpi: "text-destructive" },
  PENDING:     { label: "Pending",      badge: "bg-warning-soft text-warning",     kpi: "text-warning" },
  PARTIAL:     { label: "Partial",      badge: "bg-info-soft text-primary",       kpi: "text-primary" },
  PDC_PENDING: { label: "PDC Pending",  badge: "bg-warning-soft text-warning",   kpi: "text-warning" },
  PAID:        { label: "Paid",         badge: "bg-success-soft text-success", kpi: "text-success" },
  PDC_CLEARED: { label: "PDC Cleared",  badge: "bg-chart-5/15 text-chart-5",       kpi: "text-chart-5" },
  PDC_BOUNCED: { label: "PDC Bounced",  badge: "bg-destructive/30 text-destructive-soft-foreground",         kpi: "text-destructive" },
  CANCELLED:   { label: "Cancelled",    badge: "bg-muted text-muted-foreground",     kpi: "text-muted-foreground" },
  UPCOMING:    { label: "Upcoming",     badge: "bg-info-soft text-primary",       kpi: "text-primary" },
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
const daysAgo = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
const fmtK = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n);

// Actions available per status
function getActions(status: string): PaymentAction[] {
  switch (status) {
    case "PENDING":
    case "OVERDUE":
      return ["MARK_PAID", "PARTIAL", "MARK_PDC", "ADJUST_DATE", "ADJUST_AMOUNT", "WAIVE"];
    case "PARTIAL":
      return ["MARK_PAID", "PARTIAL", "ADJUST_DATE", "WAIVE"];
    case "PDC_PENDING":
      return ["PDC_CLEARED", "PDC_BOUNCED", "ADJUST_DATE"];
    case "PDC_BOUNCED":
      return ["MARK_PAID", "MARK_PDC", "WAIVE"];
    default:
      return [];
  }
}

const ACTION_LABELS: Partial<Record<PaymentAction, string>> = {
  MARK_PAID:    "Mark Paid",
  PARTIAL:      "Partial",
  MARK_PDC:     "PDC",
  PDC_CLEARED:  "Cleared",
  PDC_BOUNCED:  "Bounced",
  ADJUST_DATE:  "Adj. Date",
  ADJUST_AMOUNT:"Adj. Amount",
  WAIVE:        "Waive",
};

const ACTION_STYLES: Partial<Record<PaymentAction, string>> = {
  MARK_PAID:    "bg-success-soft text-success hover:bg-success-soft border-success/30",
  PARTIAL:      "bg-info-soft text-primary hover:bg-info-soft border-primary/40",
  MARK_PDC:     "bg-warning-soft text-warning hover:bg-warning-soft border-warning/30",
  PDC_CLEARED:  "bg-chart-5/10 text-chart-5 hover:bg-chart-5/15 border-chart-5/30",
  PDC_BOUNCED:  "bg-destructive-soft text-destructive hover:bg-destructive-soft border-destructive/30",
  ADJUST_DATE:  "bg-muted/50 text-muted-foreground hover:bg-muted border-border",
  ADJUST_AMOUNT:"bg-muted/50 text-muted-foreground hover:bg-muted border-border",
  WAIVE:        "bg-destructive-soft text-destructive hover:bg-destructive-soft border-destructive/30",
};

function exportCSV(payments: Payment[], filename: string) {
  const header = ["Deal #", "Buyer", "Unit", "Milestone", "Due Date", "Amount (AED)", "Status", "Days Overdue"];
  const rows = payments.map((p) => {
    const days = Math.floor((Date.now() - new Date(p.dueDate).getTime()) / 86400000);
    return [
      p.deal.dealNumber,
      `${p.deal.lead.firstName} ${p.deal.lead.lastName}`,
      p.deal.unit.unitNumber,
      p.milestoneLabel,
      new Date(p.dueDate).toLocaleDateString("en-AE"),
      p.amount.toString(),
      p.status,
      days > 0 ? String(days) : "0",
    ];
  });
  const csv = [header, ...rows].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function PaymentReportPage() {
  const [report, setReport]             = useState<PaymentReport | null>(null);
  const [collections, setCollections]   = useState<CollectionsData | null>(null);
  const [loading, setLoading]           = useState(true);
  const [activeStatus, setActiveStatus] = useState("OVERDUE");
  const [upcomingView, setUpcomingView] = useState<"7" | "30">("7");
  const [modal, setModal]               = useState<{ payment: Payment; action: PaymentAction } | null>(null);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  const sendReminder = useCallback(async (paymentId: string) => {
    setSendingReminder(paymentId);
    try {
      await axios.post(`/api/payments/${paymentId}/reminder`);
      toast.success("Reminder sent to buyer");
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        toast.error("Reminder endpoint not configured on the API yet.");
      } else {
        toast.error(err?.response?.data?.error || "Failed to send reminder");
      }
    } finally {
      setSendingReminder(null);
    }
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      axios.get("/api/reports/payments"),
      axios.get("/api/reports/collections"),
    ])
      .then(([rpt, col]) => { setReport(rpt.data); setCollections(col.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !report) return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Payments" }]}
        title="Payments"
        subtitle="Loading…"
      />
      <div className="flex-1 overflow-auto">
        <PageContainer>
          <div
            className="bg-card rounded-xl border border-border flex items-center justify-center h-64"
            role="status" aria-busy="true" aria-label="Loading"
          >
            <div className="w-7 h-7 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
          </div>
        </PageContainer>
      </div>
    </div>
  );

  const isUpcoming = activeStatus === "UPCOMING";
  const upcomingPayments = isUpcoming
    ? (collections?.upcoming[upcomingView === "7" ? "next7Days" : "next30Days"]?.payments ?? [])
    : [];
  const activePayments = isUpcoming ? upcomingPayments : (report.byStatus[activeStatus] || []);
  const availableActions = isUpcoming ? [] : getActions(activeStatus);

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Payments" }]}
        title="Payments"
        subtitle="Track and manage all payment milestones"
        actions={<Button variant="outline" onClick={load}>Refresh</Button>}
      />

      <PageContainer padding="default" className="space-y-5">
      {/* Collections overview widgets — shown on OVERDUE tab */}
      {activeStatus === "OVERDUE" && collections && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {collections.aging.map(({ range, count, amount }) => {
            const colors: Record<string, string> = {
              "0-30":  "bg-warning-soft border-warning/30 text-warning",
              "31-60": "bg-warning-soft border-warning/30 text-warning",
              "61-90": "bg-destructive-soft border-destructive/30 text-destructive",
              "90+":   "bg-destructive-soft border-destructive/30 text-destructive-soft-foreground",
            };
            return (
              <div key={range} className={`rounded-xl border p-4 ${colors[range] || "bg-muted/50 border-border text-muted-foreground"}`}>
                <p className="text-xs font-bold uppercase tracking-wide mb-1">{range} days overdue</p>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs mt-0.5 opacity-80">{formatDirham(amount)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* KPI tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-2">
        {STATUS_ORDER.map((status) => {
          const cfg = STATUS_CONFIG[status];
          if (!cfg) return null;
          const isUpcomingTab = status === "UPCOMING";
          const payments = isUpcomingTab
            ? (collections?.upcoming.next30Days.payments ?? [])
            : (report.byStatus[status] || []);
          const total = isUpcomingTab
            ? (collections?.upcoming.next30Days.total ?? 0)
            : (report.totals?.[status] ?? payments.reduce((s, p) => s + p.amount, 0));
          const isActive = activeStatus === status;
          return (
            <button
              key={status}
              onClick={() => setActiveStatus(status)}
              className={`rounded-xl p-3 text-left transition-all border-2 ${isActive ? "border-border bg-card shadow-sm" : "border-transparent bg-card hover:border-border"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${cfg.kpi}`}>{cfg.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cfg.badge}`}>{payments.length}</span>
              </div>
              <p className={`text-base font-bold ${cfg.kpi}`}>{formatDirham(total)}</p>
            </button>
          );
        })}
      </div>

      {/* Upcoming payments view toggle */}
      {isUpcoming && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Show:</span>
          {(["7", "30"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setUpcomingView(d)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                upcomingView === d ? "bg-primary text-white border-primary/40" : "border-border text-muted-foreground hover:bg-muted/50"
              }`}
            >
              Next {d} days
            </button>
          ))}
          {collections && (
            <span className="ml-2 text-xs text-muted-foreground">
              {upcomingView === "7"
                ? <>{collections.upcoming.next7Days.count} payments · {formatDirham(collections.upcoming.next7Days.total)}</>
                : <>{collections.upcoming.next30Days.count} payments · {formatDirham(collections.upcoming.next30Days.total)}</>}
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-foreground text-sm">{STATUS_CONFIG[activeStatus]?.label || activeStatus}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[activeStatus]?.badge}`}>
              {activePayments.length} payments
            </span>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm font-bold text-muted-foreground">
              {formatDirham(activePayments.reduce((s, p) => s + p.amount, 0))}
            </p>
            {activePayments.length > 0 && (
              <button
                onClick={() => exportCSV(activePayments, `payments-${activeStatus.toLowerCase()}-${new Date().toISOString().slice(0,10)}.csv`)}
                className="text-xs text-primary hover:text-primary border border-primary/40 hover:bg-info-soft rounded-lg px-3 py-1.5 transition-colors font-medium"
              >
                ↓ Export CSV
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["Deal #", "Buyer", "Unit", "Milestone", "Due Date", "Amount", "Info", ...(availableActions.length ? ["Actions"] : [])].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activePayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    No payments in this category
                  </td>
                </tr>
              ) : (
                activePayments.map((p) => {
                  const days = daysAgo(p.dueDate);
                  const isOverdue = activeStatus === "OVERDUE";
                  return (
                    <tr key={p.id} className="hover:bg-muted/80 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.deal.dealNumber}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">{p.deal.lead.firstName} {p.deal.lead.lastName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{p.deal.unit.unitNumber}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-muted-foreground text-xs max-w-[140px] truncate" title={p.milestoneLabel}>{p.milestoneLabel}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-foreground">{fmtDate(p.dueDate)}</p>
                        {p.paidDate && <p className="text-xs text-success">Paid {fmtDate(p.paidDate)}</p>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-semibold text-foreground">{formatDirham(p.amount)}</p>
                        <p className="text-xs text-muted-foreground">{p.percentage}%</p>
                      </td>
                      <td className="px-4 py-3">
                        {isOverdue && days > 0 && (
                          <span className="text-xs font-semibold text-destructive">{days}d overdue</span>
                        )}
                        {activeStatus === "PDC_BOUNCED" && (
                          <span className="text-xs font-semibold text-destructive">Bounced</span>
                        )}
                        {activeStatus === "PARTIAL" && (
                          <span className="text-xs text-primary font-medium">Partial</span>
                        )}
                      </td>
                      {availableActions.length > 0 && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {isOverdue && (
                              <button
                                onClick={() => sendReminder(p.id)}
                                disabled={sendingReminder === p.id}
                                title="Send a reminder to the buyer"
                                className="text-[10px] font-semibold px-2 py-1 rounded-md border bg-warning-soft text-warning hover:bg-warning-soft border-warning/30 transition-colors disabled:opacity-50 whitespace-nowrap"
                              >
                                {sendingReminder === p.id ? "Sending…" : <span className="inline-flex items-center gap-1.5"><Send className="size-3.5" /> Send Reminder</span>}
                              </button>
                            )}
                            {availableActions.map((act) => (
                              <button
                                key={act}
                                onClick={() => setModal({ payment: p, action: act })}
                                className={`text-[10px] font-medium px-2 py-1 rounded-md border transition-colors whitespace-nowrap ${ACTION_STYLES[act] || "bg-muted/50 text-muted-foreground border-border"}`}
                              >
                                {ACTION_LABELS[act]}
                              </button>
                            ))}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <PaymentActionModal
          payment={modal.payment}
          action={modal.action}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); load(); }}
        />
      )}
      </PageContainer>
    </div>
  );
}
