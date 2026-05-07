import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";

interface Commission {
  id: string;
  dealId: string;
  amount: number;
  status: "PENDING_APPROVAL" | "APPROVED" | "PAID";
  createdAt: string;
  approvedDate?: string;
  paidDate?: string;
  deal: {
    id: string;
    dealNumber: string;
    salePrice: number;
    spaSignedDate?: string;
    oqoodRegisteredDate?: string;
    lead: { id: string; firstName: string; lastName: string };
    unit: { id: string; number: string };
  };
  brokerCompany: { id: string; name: string };
}

interface Stats {
  [key: string]: { count: number; total: number };
}

const statusColors: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-50 border-amber-200",
  APPROVED: "bg-blue-50 border-blue-200",
  PAID: "bg-emerald-50 border-emerald-200",
};

const statusBadge: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-900",
  APPROVED: "bg-blue-100 text-blue-900",
  PAID: "bg-emerald-100 text-emerald-900",
};

export default function CommissionDashboard() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [tab, setTab] = useState<"pending" | "approved" | "paid">("pending");
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [paidFilter, setPaidFilter] = useState<"all" | "unpaid">("unpaid");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [commRes, statsRes] = await Promise.all([
        axios.get("/api/commissions?limit=1000"),
        axios.get("/api/commissions/stats"),
      ]);
      setCommissions(commRes.data.data || []);
      setStats(statsRes.data);
    } catch (err) {
      toast.error("Failed to load commissions");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (commissionId: string, commission: Commission) => {
    const spaOk = !!commission.deal.spaSignedDate;
    const oqoodOk = !!commission.deal.oqoodRegisteredDate;

    if (!spaOk || !oqoodOk) {
      const missing = [!spaOk && "SPA signing", !oqoodOk && "Oqood registration"].filter(Boolean).join(" & ");
      toast.error(`Cannot approve: Missing ${missing}`);
      return;
    }

    setApprovingId(commissionId);
    try {
      await axios.patch(`/api/commissions/${commissionId}/approve`);
      toast.success("Commission approved");
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Approval failed");
    } finally {
      setApprovingId(null);
    }
  };

  const handleMarkPaid = async (commissionId: string) => {
    try {
      await axios.patch(`/api/commissions/${commissionId}/paid`);
      toast.success("Commission marked as paid");
      fetchData();
    } catch (err) {
      toast.error("Failed to mark as paid");
    }
  };

  const filteredCommissions = commissions.filter((c) => {
    if (tab === "pending") return c.status === "PENDING_APPROVAL";
    if (tab === "approved") {
      if (paidFilter === "unpaid") return c.status === "APPROVED";
      return c.status === "APPROVED";
    }
    return c.status === "PAID";
  });

  const pendingStats = stats["PENDING_APPROVAL"] || { count: 0, total: 0 };
  const approvedStats = stats["APPROVED"] || { count: 0, total: 0 };
  const paidStats = stats["PAID"] || { count: 0, total: 0 };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Commission Dashboard</h1>
          <p className="text-sm text-slate-600 mt-1">Manage broker commission approvals and payments</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1 font-medium uppercase">Pending Approval</p>
            <p className="text-3xl font-bold text-amber-600">{pendingStats.count}</p>
            <p className="text-xs text-slate-600 mt-1">Total: {(pendingStats.total / 1000).toFixed(1)}k AED</p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1 font-medium uppercase">Approved</p>
            <p className="text-3xl font-bold text-blue-600">{approvedStats.count}</p>
            <p className="text-xs text-slate-600 mt-1">Total: {(approvedStats.total / 1000).toFixed(1)}k AED</p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1 font-medium uppercase">Paid</p>
            <p className="text-3xl font-bold text-emerald-600">{paidStats.count}</p>
            <p className="text-xs text-slate-600 mt-1">Total: {(paidStats.total / 1000).toFixed(1)}k AED</p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1 font-medium uppercase">Total Value</p>
            <p className="text-3xl font-bold text-slate-900">
              {((pendingStats.total + approvedStats.total + paidStats.total) / 1000).toFixed(1)}k
            </p>
            <p className="text-xs text-slate-600 mt-1">All commissions</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          {["pending", "approved", "paid"].map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t as any); setPaidFilter("unpaid"); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {t === "pending" && "Pending Approval"}
              {t === "approved" && "Approved"}
              {t === "paid" && "Paid"}
            </button>
          ))}
        </div>

        {/* Filter for Approved Tab */}
        {tab === "approved" && (
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setPaidFilter("unpaid")}
              className={`px-3 py-1.5 rounded text-xs font-medium ${
                paidFilter === "unpaid"
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              Unpaid Only
            </button>
            <button
              onClick={() => setPaidFilter("all")}
              className={`px-3 py-1.5 rounded text-xs font-medium ${
                paidFilter === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              All
            </button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
            <p className="text-slate-500">Loading commissions...</p>
          </div>
        ) : filteredCommissions.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
            <p className="text-slate-500">No commissions to display</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Deal</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Lead</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Broker</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Amount</th>
                    {tab === "pending" && <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Gates</th>}
                    {tab === "approved" && <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Approval Date</th>}
                    {tab === "paid" && <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Paid Date</th>}
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCommissions.map((c) => {
                    const spaOk = !!c.deal.spaSignedDate;
                    const oqoodOk = !!c.deal.oqoodRegisteredDate;
                    return (
                      <tr key={c.id} className={`${statusColors[c.status]} border-l-4`}>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{c.deal.dealNumber}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {c.deal.lead.firstName} {c.deal.lead.lastName}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">{c.brokerCompany.name}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                          {(c.amount / 1000).toFixed(1)}k
                        </td>

                        {/* Pending Tab: Show Gates */}
                        {tab === "pending" && (
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-2">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  spaOk
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {spaOk ? "✓ SPA" : "✗ SPA"}
                              </span>
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  oqoodOk
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {oqoodOk ? "✓ Oqood" : "✗ Oqood"}
                              </span>
                            </div>
                          </td>
                        )}

                        {/* Approved Tab: Show Approval Date */}
                        {tab === "approved" && (
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {c.approvedDate ? new Date(c.approvedDate).toLocaleDateString() : "—"}
                          </td>
                        )}

                        {/* Paid Tab: Show Paid Date */}
                        {tab === "paid" && (
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {c.paidDate ? new Date(c.paidDate).toLocaleDateString() : "—"}
                          </td>
                        )}

                        {/* Actions */}
                        <td className="px-4 py-3 text-right text-sm">
                          {tab === "pending" && (
                            <button
                              onClick={() => handleApprove(c.id, c)}
                              disabled={approvingId === c.id || !c.deal.spaSignedDate || !c.deal.oqoodRegisteredDate}
                              className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                            >
                              {approvingId === c.id ? "Approving…" : "Approve"}
                            </button>
                          )}
                          {tab === "approved" && c.status === "APPROVED" && (
                            <button
                              onClick={() => handleMarkPaid(c.id)}
                              className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors"
                            >
                              Mark Paid
                            </button>
                          )}
                          {tab === "paid" && (
                            <span className="text-emerald-700 text-xs font-medium">✓ Completed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
