import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import ConfirmDialog from "./ConfirmDialog";
import { PageContainer, PageHeader } from "./layout";
import { FilterBar } from "./data";
import { Button } from "@/components/ui/button";
import EmptyState from "./EmptyState";
import { Skeleton } from "./Skeleton";

interface Milestone {
  id: string;
  label: string;
  percentage: number;
  triggerType: string;
  isDLDFee: boolean;
  isAdminFee: boolean;
  daysFromReservation?: number | null;
  fixedDate?: string | null;
  sortOrder: number;
}

interface PaymentPlan {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  milestones: Milestone[];
  _count?: { deals: number };
}

const TRIGGER_LABELS: Record<string, string> = {
  DAYS_FROM_RESERVATION: "Days from Reservation",
  FIXED_DATE:            "Fixed Date",
  ON_SPA_SIGNING:        "On SPA Signing",
  ON_OQOOD:              "On Oqood",
  ON_HANDOVER:           "On Handover",
};

const TRIGGER_BADGE_COLORS: Record<string, string> = {
  DAYS_FROM_RESERVATION: "bg-muted text-muted-foreground",
  FIXED_DATE:            "bg-warning-soft text-warning",
  ON_SPA_SIGNING:        "bg-info-soft text-primary",
  ON_OQOOD:              "bg-chart-7/15 text-chart-7",
  ON_HANDOVER:           "bg-success-soft text-success",
};

function formatMilestoneDue(m: Milestone): string {
  if (m.triggerType === "FIXED_DATE" && m.fixedDate) {
    return new Date(m.fixedDate).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
  }
  if (m.triggerType === "DAYS_FROM_RESERVATION") {
    return m.daysFromReservation != null ? `+${m.daysFromReservation} days` : "—";
  }
  return "—";
}

