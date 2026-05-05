import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import PaymentActionModal, { PaymentAction, PaymentSummary } from "./PaymentActionModal";

interface Payment extends PaymentSummary {
  percentage: number;
  paidDate?: string;
  isWaived?: boolean;
}

interface PaymentReport {
  byStatus: Record<string, Payment[]>;
  totals: Record<string, number>;
}

const STATUS_ORDER = ["OVERDUE", "PENDING", "PARTIAL", "PDC_PENDING", "PAID", "PDC_CLEARED", "CANCELLED", "PDC_BOUNCED"];

const STATUS_CONFIG: Record<string, { label: string; badge: string; kpi: string }> = {
  OVERDUE:     { label: "Overdue",      badge: "bg-red-100 text-red-700",         kpi: "text-red-600" },
  PENDING:     { label: "Pending",      badge: "bg-amber-100 text-amber-700",     kpi: "text-amber-600" },
  PARTIAL:     { label: "Partial",      badge: "bg-blue-100 text-blue-700",       kpi: "text-blue-600" },
  PDC_PENDING: { label: "PDC Pending",  badge: "bg-orange-100 text-orange-700",   kpi: "text-orange-600" },
  PAID:        { label: "Paid",         badge: "bg-emerald-100 text-emerald-700", kpi: "text-emerald-600" },
  PDC_CLEARED: { label: "PDC Cleared",  badge: "bg-teal-100 text-teal-700",       kpi: "text-teal-600" },
  PDC_BOUNCED: { label: "PDC Bounced",  badge: "bg-red-200 text-red-800",         kpi: "text-red-700" },
  CANCELLED:   { label: "Cancelled",    badge: "bg-slate-100 text-slate-600",     kpi: "text-slate-500" },
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
  MARK_PAID:    "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200",
  PARTIAL:      "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
  MARK_PDC:     "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200",
  PDC_CLEARED:  "bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200",
  PDC_BOUNCED:  "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
  ADJUST_DATE:  "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200",
  ADJUST_AMOUNT:"bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200",
  WAIVE:        "bg-red-50 text-red-600 hover:bg-red-100 border-red-200",
};

