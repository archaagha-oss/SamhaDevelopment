import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import Modal from "./Modal";
import EmptyState from "./EmptyState";
import { PageContainer, PageHeader } from "./layout";
import { SkeletonTableRows } from "./Skeleton";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Unit {
  unitNumber: string;
  status: string;
  price: number;
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
  ACTIVE:    "bg-success-soft text-success",
  EXPIRED:   "bg-destructive-soft text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
  CONVERTED: "bg-info-soft text-primary",
};

function expiryCountdown(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { label: "Expired", color: "text-destructive font-semibold" };
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return { label: `${d}d ${h % 24}h left`, color: d < 2 ? "text-warning font-semibold" : "text-success" };
  return { label: `${h}h left`, color: "text-destructive font-semibold" };
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
      .catch((err) => toast.error(err?.response?.data?.error || "Failed to load reservations"))
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
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Reservations" }]}
        title="Reservations"
        subtitle={`${reservations.filter((r) => r.status === "ACTIVE").length} active`}
      />

      <PageContainer padding="compact" className="flex-shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search by lead or unit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-1.5 w-52 focus:outline-none focus:border-ring bg-card"
          />
          <div className="flex gap-1">
            {(["ALL", "ACTIVE", "EXPIRED", "CANCELLED", "CONVERTED"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                  filter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted"
                }`}
              >{s.toLowerCase()}</button>
            ))}
          </div>
        </div>
      </PageContainer>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                <SkeletonTableRows rows={5} cols={7} />
              </tbody>
            </table>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="◫"
            title={search ? "No reservations match your search" : `No ${filter === "ALL" ? "" : filter.toLowerCase() + " "}reservations`}
            description={search ? "Try clearing your search or switching the status filter." : "Reservations created from leads will appear here."}
          />
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left border-b border-border">
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lead</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unit</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expires</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Created</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => {
                  const countdown = r.status === "ACTIVE" ? expiryCountdown(r.expiresAt) : null;
                  return (
                    <tr key={r.id} className="hover:bg-muted/60">
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground">{r.lead.firstName} {r.lead.lastName}</p>
                        <p className="text-xs text-muted-foreground">{r.lead.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-foreground">{r.unit.unitNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          AED {r.unit.price?.toLocaleString("en-AE") ?? "—"}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] ?? "bg-muted text-muted-foreground"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {countdown ? (
                          <span className={`text-xs ${countdown.color}`}>{countdown.label}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {new Date(r.expiresAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3 max-w-[180px]">
                        {r.cancelReason ? (
                          <p className="text-xs text-muted-foreground truncate" title={r.cancelReason}>{r.cancelReason}</p>
                        ) : r.notes ? (
                          <p className="text-xs text-muted-foreground truncate" title={r.notes}>{r.notes}</p>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        {r.status === "ACTIVE" && (
                          <button
                            onClick={() => { setConfirmCancel(r); setCancelReason(""); }}
                            className="text-xs text-destructive hover:text-destructive hover:bg-destructive-soft px-2 py-1 rounded transition-colors"
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

      <Modal
        open={!!confirmCancel}
        onClose={() => { if (!cancelling) { setConfirmCancel(null); setCancelReason(""); } }}
        title="Cancel reservation"
        size="sm"
        footer={
          <>
            <button
              onClick={() => { setConfirmCancel(null); setCancelReason(""); }}
              disabled={!!cancelling}
              className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted/50 disabled:opacity-50"
            >
              Keep reservation
            </button>
            <button
              onClick={handleCancel}
              disabled={!!cancelling}
              className="px-4 py-2 text-sm font-medium text-white bg-destructive hover:bg-destructive/90 rounded-lg disabled:opacity-50"
            >
              {cancelling ? "Cancelling…" : "Confirm cancel"}
            </button>
          </>
        }
      >
        {confirmCancel && (
          <div className="px-6 py-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Cancel reservation for{" "}
              <strong>{confirmCancel.lead.firstName} {confirmCancel.lead.lastName}</strong> on unit{" "}
              <strong>{confirmCancel.unit.unitNumber}</strong>?
            </p>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Reason (optional)</label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Client changed mind"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
