import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";

interface Payment {
  id: string;
  amount: number;
  dueDate: string;
  paidDate?: string | null;
  status: string;
  milestoneLabel: string;
  deal: {
    id: string;
    dealNumber: string;
    lead: { firstName: string; lastName: string; phone?: string };
    unit: { unitNumber: string };
  };
}

interface PaymentReport {
  byStatus: Record<string, Payment[]>;
}

interface Collections {
  overdue: { count: number; total: number };
}

const fmtAED = (n: number) => `AED ${n.toLocaleString("en-AE")}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short" });

function isThisMonth(date: string): boolean {
  const d = new Date(date);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-slate-200 rounded-lg animate-pulse ${className}`} />;
}

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const [report, setReport] = useState<PaymentReport | null>(null);
  const [collections, setCollections] = useState<Collections | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      axios.get("/api/reports/payments"),
      axios.get("/api/reports/collections"),
    ])
      .then(([rpt, col]) => {
        setReport(rpt.data);
        setCollections(col.data);
      })
      .catch((err) => console.error("Finance dashboard load failed", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const sendReminder = useCallback(async (paymentId: string) => {
    setSendingReminderId(paymentId);
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
      setSendingReminderId(null);
    }
  }, []);

  // Derived metrics
  const pendingPayments = report
    ? [
        ...(report.byStatus.PENDING || []),
        ...(report.byStatus.OVERDUE || []),
        ...(report.byStatus.PARTIAL || []),
        ...(report.byStatus.PDC_PENDING || []),
      ]
    : [];
  const totalReceivables = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
  const overdueAmount = collections?.overdue.total ?? 0;
  const overduePayments = report?.byStatus.OVERDUE ?? [];
  const paidThisMonth = (report?.byStatus.PAID ?? []).filter((p) => p.paidDate && isThisMonth(p.paidDate));
  const collectedThisMonth = paidThisMonth.reduce((sum, p) => sum + p.amount, 0);
  const recentPayments = [...(report?.byStatus.PAID ?? [])]
    .filter((p) => p.paidDate)
    .sort((a, b) => new Date(b.paidDate!).getTime() - new Date(a.paidDate!).getTime())
    .slice(0, 8);

  if (loading) {
    return (
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Finance Dashboard</h1>
          <p className="text-slate-400 text-xs mt-0.5">Receivables, collections, and overdue at a glance</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/payments")}
            className="text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            Full Payments View
          </button>
          <button
            onClick={load}
            className="text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Receivables</p>
          <p className="text-2xl font-bold text-slate-900">{fmtAED(totalReceivables)}</p>
          <p className="text-xs text-slate-400 mt-1">Across {pendingPayments.length} unpaid milestones</p>
        </div>
        <div className="bg-white rounded-xl border border-rose-200 bg-rose-50/40 p-5">
          <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide mb-1">Overdue Amount</p>
          <p className="text-2xl font-bold text-rose-700">{fmtAED(overdueAmount)}</p>
          <p className="text-xs text-rose-500 mt-1">{collections?.overdue.count ?? 0} payments past due</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/40 p-5">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Collected This Month</p>
          <p className="text-2xl font-bold text-emerald-700">{fmtAED(collectedThisMonth)}</p>
          <p className="text-xs text-emerald-600 mt-1">{paidThisMonth.length} payments received</p>
        </div>
      </div>

      {/* Overdue list with CTAs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-rose-500">⚠️</span>
            <h2 className="text-sm font-semibold text-slate-800">Overdue Payments</h2>
            <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded-full font-semibold">
              {overduePayments.length}
            </span>
          </div>
        </div>
        {overduePayments.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-400 text-sm">
            No overdue payments — nice work! 🎉
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Deal</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Buyer</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Milestone</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Due</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {overduePayments.slice(0, 15).map((p) => {
                const days = Math.floor((Date.now() - new Date(p.dueDate).getTime()) / 86400000);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.deal.dealNumber}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{p.deal.lead.firstName} {p.deal.lead.lastName}</p>
                      <p className="text-xs text-slate-400">{p.deal.unit.unitNumber}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-xs max-w-[180px] truncate" title={p.milestoneLabel}>
                      {p.milestoneLabel}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <p className="text-slate-700 text-xs">{fmtDate(p.dueDate)}</p>
                      <p className="text-xs font-semibold text-rose-600">{days}d overdue</p>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap font-semibold text-slate-800">
                      {fmtAED(p.amount)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => navigate(`/deals/${p.deal.id}`)}
                          className="text-[11px] font-medium px-2.5 py-1 rounded-md border bg-white text-slate-700 hover:bg-slate-50 border-slate-200 transition-colors"
                        >
                          View Deal
                        </button>
                        <button
                          onClick={() => sendReminder(p.id)}
                          disabled={sendingReminderId === p.id}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-md border bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-300 transition-colors disabled:opacity-50"
                        >
                          {sendingReminderId === p.id ? "Sending…" : "📨 Send Reminder"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent payments */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Recent Payments</h2>
        </div>
        {recentPayments.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-400 text-sm">No payments recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Deal</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Buyer</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Milestone</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Paid On</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentPayments.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/deals/${p.deal.id}`)}
                  className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.deal.dealNumber}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800">{p.deal.lead.firstName} {p.deal.lead.lastName}</p>
                    <p className="text-xs text-slate-400">{p.deal.unit.unitNumber}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-600 text-xs max-w-[180px] truncate" title={p.milestoneLabel}>
                    {p.milestoneLabel}
                  </td>
                  <td className="px-5 py-3 text-xs text-emerald-600 whitespace-nowrap">
                    {p.paidDate ? fmtDate(p.paidDate) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                    {fmtAED(p.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        Showing the most recent {recentPayments.length} payments and up to 15 overdue rows.
        For full collections details, open the Payments page.
      </p>
    </div>
  );
}