// Aging buckets for overdue payments
function agingBuckets(payments: Payment[]) {
  const now = Date.now();
  const b = { "0–30": [] as Payment[], "31–60": [] as Payment[], "61–90": [] as Payment[], "90+": [] as Payment[] };
  for (const p of payments) {
    const days = Math.floor((now - new Date(p.dueDate).getTime()) / 86400000);
    if (days <= 30) b["0–30"].push(p);
    else if (days <= 60) b["31–60"].push(p);
    else if (days <= 90) b["61–90"].push(p);
    else b["90+"].push(p);
  }
  return b;
}

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
  const [report, setReport]       = useState<PaymentReport | null>(null);
  const [loading, setLoading]     = useState(true);
  const [activeStatus, setActiveStatus] = useState("OVERDUE");
  const [modal, setModal]         = useState<{ payment: Payment; action: PaymentAction } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    axios.get("/api/reports/payments")
      .then((r) => setReport(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !report) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const activePayments = report.byStatus[activeStatus] || [];
  const availableActions = getActions(activeStatus);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Payment Collections</h1>
          <p className="text-slate-400 text-xs mt-0.5">Track and manage all payment milestones</p>
        </div>
        <button onClick={load} className="text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors">
          Refresh
        </button>
      </div>

      {/* KPI tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {STATUS_ORDER.map((status) => {
          const cfg = STATUS_CONFIG[status];
          if (!cfg) return null;
          const payments = report.byStatus[status] || [];
          const total = report.totals?.[status] ?? payments.reduce((s, p) => s + p.amount, 0);
          const isActive = activeStatus === status;
          return (
            <button
              key={status}
              onClick={() => setActiveStatus(status)}
              className={`rounded-xl p-3 text-left transition-all border-2 ${isActive ? "border-slate-800 bg-white shadow-sm" : "border-transparent bg-white hover:border-slate-300"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${cfg.kpi}`}>{cfg.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cfg.badge}`}>{payments.length}</span>
              </div>
              <p className={`text-base font-bold ${cfg.kpi}`}>AED {fmtK(total)}</p>
            </button>
          );
        })}
      </div>

      {/* Aging buckets — only shown on OVERDUE tab */}
      {activeStatus === "OVERDUE" && activePayments.length > 0 && (() => {
        const buckets = agingBuckets(activePayments);
        const bucketColors: Record<string, string> = {
          "0–30":  "bg-amber-50 text-amber-700 border-amber-200",
          "31–60": "bg-orange-50 text-orange-700 border-orange-200",
          "61–90": "bg-red-50 text-red-700 border-red-200",
          "90+":   "bg-red-100 text-red-800 border-red-300",
        };
        return (
          <div className="grid grid-cols-4 gap-3">
            {(["0–30", "31–60", "61–90", "90+"] as const).map((label) => {
              const bp = buckets[label];
              return (
                <div key={label} className={`rounded-xl border p-4 ${bucketColors[label]}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1">{label} days</p>
                  <p className="text-xl font-bold">{bp.length}</p>
                  <p className="text-xs mt-0.5 opacity-80">AED {bp.reduce((s, p) => s + p.amount, 0).toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-800 text-sm">{STATUS_CONFIG[activeStatus]?.label || activeStatus}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[activeStatus]?.badge}`}>
              {activePayments.length} payments
            </span>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm font-bold text-slate-600">
              AED {activePayments.reduce((s, p) => s + p.amount, 0).toLocaleString()}
            </p>
            {activePayments.length > 0 && (
              <button
                onClick={() => exportCSV(activePayments, `payments-${activeStatus.toLowerCase()}-${new Date().toISOString().slice(0,10)}.csv`)}
                className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:bg-blue-50 rounded-lg px-3 py-1.5 transition-colors font-medium"
              >
                ↓ Export CSV
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {["Deal #", "Buyer", "Unit", "Milestone", "Due Date", "Amount", "Info", ...(availableActions.length ? ["Actions"] : [])].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {activePayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-sm">
                    No payments in this category
                  </td>
                </tr>
              ) : (
                activePayments.map((p) => {
                  const days = daysAgo(p.dueDate);
                  const isOverdue = activeStatus === "OVERDUE";
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.deal.dealNumber}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{p.deal.lead.firstName} {p.deal.lead.lastName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-700">{p.deal.unit.unitNumber}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-600 text-xs max-w-[140px] truncate" title={p.milestoneLabel}>{p.milestoneLabel}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-slate-700">{fmtDate(p.dueDate)}</p>
                        {p.paidDate && <p className="text-xs text-emerald-600">Paid {fmtDate(p.paidDate)}</p>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-semibold text-slate-800">AED {p.amount.toLocaleString()}</p>
                        <p className="text-xs text-slate-400">{p.percentage}%</p>
                      </td>
                      <td className="px-4 py-3">
                        {isOverdue && days > 0 && (
                          <span className="text-xs font-semibold text-red-600">{days}d overdue</span>
                        )}
                        {activeStatus === "PDC_BOUNCED" && (
                          <span className="text-xs font-semibold text-red-700">Bounced</span>
                        )}
                        {activeStatus === "PARTIAL" && (
                          <span className="text-xs text-blue-600 font-medium">Partial</span>
                        )}
                      </td>
                      {availableActions.length > 0 && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {availableActions.map((act) => (
                              <button
                                key={act}
                                onClick={() => setModal({ payment: p, action: act })}
                                className={`text-[10px] font-medium px-2 py-1 rounded-md border transition-colors whitespace-nowrap ${ACTION_STYLES[act] || "bg-slate-50 text-slate-600 border-slate-200"}`}
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
    </div>
  );
}