export default function PaymentPlansPage() {
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Form modal state removed in Phase C.5 — both flows are routes now
  // (/payment-plans/new and /payment-plans/:planId/edit).
  const navigate = useNavigate();
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);
  const [confirmTogglePlan, setConfirmTogglePlan] = useState<PaymentPlan | null>(null);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");

  const load = () => {
    setLoading(true);
    axios.get("/api/payment-plans", { params: { includeInactive: true } })
      .then((r) => setPlans(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDeactivate = (plan: PaymentPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmTogglePlan(plan);
  };

  const doTogglePlan = async () => {
    const plan = confirmTogglePlan;
    if (!plan) return;
    setConfirmTogglePlan(null);
    setDeactivating(plan.id);
    try {
      if (plan.isActive) {
        await axios.delete(`/api/payment-plans/${plan.id}`);
        toast.success(`"${plan.name}" deactivated`);
      } else {
        await axios.patch(`/api/payment-plans/${plan.id}`, { isActive: true });
        toast.success(`"${plan.name}" reactivated`);
      }
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update plan");
    } finally {
      setDeactivating(null);
    }
  };

  const handleClone = async (plan: PaymentPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    if (cloning) return;
    setCloning(plan.id);
    try {
      const milestones = plan.milestones.map(({ label, percentage, triggerType, isDLDFee, isAdminFee, daysFromReservation, fixedDate, sortOrder }) => ({
        label, percentage, triggerType, isDLDFee, isAdminFee, daysFromReservation, fixedDate, sortOrder,
      }));
      await axios.post("/api/payment-plans", {
        name: `${plan.name} (Copy)`,
        description: plan.description,
        milestones,
      });
      toast.success(`"${plan.name}" cloned`);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to clone plan");
    } finally {
      setCloning(null);
    }
  };

  const filtered = plans.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchActive =
      filterActive === "all" ? true :
      filterActive === "active" ? p.isActive :
      !p.isActive;
    return matchSearch && matchActive;
  });

  const totalPercent = (milestones: Milestone[]) =>
    milestones.reduce((s, m) => s + m.percentage, 0);

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        crumbs={[{ label: "Home", path: "/" }, { label: "Payment plans" }]}
        title="Payment plans"
        subtitle={`${plans.filter(p => p.isActive).length} active template${plans.filter(p => p.isActive).length === 1 ? "" : "s"}`}
        actions={<Button onClick={() => navigate("/payment-plans/new")}>Create payment plan</Button>}
      />

      <div className="flex-1 overflow-auto">
        <PageContainer>
          <div className="space-y-5">
            <FilterBar
              search={{
                value: search,
                onChange: setSearch,
                placeholder: "Search plans…",
                ariaLabel: "Search payment plans",
              }}
              filters={[
                {
                  key: "active",
                  label: "Status",
                  value: filterActive,
                  onChange: (v) => setFilterActive(v as "all" | "active" | "inactive"),
                  options: [
                    { value: "all",      label: "All statuses" },
                    { value: "active",   label: "Active" },
                    { value: "inactive", label: "Inactive" },
                  ],
                },
              ]}
            />

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-card rounded-xl border border-border p-5 space-y-3">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon="◫"
                title={plans.length === 0 ? "No payment plans yet" : "No plans match your filter"}
                description={plans.length === 0 ? "Define milestone schedules to attach to deals." : "Try adjusting your filters."}
                action={plans.length === 0 ? { label: "Create payment plan", onClick: () => navigate("/payment-plans/new") } : undefined}
              />
            ) : (
              <div className="space-y-3">
            {filtered.map((plan) => {
              const isExpanded = expandedId === plan.id;
              const pct = totalPercent(plan.milestones);
              const deals = plan._count?.deals ?? 0;
              return (
                <div
                  key={plan.id}
                  className={`bg-card rounded-xl border transition-all ${isExpanded ? "border-primary/40 shadow-sm" : "border-border hover:border-border"} ${!plan.isActive ? "opacity-60" : ""}`}
                >
                  {/* Plan header row */}
                  <div
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-foreground">{plan.name}</h3>
                        {!plan.isActive && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Inactive</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pct === 100 ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"}`}>
                          {pct}%
                        </span>
                      </div>
                      {plan.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-sm">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Milestones</p>
                        <p className="font-bold text-foreground">{plan.milestones.length}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Deals</p>
                        <p className="font-bold text-foreground">{deals}</p>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/payment-plans/${plan.id}/edit`); }}
                          className="text-muted-foreground hover:text-primary text-sm px-2 py-1 rounded hover:bg-info-soft transition-colors"
                          title="Edit plan"
                        >
                          ✎
                        </button>
                        <button
                          onClick={(e) => handleClone(plan, e)}
                          disabled={cloning === plan.id}
                          className="text-muted-foreground hover:text-foreground text-sm px-2 py-1 rounded hover:bg-muted transition-colors disabled:opacity-40"
                          title="Clone plan"
                        >
                          {cloning === plan.id ? "…" : "⊕"}
                        </button>
                        <button
                          onClick={(e) => handleDeactivate(plan, e)}
                          disabled={deactivating === plan.id}
                          className={`text-xs px-2 py-1 rounded transition-colors disabled:opacity-40 ${plan.isActive ? "text-destructive hover:text-destructive hover:bg-destructive-soft" : "text-success hover:text-success hover:bg-success-soft"}`}
                          title={plan.isActive ? "Deactivate" : "Reactivate"}
                        >
                          {deactivating === plan.id ? "…" : plan.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                      <span className="text-foreground/80 text-sm">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Expanded milestones table */}
                  {isExpanded && (
                    <div className="border-t border-border overflow-x-auto">
                      {plan.milestones.length === 0 ? (
                        <p className="px-5 py-4 text-sm text-muted-foreground text-center">No milestones defined</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50 text-left">
                              <th className="px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">#</th>
                              <th className="px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Label</th>
                              <th className="px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">%</th>
                              <th className="px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trigger</th>
                              <th className="px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Due Date</th>
                              <th className="px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Flags</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {plan.milestones.map((m, i) => (
                              <tr key={m.id} className="hover:bg-muted/60">
                                <td className="px-5 py-2.5 text-xs text-muted-foreground">{i + 1}</td>
                                <td className="px-5 py-2.5 font-medium text-foreground">{m.label}</td>
                                <td className="px-5 py-2.5">
                                  <span className="font-bold text-foreground">{m.percentage}%</span>
                                </td>
                                <td className="px-5 py-2.5">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TRIGGER_BADGE_COLORS[m.triggerType] ?? "bg-muted text-muted-foreground"}`}>
                                    {TRIGGER_LABELS[m.triggerType] || m.triggerType}
                                  </span>
                                </td>
                                <td className="px-5 py-2.5 text-xs text-muted-foreground font-medium">
                                  {formatMilestoneDue(m)}
                                </td>
                                <td className="px-5 py-2.5">
                                  <div className="flex gap-1.5">
                                    {m.isDLDFee && <span className="text-xs px-1.5 py-0.5 rounded bg-warning-soft text-warning font-medium">DLD</span>}
                                    {m.isAdminFee && <span className="text-xs px-1.5 py-0.5 rounded bg-info-soft text-primary font-medium">Admin</span>}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-muted/50 border-t border-border">
                              <td colSpan={2} className="px-5 py-2.5 text-xs font-semibold text-muted-foreground">Total</td>
                              <td className="px-5 py-2.5">
                                <span className={`font-bold text-sm ${pct === 100 ? "text-success" : "text-destructive"}`}>{pct}%</span>
                              </td>
                              <td colSpan={3} />
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
              </div>
            )}
          </div>
        </PageContainer>
      </div>

      <ConfirmDialog
        open={!!confirmTogglePlan}
        title={confirmTogglePlan?.isActive ? "Deactivate plan" : "Reactivate plan"}
        message={confirmTogglePlan?.isActive
          ? `Deactivate "${confirmTogglePlan?.name}"? It will no longer appear in new deal forms.`
          : `Reactivate "${confirmTogglePlan?.name}"?`}
        confirmLabel={confirmTogglePlan?.isActive ? "Deactivate" : "Reactivate"}
        variant={confirmTogglePlan?.isActive ? "danger" : "info"}
        onConfirm={doTogglePlan}
        onCancel={() => setConfirmTogglePlan(null)}
      />
    </div>
  );
}
