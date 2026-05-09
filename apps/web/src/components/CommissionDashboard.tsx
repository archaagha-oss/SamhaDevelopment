import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import EmptyState from "./EmptyState";
import { PageHeader } from "./ui/PageHeader";

interface Commission {
  id: string; amount: number; rate: number; status: string;
  spaSignedMet: boolean; oqoodMet: boolean;
  paidDate?: string; paidAmount?: number; paidVia?: string;
  deal: {
    dealNumber: string; stage: string;
    unit: { unitNumber: string };
    lead: { firstName: string; lastName: string };
    salePrice: number;
  };
  brokerCompany?: { name: string };
}
interface Stats { [status: string]: { count: number; total: number } | undefined; }

type Tab = "PENDING_APPROVAL" | "APPROVED" | "PAID";

const fmtM = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(2)}M` : n >= 1000 ? `${(n/1000).toFixed(0)}K` : String(n);

export default function CommissionDashboard() {
  const [tab, setTab] = useState<Tab>("PENDING_APPROVAL");
  const [pending, setPending] = useState<Commission[]>([]);
  const [approved, setApproved] = useState<Commission[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState<Commission[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [showPayModal, setShowPayModal] = useState<Commission | null>(null);
  const [payForm, setPayForm] = useState({ paidAmount: "", paidVia: "BANK_TRANSFER", receiptKey: "" });
  const [payingId, setPayingId] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      axios.get("/api/commissions/pending"),
      axios.get("/api/commissions/stats"),
      axios.get("/api/commissions", { params: { status: "APPROVED", limit: 100 } }),
      axios.get("/api/commissions", { params: { status: "PAID", limit: 100 } }),
    ]).then(([pendingRes, statsRes, approvedRes, paidRes]) => {
      setPending(pendingRes.data);
      setStats(statsRes.data);
      setApproved(approvedRes.data.data || approvedRes.data);
      setPaid(paidRes.data.data || paidRes.data);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(fetchData, []);

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      await axios.patch(`/api/commissions/${id}/approve`, { approvedBy: "system" });
      toast.success("Commission approved");
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to approve");
    } finally {
      setApprovingId(null);
    }
  };

  const handleMarkPaid = async () => {
    if (!showPayModal) return;
    setPayingId(showPayModal.id);
    try {
      await axios.patch(`/api/commissions/${showPayModal.id}/paid`, {
        paidAmount: payForm.paidAmount || showPayModal.amount,
        paidVia: payForm.paidVia,
        receiptKey: payForm.receiptKey || null,
      });
      toast.success("Commission marked as paid");
      setShowPayModal(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to mark as paid");
    } finally {
      setPayingId(null);
    }
  };

  const canApprove = (c: Commission) => c.spaSignedMet && c.oqoodMet;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

  const kpis = [
    { label: "Pending Approval", key: "PENDING_APPROVAL", color: "text-amber-600",   bg: "bg-amber-50" },
    { label: "Approved",         key: "APPROVED",         color: "text-blue-600",    bg: "bg-blue-50" },
    { label: "Paid",             key: "PAID",             color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Not Due",          key: "NOT_DUE",          color: "text-slate-500",   bg: "bg-slate-50" },
  ];

  const tableRows = tab === "PENDING_APPROVAL" ? pending : tab === "APPROVED" ? approved : paid;

  return (
    <>
      <PageHeader
        title="Commissions"
        description="Review, approve and pay broker commissions"
      />
      <div className="p-6 space-y-5">

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(({ label, key, color, bg }) => {
          const s = stats[key];
          return (
            <div key={key} className={`${bg} rounded-xl p-4 border border-slate-200`}>
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{s?.count ?? 0}</p>
              <p className="text-xs text-slate-400 mt-0.5">AED {fmtM(s?.total ?? 0)}</p>
            </div>
          );
        })}
      </div>

      {/* Tab header */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setTab("PENDING_APPROVAL")}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                tab === "PENDING_APPROVAL" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Pending Approval
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                tab === "PENDING_APPROVAL" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-500"
              }`}>{pending.length}</span>
            </button>
            <button
              onClick={() => setTab("APPROVED")}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                tab === "APPROVED" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Ready to Pay
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                tab === "APPROVED" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"
              }`}>{approved.length}</span>
            </button>
            <button
              onClick={() => setTab("PAID")}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                tab === "PAID" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Paid
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                tab === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
              }`}>{paid.length}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {["Deal", "Buyer", "Unit", "Broker", "Amount", "Rate", tab === "PAID" ? "Paid On" : "Conditions", "Action"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tableRows.length === 0 ? (
                <tr><td colSpan={8}>
                  <EmptyState
                    icon="◇"
                    title={tab === "PENDING_APPROVAL" ? "No commissions pending approval" : "No commissions awaiting payment"}
                    description={tab === "PENDING_APPROVAL"
                      ? "Commissions appear here once SPA is signed and Oqood is registered."
                      : "Once commissions are approved, they appear here for payment processing."}
                  />
                </td></tr>
              ) : tableRows.map((c) => {
                const approvable = canApprove(c);
                return (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.deal.dealNumber}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {c.deal.lead.firstName} {c.deal.lead.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{c.deal.unit.unitNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{c.brokerCompany?.name || "—"}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">AED {c.amount.toLocaleString()}</p>
                      {tab === "PAID" && c.paidAmount && c.paidAmount !== c.amount && (
                        <p className="text-xs text-slate-400">Paid: AED {c.paidAmount.toLocaleString()}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.rate}%</td>
                    <td className="px-4 py-3">
                      {tab === "PAID" ? (
                        <div>
                          {c.paidDate && <p className="text-xs font-semibold text-emerald-700">{fmtDate(c.paidDate)}</p>}
                          {c.paidVia && <p className="text-xs text-slate-500">{c.paidVia.replace(/_/g, " ")}</p>}
                        </div>
                      ) : (
                        <div className="flex gap-1.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${c.spaSignedMet ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                            SPA {c.spaSignedMet ? "✓" : "✗"}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${c.oqoodMet ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                            Oqood {c.oqoodMet ? "✓" : "✗"}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {tab === "PENDING_APPROVAL" ? (
                        <button
                          onClick={() => handleApprove(c.id)}
                          disabled={!approvable || approvingId === c.id}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                            approvable
                              ? "bg-blue-600 text-white hover:bg-blue-700"
                              : "bg-slate-100 text-slate-400 cursor-not-allowed"
                          }`}
                        >
                          {approvingId === c.id ? "…" : approvable ? "Approve" : "Blocked"}
                        </button>
                      ) : tab === "APPROVED" ? (
                        <button
                          onClick={() => { setShowPayModal(c); setPayForm({ paidAmount: String(c.amount), paidVia: "BANK_TRANSFER", receiptKey: "" }); }}
                          disabled={payingId === c.id}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          {payingId === c.id ? "…" : "Mark Paid"}
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-600 font-semibold">✓ Paid</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {/* Mark Paid Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Mark Commission as Paid</h3>
              <p className="text-xs text-slate-400 mt-0.5">{showPayModal.deal.dealNumber} · {showPayModal.brokerCompany?.name}</p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Amount Paid (AED)</label>
                <input
                  type="number"
                  value={payForm.paidAmount}
                  onChange={(e) => setPayForm((f) => ({ ...f, paidAmount: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Method</label>
                <select
                  value={payForm.paidVia}
                  onChange={(e) => setPayForm((f) => ({ ...f, paidVia: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-emerald-400"
                >
                  {["BANK_TRANSFER","CHEQUE","CASH"].map((m) => (
                    <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Receipt / Reference (optional)</label>
                <input
                  type="text"
                  value={payForm.receiptKey}
                  onChange={(e) => setPayForm((f) => ({ ...f, receiptKey: e.target.value }))}
                  placeholder="e.g. CHQ-2026-001"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setShowPayModal(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm">
                Cancel
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={payingId !== null}
                className="flex-1 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50"
              >
                {payingId ? "Saving…" : "Confirm Paid"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
