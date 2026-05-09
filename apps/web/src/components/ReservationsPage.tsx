import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { PageHeader } from "./ui/PageHeader";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Unit {
  unitNumber: string;
  status: string;
  askingPrice: number;
}

interface Reservation {
  id: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED" | "CONVERTED";
  expiresAt: string;
  createdAt: string;
  notes?: string;
  cancelReason?: string;
  lead: Lead;
  unit: Unit;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    "bg-emerald-100 text-emerald-700",
  EXPIRED:   "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-500",
  CONVERTED: "bg-blue-100 text-blue-700",
};

function expiryCountdown(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { label: "Expired", color: "text-red-600 font-semibold" };
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return { label: `${d}d ${h % 24}h left`, color: d < 2 ? "text-amber-600 font-semibold" : "text-emerald-600" };
  return { label: `${h}h left`, color: "text-red-600 font-semibold" };
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "EXPIRED" | "CANCELLED" | "CONVERTED">("ACTIVE");
  const [search, setSearch] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [confirmCancel, setConfirmCancel] = useState<Reservation | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (filter !== "ALL") params.status = filter;
    axios.get("/api/reservations", { params })
      .then((r) => setReservations(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async () => {
    if (!confirmCancel) return;
    setCancelling(confirmCancel.id);
    try {
      await axios.patch(`/api/reservations/${confirmCancel.id}/cancel`, { reason: cancelReason || undefined });
      toast.success("Reservation cancelled");
      setConfirmCancel(null);
      setCancelReason("");
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to cancel reservation");
    } finally {
      setCancelling(null);
    }
  };

  const filtered = reservations.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${r.lead.firstName} ${r.lead.lastName}`.toLowerCase().includes(q) ||
      r.unit.unitNumber.toLowerCase().includes(q) ||
      r.lead.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Reservations"
        description={`${reservations.filter((r) => r.status === "ACTIVE").length} active`}
      />
      <div className="px-6 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search by lead or unit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-52 focus:outline-none focus:border-blue-400 bg-slate-50"
          />
          <div className="flex gap-1">
            {(["ALL", "ACTIVE", "EXPIRED", "CANCELLED", "CONVERTED"] as const).map((s) => (
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
            <p className="text-3xl">📋</p>
            <p className="text-sm">No reservations found</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left border-b border-slate-200">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Lead</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Expires</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const countdown = r.status === "ACTIVE" ? expiryCountdown(r.expiresAt) : null;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">{r.lead.firstName} {r.lead.lastName}</p>
                        <p className="text-xs text-slate-400">{r.lead.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900">{r.unit.unitNumber}</p>
                        <p className="text-xs text-slate-400">
                          AED {r.unit.askingPrice?.toLocaleString("en-AE") ?? "—"}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {countdown ? (
                          <span className={`text-xs ${countdown.color}`}>{countdown.label}</span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {new Date(r.expiresAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {new Date(r.createdAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3 max-w-[180px]">
                        {r.cancelReason ? (
                          <p className="text-xs text-slate-400 truncate" title={r.cancelReason}>{r.cancelReason}</p>
                        ) : r.notes ? (
                          <p className="text-xs text-slate-400 truncate" title={r.notes}>{r.notes}</p>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        {r.status === "ACTIVE" && (
                          <button
                            onClick={() => { setConfirmCancel(r); setCancelReason(""); }}
                            className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancel confirmation modal */}
      {confirmCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h2 className="font-bold text-slate-900 text-base mb-1">Cancel Reservation</h2>
            <p className="text-sm text-slate-500 mb-4">
              Cancel reservation for <strong>{confirmCancel.lead.firstName} {confirmCancel.lead.lastName}</strong> on unit{" "}
              <strong>{confirmCancel.unit.unitNumber}</strong>?
            </p>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Reason (optional)</label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Client changed mind"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmCancel(null)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm"
              >
                Back
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling === confirmCancel.id}
                className="flex-1 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
              >
                {cancelling === confirmCancel.id ? "Cancelling…" : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
