import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { refundsApi } from "../services/phase2ApiService";
import { PageHeader, PageContainer } from "../components/layout";
import { FilterBar } from "../components/data";

interface Refund {
  id: string;
  dealId: string;
  amount: number;
  currency: string;
  reason: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "PROCESSED" | "CANCELLED";
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
  processedAt?: string;
  processedReference?: string;
}

const STATUS_CONFIG: Record<Refund["status"], { label: string; chip: string }> = {
  REQUESTED: { label: "Requested", chip: "bg-warning-soft text-warning" },
  APPROVED:  { label: "Approved",  chip: "bg-info-soft text-primary" },
  PROCESSED: { label: "Processed", chip: "bg-success-soft text-success" },
  REJECTED:  { label: "Rejected",  chip: "bg-destructive-soft text-destructive" },
  CANCELLED: { label: "Cancelled", chip: "bg-muted text-muted-foreground" },
};

const STATUS_OPTIONS = [
  { value: "",          label: "All statuses" },
  { value: "REQUESTED", label: "Requested" },
  { value: "APPROVED",  label: "Approved" },
  { value: "PROCESSED", label: "Processed" },
  { value: "REJECTED",  label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [status,  setStatus]  = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await refundsApi.listOpen();
      setRefunds(data);
    } catch (e: any) {
      // Phase 4 backend may not be mounted yet — render as empty list rather
      // than a misleading "Route not found" toast.
      if (e.response?.status === 404) {
        setRefunds([]);
      } else {
        toast.error(e.response?.data?.error ?? e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const action = async (
    id: string,
    newStatus: "APPROVED" | "REJECTED" | "PROCESSED" | "CANCELLED",
  ) => {
    try {
      const extras: Record<string, string> = {};
      if (newStatus === "REJECTED") {
        // TODO(Phase C): replace prompt() with an inline form / detail page.
        const reason = window.prompt("Rejection reason:");
        if (!reason) return;
        extras.rejectedReason = reason;
      }
      if (newStatus === "PROCESSED") {
        const ref = window.prompt("Bank / payment reference:");
        if (!ref) return;
        extras.processedReference = ref;
      }
      await refundsApi.transition(id, { newStatus, ...extras });
      toast.success(`Refund ${newStatus.toLowerCase()}`);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? e.message);
    }
  };

  const filtered = useMemo(() => {
    return refunds.filter((r) => {
      if (status && r.status !== status) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.dealId.toLowerCase().includes(q) &&
          !r.reason.toLowerCase().includes(q) &&
          !r.requestedBy.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [refunds, search, status]);

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Refunds" }]}
        title="Refunds"
        subtitle={`${refunds.length} refunds total`}
      />
      <div className="flex-1 overflow-auto">
        <PageContainer>
          <div className="space-y-5">
            <FilterBar
              search={{
                value: search,
                onChange: setSearch,
                placeholder: "Search deal, reason, requester…",
                ariaLabel: "Search refunds",
              }}
              filters={[
                { key: "status", label: "Status", value: status, onChange: setStatus, options: STATUS_OPTIONS },
              ]}
            />

            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-40" role="status" aria-busy="true" aria-label="Loading">
                  <div className="w-7 h-7 border-2 border-primary/40 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  {refunds.length === 0 ? "No open refund requests." : "No refunds match your filters."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        {["Deal", "Amount", "Reason", "Requested by", "When", "Status", ""].map((h, i) => (
                          <th
                            key={i}
                            className="text-left px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.map((r) => {
                        const cfg = STATUS_CONFIG[r.status];
                        return (
                          <tr key={r.id} className="hover:bg-muted/60 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {r.dealId.slice(0, 10)}…
                            </td>
                            <td className="px-4 py-3 text-foreground tabular-nums">
                              {r.currency} {r.amount.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-foreground max-w-xs truncate" title={r.reason}>
                              {r.reason}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{r.requestedBy}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {new Date(r.requestedAt).toLocaleDateString("en-AE", {
                                day: "2-digit", month: "short", year: "numeric",
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.chip}`}>
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 justify-end">
                                {r.status === "REQUESTED" && (
                                  <>
                                    <button
                                      className="text-xs text-primary hover:underline"
                                      onClick={() => action(r.id, "APPROVED")}
                                    >
                                      Approve
                                    </button>
                                    <button
                                      className="text-xs text-destructive hover:underline"
                                      onClick={() => action(r.id, "REJECTED")}
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                {r.status === "APPROVED" && (
                                  <button
                                    className="text-xs text-success hover:underline"
                                    onClick={() => action(r.id, "PROCESSED")}
                                  >
                                    Mark processed
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </PageContainer>
      </div>
    </div>
  );
}
