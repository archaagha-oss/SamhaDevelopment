import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import PaymentPlanFormModal from "./PaymentPlanFormModal";
import ConfirmDialog from "./ConfirmDialog";

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
  DAYS_FROM_RESERVATION: "bg-slate-100 text-slate-600",
  FIXED_DATE:            "bg-amber-100 text-amber-700",
  ON_SPA_SIGNING:        "bg-blue-100 text-blue-700",
  ON_OQOOD:              "bg-purple-100 text-purple-700",
  ON_HANDOVER:           "bg-emerald-100 text-emerald-700",
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
  const [showForm, setShowForm] = useState(false);
  const [editPlan, setEditPlan] = useState<PaymentPlan | null>(null);
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Payment Plans</h1>
            <p className="text-slate-400 text-xs mt-0.5">{plans.filter(p => p.isActive).length} active templates</p>
          </div>
          <button
            onClick={() => { setEditPlan(null); setShowForm(true); }}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
          >
            <span className="text-base leading-none">+</span> New Plan
          </button>
        </div>
        {/* Filters */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search plans…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-52 focus:outline-none focus:border-blue-400 bg-slate-50"
          />
          <div className="flex gap-1">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterActive(f)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize ${filterActive === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >{f}</button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
            <p className="text-3xl">📋</p>
            <p className="text-sm">{plans.length === 0 ? "No payment plans yet" : "No plans match your filter"}</p>
            {plans.length === 0 && (
              <button
                onClick={() => { setEditPlan(null); setShowForm(true); }}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                Create first plan
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl">
            {filtered.map((plan) => {
              const isExpanded = expandedId === plan.id;
              const pct = totalPercent(plan.milestones);
              const deals = plan._count?.deals ?? 0;
              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-xl border transition-all ${isExpanded ? "border-blue-300 shadow-sm" : "border-slate-200 hover:border-slate-300"} ${!plan.isActive ? "opacity-60" : ""}`}
                >
                  {/* Plan header row */}
                  <div
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900">{plan.name}</h3>
                        {!plan.isActive && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">Inactive</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pct === 100 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {pct}%
                        </span>
                      </div>
                      {plan.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{plan.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-sm">
                      <div className="text-center">
                        <p className="text-xs text-slate-400">Milestones</p>
                        <p className="font-bold text-slate-800">{plan.milestones.length}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400">Deals</p>
                        <p className="font-bold text-slate-800">{deals}</p>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditPlan(plan); setShowForm(true); }}
                          className="text-slate-400 hover:text-blue-600 text-sm px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                          title="Edit plan"
                        >
                          ✎
                        </button>
                        <button
                          onClick={(e) => handleClone(plan, e)}
                          disabled={cloning === plan.id}
                          className="text-slate-400 hover:text-slate-700 text-sm px-2 py-1 rounded hover:bg-slate-100 transition-colors disabled:opacity-40"
                          title="Clone plan"
                        >
                          {cloning === plan.id ? "…" : "⊕"}
                        </button>
                        <button
                          onClick={(e) => handleDeactivate(plan, e)}
                          disabled={deactivating === plan.id}
                          className={`text-xs px-2 py-1 rounded transition-colors disabled:opacity-40 ${plan.isActive ? "text-red-400 hover:text-red-600 hover:bg-red-50" : "text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50"}`}
                          title={plan.isActive ? "Deactivate" : "Reactivate"}
                        >
                          {deactivating === plan.id ? "…" : plan.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                      <span className="text-slate-300 text-sm">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Expanded milestones table */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 overflow-x-auto">
                      {plan.milestones.length === 0 ? (
                        <p className="px-5 py-4 text-sm text-slate-400 text-center">No milestones defined</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 text-left">
                              <th className="px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                              <th className="px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Label</th>
                              <th className="px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">%</th>
                              <th className="px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Trigger</th>
                              <th className="px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Due Date</th>
                              <th className="px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Flags</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {plan.milestones.map((m, i) => (
                              <tr key={m.id} className="hover:bg-slate-50/60">
                                <td className="px-5 py-2.5 text-xs text-slate-400">{i + 1}</td>
                                <td className="px-5 py-2.5 font-medium text-slate-800">{m.label}</td>
                                <td className="px-5 py-2.5">
                                  <span className="font-bold text-slate-900">{m.percentage}%</span>
                                </td>
                                <td className="px-5 py-2.5">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TRIGGER_BADGE_COLORS[m.triggerType] ?? "bg-slate-100 text-slate-600"}`}>
                                    {TRIGGER_LABELS[m.triggerType] || m.triggerType}
                                  </span>
                                </td>
                                <td className="px-5 py-2.5 text-xs text-slate-500 font-medium">
                                  {formatMilestoneDue(m)}
                                </td>
                                <td className="px-5 py-2.5">
                                  <div className="flex gap-1.5">
                                    {m.isDLDFee && <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">DLD</span>}
                                    {m.isAdminFee && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">Admin</span>}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50 border-t border-slate-200">
                              <td colSpan={2} className="px-5 py-2.5 text-xs font-semibold text-slate-600">Total</td>
                              <td className="px-5 py-2.5">
                                <span className={`font-bold text-sm ${pct === 100 ? "text-emerald-700" : "text-red-600"}`}>{pct}%</span>
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

      {showForm && (
        <PaymentPlanFormModal
          plan={editPlan}
          onClose={() => { setShowForm(false); setEditPlan(null); }}
          onSaved={() => { setShowForm(false); setEditPlan(null); load(); }}
        />
      )}

      <ConfirmDialog
        open={!!confirmTogglePlan}
        title={confirmTogglePlan?.isActive ? "Deactivate Plan" : "Reactivate Plan"}
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
