import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Modal from "./Modal";
import { PageContainer, PageHeader } from "./layout";
import EmptyState from "./EmptyState";
import { SkeletonTableRows } from "./Skeleton";

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
  ACTIVE:    "bg-success-soft text-success",
  ACCEPTED:  "bg-info-soft text-primary",
  REJECTED:  "bg-destructive-soft text-destructive",
  EXPIRED:   "bg-muted text-muted-foreground",
  WITHDRAWN: "bg-warning-soft text-warning",
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
        crumbs={[{ label: "Home", path: "/" }, { label: "Offers" }]}
        title="Offers"
        subtitle={`${offers.filter((o) => o.status === "ACTIVE").length} active`}
      />

      <PageContainer padding="compact" className="flex-shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search by lead, unit or project…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border border-border rounded-lg px-3 py-1.5 w-60 focus:outline-none focus:border-ring bg-card"
          />
          <div className="flex gap-1">
            {(["ALL", "ACTIVE", "ACCEPTED", "REJECTED", "EXPIRED"] as const).map((s) => (
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
            icon="◉"
            title={search || filter !== "ALL" ? "No offers match your filters" : "No offers yet"}
            description={search || filter !== "ALL" ? "Try clearing your search or switching the status filter." : "Create offers from a lead's profile to get started."}
          />
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left border-b border-border">
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lead</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unit</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Price</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Discount</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expires</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/60">
                    <td className="px-5 py-3">
                      <button
                        onClick={() => navigate(`/leads/${o.lead.id}`)}
                        className="font-medium text-primary hover:underline text-left"
                      >
                        {o.lead.firstName} {o.lead.lastName}
                      </button>
                      <p className="text-xs text-muted-foreground">{o.lead.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-foreground">{o.unit.unitNumber}</p>
                      <p className="text-xs text-muted-foreground">{o.unit.project.name}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-foreground">{fmtAED(o.offeredPrice)}</p>
                      {o.originalPrice !== o.offeredPrice && (
                        <p className="text-xs text-muted-foreground line-through">{fmtAED(o.originalPrice)}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {o.discountAmount > 0 ? (
                        <div>
                          <p className="text-sm font-medium text-warning">{fmtAED(o.discountAmount)}</p>
                          <p className="text-xs text-muted-foreground">{o.discountPct.toFixed(1)}%</p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] ?? "bg-muted text-muted-foreground"}`}>
                        {o.status}
                      </span>
                      {o.rejectedReason && (
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-[140px] truncate" title={o.rejectedReason}>
                          {o.rejectedReason}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
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
                            className="text-xs px-2 py-1 bg-primary text-white rounded hover:bg-primary/90 transition-colors disabled:opacity-40"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => { setConfirmReject(o); setRejectReason(""); }}
                            disabled={updating === o.id}
                            className="text-xs px-2 py-1 bg-muted text-destructive rounded hover:bg-destructive-soft transition-colors disabled:opacity-40"
                          >
                            Reject
                          </button>
                          <a
                            href={`/offers/${o.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded hover:bg-muted transition-colors"
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

      <Modal
        open={!!confirmReject}
        onClose={() => { if (!updating) { setConfirmReject(null); setRejectReason(""); } }}
        title="Reject offer"
        size="sm"
        footer={
          <>
            <button
              onClick={() => { setConfirmReject(null); setRejectReason(""); }}
              disabled={!!updating}
              className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted/50 disabled:opacity-50"
            >
              Keep offer
            </button>
            <button
              onClick={handleReject}
              disabled={!!updating}
              className="px-4 py-2 text-sm font-medium text-white bg-destructive hover:bg-destructive/90 rounded-lg disabled:opacity-50"
            >
              {updating ? "Rejecting…" : "Confirm reject"}
            </button>
          </>
        }
      >
        {confirmReject && (
          <div className="px-6 py-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Reject offer for{" "}
              <strong>{confirmReject.lead.firstName} {confirmReject.lead.lastName}</strong> on{" "}
              <strong>{confirmReject.unit.unitNumber}</strong>?
            </p>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Reason (optional)</label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Price too low"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
