import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "./ui/PageHeader";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface Project {
  id: string;
  name: string;
  location?: string;
}

interface Unit {
  unitNumber: string;
  status: string;
  project: Project;
}

interface Offer {
  id: string;
  status: "ACTIVE" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "WITHDRAWN";
  offeredPrice: number;
  originalPrice: number;
  discountAmount: number;
  discountPct: number;
  expiresAt?: string;
  createdAt: string;
  rejectedReason?: string;
  lead: Lead;
  unit: Unit;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "bg-emerald-100 text-emerald-700",
  ACCEPTED:  "bg-blue-100 text-blue-700",
  REJECTED:  "bg-red-100 text-red-700",
  EXPIRED:   "bg-slate-100 text-slate-500",
  WITHDRAWN: "bg-amber-100 text-amber-700",
};

function fmtAED(n: number) {
  return `AED ${n.toLocaleString("en-AE", { maximumFractionDigits: 0 })}`;
}

export default function OffersPage() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "ACCEPTED" | "REJECTED" | "EXPIRED">("ALL");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState<Offer | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    axios.get("/api/offers")
      .then((r) => setOffers(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string, extra?: object) => {
    setUpdating(id);
    try {
      await axios.patch(`/api/offers/${id}/status`, { status, ...extra });
      const labels: Record<string, string> = { ACCEPTED: "Offer accepted", REJECTED: "Offer rejected", WITHDRAWN: "Offer withdrawn" };
      toast.success(labels[status] ?? "Offer updated");
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update offer");
    } finally {
      setUpdating(null);
    }
  };

  const handleReject = async () => {
    if (!confirmReject) return;
    await updateStatus(confirmReject.id, "REJECTED", { rejectedReason: rejectReason || undefined });
    setConfirmReject(null);
    setRejectReason("");
  };

  const filtered = offers.filter((o) => {
    const matchStatus = filter === "ALL" || o.status === filter;
    const matchSearch = !search || (
      `${o.lead.firstName} ${o.lead.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      o.unit.unitNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.unit.project.name.toLowerCase().includes(search.toLowerCase())
    );
    return matchStatus && matchSearch;
  });

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Offers"
        description={`${offers.filter((o) => o.status === "ACTIVE").length} active`}
      />
      <div className="px-6 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search by lead, unit or project…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-60 focus:outline-none focus:border-blue-400 bg-slate-50"
          />
          <div className="flex gap-1">
            {(["ALL", "ACTIVE", "ACCEPTED", "REJECTED", "EXPIRED"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                  filter === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >{s.toLowerCase()}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
            <p className="text-3xl">📄</p>
            <p className="text-sm">No offers found</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left border-b border-slate-200">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Lead</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Price</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Discount</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Expires</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <button
                        onClick={() => navigate(`/leads/${o.lead.id}`)}
                        className="font-medium text-blue-600 hover:underline text-left"
                      >
                        {o.lead.firstName} {o.lead.lastName}
                      </button>
                      <p className="text-xs text-slate-400">{o.lead.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-900">{o.unit.unitNumber}</p>
                      <p className="text-xs text-slate-400">{o.unit.project.name}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-900">{fmtAED(o.offeredPrice)}</p>
                      {o.originalPrice !== o.offeredPrice && (
                        <p className="text-xs text-slate-400 line-through">{fmtAED(o.originalPrice)}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {o.discountAmount > 0 ? (
                        <div>
                          <p className="text-sm font-medium text-amber-600">{fmtAED(o.discountAmount)}</p>
                          <p className="text-xs text-slate-400">{o.discountPct.toFixed(1)}%</p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {o.status}
                      </span>
                      {o.rejectedReason && (
                        <p className="text-xs text-slate-400 mt-0.5 max-w-[140px] truncate" title={o.rejectedReason}>
                          {o.rejectedReason}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {o.expiresAt
                        ? new Date(o.expiresAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {o.status === "ACTIVE" && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateStatus(o.id, "ACCEPTED")}
                            disabled={updating === o.id}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-40"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => { setConfirmReject(o); setRejectReason(""); }}
                            disabled={updating === o.id}
                            className="text-xs px-2 py-1 bg-slate-100 text-red-600 rounded hover:bg-red-50 transition-colors disabled:opacity-40"
                          >
                            Reject
                          </button>
                          <a
                            href={`/offers/${o.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors"
                          >
                            Print
                          </a>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {confirmReject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h2 className="font-bold text-slate-900 text-base mb-1">Reject Offer</h2>
            <p className="text-sm text-slate-500 mb-4">
              Reject offer for <strong>{confirmReject.lead.firstName} {confirmReject.lead.lastName}</strong> on{" "}
              <strong>{confirmReject.unit.unitNumber}</strong>?
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Reason (optional)</label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Price too low"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmReject(null)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm"
              >
                Back
              </button>
              <button
                onClick={handleReject}
                disabled={updating === confirmReject.id}
                className="flex-1 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
              >
                {updating === confirmReject.id ? "Rejecting…" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
