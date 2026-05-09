import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  DetailPageLayout, DetailPageLoading, DetailPageNotFound,
} from "../components/layout";

// PaymentPlanEditPage — handles /payment-plans/new (create) and
// /payment-plans/:planId/edit (edit). Replaces PaymentPlanFormModal.
//
// Note: per the existing API + business rule, milestone STRUCTURE is immutable
// after a plan is created (only name/description editable). Cloning to a new
// plan is the supported way to create a variant. The edit path only PATCHes
// name/description; milestone fields are rendered read-only-ish (disabled).

interface MilestoneInput {
  id?: string;
  label: string;
  percentage: string;
  triggerType: string;
  isDLDFee: boolean;
  isAdminFee: boolean;
  daysFromReservation: string;
  fixedDate: string;
  sortOrder: number;
  targetAccount: "ESCROW" | "CORPORATE";
}

interface Plan {
  id: string;
  name: string;
  description?: string;
  milestones: Array<{
    id: string;
    label: string;
    percentage: number;
    triggerType: string;
    isDLDFee: boolean;
    isAdminFee: boolean;
    daysFromReservation?: number | null;
    fixedDate?: string | null;
    sortOrder: number;
    targetAccount?: "ESCROW" | "CORPORATE";
  }>;
}

const TRIGGER_TYPES = [
  { value: "DAYS_FROM_RESERVATION", label: "Days from Reservation" },
  { value: "FIXED_DATE",            label: "Fixed Calendar Date" },
  { value: "ON_SPA_SIGNING",        label: "On SPA Signing" },
  { value: "ON_OQOOD",              label: "On Oqood Registration" },
  { value: "ON_HANDOVER",           label: "On Handover" },
];

const BLANK_MILESTONE: MilestoneInput = {
  label: "", percentage: "", triggerType: "DAYS_FROM_RESERVATION",
  isDLDFee: false, isAdminFee: false, daysFromReservation: "", fixedDate: "", sortOrder: 0,
  targetAccount: "ESCROW",
};

const inp = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/50 focus:outline-none focus:border-ring focus:bg-card disabled:opacity-60";
const lbl = "block text-xs font-semibold text-muted-foreground mb-1";

const plansCrumbs = [
  { label: "Home", path: "/" },
  { label: "Payment plans", path: "/payment-plans" },
];

export default function PaymentPlanEditPage() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const isEdit = !!planId;

  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [milestones,  setMilestones]  = useState<MilestoneInput[]>(
    () => isEdit ? [] : [{ ...BLANK_MILESTONE, sortOrder: 1 }],
  );
  const [previewPrice, setPreviewPrice] = useState("");

  const [loading,    setLoading]    = useState(isEdit);
  const [loadError,  setLoadError]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || !planId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(`/api/payment-plans/${planId}`);
        if (cancelled) return;
        const p = r.data as Plan;
        setName(p.name ?? "");
        setDescription(p.description ?? "");
        setMilestones(
          (p.milestones ?? []).map((m) => ({
            id: m.id,
            label: m.label,
            percentage: String(m.percentage),
            triggerType: m.triggerType || "DAYS_FROM_RESERVATION",
            isDLDFee: m.isDLDFee,
            isAdminFee: m.isAdminFee,
            daysFromReservation: m.daysFromReservation != null ? String(m.daysFromReservation) : "",
            fixedDate: m.fixedDate ? m.fixedDate.split("T")[0] : "",
            sortOrder: m.sortOrder,
            targetAccount: m.targetAccount ?? "ESCROW",
          })),
        );
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, planId]);

  const totalPct = milestones.reduce((s, m) => s + (parseFloat(m.percentage) || 0), 0);
  const previewNum = parseFloat(previewPrice.replace(/,/g, "")) || 0;

  const addMilestone = () =>
    setMilestones((ms) => [...ms, { ...BLANK_MILESTONE, sortOrder: ms.length + 1 }]);

  const removeMilestone = (i: number) =>
    setMilestones((ms) =>
      ms.filter((_, idx) => idx !== i).map((m, idx) => ({ ...m, sortOrder: idx + 1 })),
    );

  const updateMilestone = <K extends keyof MilestoneInput>(i: number, key: K, val: MilestoneInput[K]) =>
    setMilestones((ms) => ms.map((m, idx) => (idx === i ? { ...m, [key]: val } : m)));

  const moveMilestone = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= milestones.length) return;
    setMilestones((ms) => {
      const next = [...ms];
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((m, idx) => ({ ...m, sortOrder: idx + 1 }));
    });
  };

  const cancelTo = "/payment-plans";

  async function submit() {
    if (!isEdit && Math.abs(totalPct - 100) > 0.01) {
      setError(`Milestone percentages must sum to 100% (currently ${totalPct.toFixed(2)}%)`);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit && planId) {
        await axios.patch(`/api/payment-plans/${planId}`, {
          name: name.trim(),
          description: description.trim() || undefined,
        });
        toast.success("Payment plan updated");
        navigate("/payment-plans");
      } else {
        const payload = {
          name: name.trim(),
          description: description.trim() || undefined,
          milestones: milestones.map((m, i) => ({
            label: m.label.trim(),
            percentage: parseFloat(m.percentage),
            triggerType: m.triggerType,
            isDLDFee: m.isDLDFee,
            isAdminFee: m.isAdminFee,
            daysFromReservation:
              m.triggerType === "DAYS_FROM_RESERVATION" && m.daysFromReservation
                ? parseInt(m.daysFromReservation, 10) : undefined,
            fixedDate: m.triggerType === "FIXED_DATE" && m.fixedDate ? m.fixedDate : undefined,
            sortOrder: i + 1,
            targetAccount: m.targetAccount,
          })),
        };
        await axios.post("/api/payment-plans", payload);
        toast.success("Payment plan created");
        navigate("/payment-plans");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save plan");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <DetailPageLoading crumbs={plansCrumbs} title="Loading payment plan…" />;
  if (isEdit && loadError) {
    return (
      <DetailPageNotFound
        crumbs={plansCrumbs}
        title="Payment plan not found"
        message="This plan could not be loaded. It may have been deleted."
        backLabel="Back to payment plans"
        onBack={() => navigate("/payment-plans")}
      />
    );
  }

  const crumbs = isEdit
    ? [...plansCrumbs, { label: name || "Plan" }, { label: "Edit" }]
    : [...plansCrumbs, { label: "New payment plan" }];

  return (
    <DetailPageLayout
      crumbs={crumbs}
      title={isEdit ? `Edit ${name || "payment plan"}` : "Create payment plan"}
      subtitle={
        isEdit
          ? "Plan name and description are editable. Milestone structure is locked — clone to create a variant."
          : "Define a milestone schedule that can be attached to deals."
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => navigate(cancelTo)}
            disabled={submitting}
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
          >
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create payment plan"}
          </button>
        </>
      }
      main={
        <>
          {/* Plan info */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Plan info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Plan Name *</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 60/40 Post-Handover"
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description…"
                  className={inp}
                />
              </div>
            </div>
          </div>

          {/* Live preview */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Preview</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                At sale price AED
              </span>
              <input
                type="number" step={1000} min={0}
                placeholder="e.g. 1500000"
                value={previewPrice}
                onChange={(e) => setPreviewPrice(e.target.value)}
                className="flex-1 min-w-[8rem] border border-border rounded-lg px-3 py-1.5 text-sm bg-card focus:outline-none focus:border-ring"
              />
              <span
                className={`text-xs font-bold px-2 py-1 rounded ${
                  Math.abs(totalPct - 100) < 0.01
                    ? "bg-success-soft text-success"
                    : "bg-destructive-soft text-destructive"
                }`}
              >
                Total: {totalPct.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Milestones */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Milestones</h3>
              {isEdit && (
                <p className="text-xs text-warning bg-warning-soft px-2 py-1 rounded">
                  Milestone structure is locked. Clone to create a new version.
                </p>
              )}
            </div>

            <div className="space-y-2">
              {milestones.map((m, i) => {
                const estimatedAmt = previewNum > 0
                  ? (previewNum * (parseFloat(m.percentage) || 0) / 100)
                  : null;
                return (
                  <div key={i} className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2.5 flex items-center gap-3">
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveMilestone(i, -1)}
                          disabled={i === 0 || isEdit}
                          aria-label="Move up"
                          className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none"
                        >▲</button>
                        <button
                          type="button"
                          onClick={() => moveMilestone(i, 1)}
                          disabled={i === milestones.length - 1 || isEdit}
                          aria-label="Move down"
                          className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none"
                        >▼</button>
                      </div>
                      <span className="text-xs font-bold text-muted-foreground w-4 tabular-nums">{i + 1}</span>
                      <input
                        required
                        disabled={isEdit}
                        value={m.label}
                        onChange={(e) => updateMilestone(i, "label", e.target.value)}
                        placeholder="Milestone label…"
                        className="flex-1 text-sm font-medium bg-transparent border-none focus:outline-none text-foreground disabled:opacity-60"
                      />
                      {estimatedAmt !== null && (
                        <span className="text-xs text-muted-foreground font-medium whitespace-nowrap tabular-nums">
                          ≈ AED {estimatedAmt.toLocaleString("en-AE", { maximumFractionDigits: 0 })}
                        </span>
                      )}
                      {!isEdit && (
                        <button
                          type="button"
                          onClick={() => removeMilestone(i)}
                          aria-label="Remove milestone"
                          className="text-destructive hover:text-destructive text-sm px-1 transition-colors"
                        >×</button>
                      )}
                    </div>
                    <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-4 gap-3 items-start">
                      <div>
                        <label className={lbl}>Percentage *</label>
                        <div className="relative">
                          <input
                            required type="number" step={0.01} min={0} max={100}
                            disabled={isEdit}
                            value={m.percentage}
                            onChange={(e) => updateMilestone(i, "percentage", e.target.value)}
                            className={`${inp} pr-6`}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                        </div>
                      </div>

                      <div>
                        <label className={lbl}>Due Date Trigger</label>
                        <select
                          disabled={isEdit}
                          value={m.triggerType}
                          onChange={(e) => updateMilestone(i, "triggerType", e.target.value)}
                          className={inp}
                        >
                          {TRIGGER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>

                      <div>
                        {m.triggerType === "DAYS_FROM_RESERVATION" && (
                          <>
                            <label className={lbl}>Days from Reservation</label>
                            <input
                              required type="number" min={0}
                              disabled={isEdit}
                              value={m.daysFromReservation}
                              onChange={(e) => updateMilestone(i, "daysFromReservation", e.target.value)}
                              placeholder="e.g. 30"
                              className={inp}
                            />
                          </>
                        )}
                        {m.triggerType === "FIXED_DATE" && (
                          <>
                            <label className={lbl}>Calendar Date *</label>
                            <input
                              required type="date"
                              disabled={isEdit}
                              value={m.fixedDate}
                              onChange={(e) => updateMilestone(i, "fixedDate", e.target.value)}
                              className={inp}
                            />
                          </>
                        )}
                        {["ON_SPA_SIGNING", "ON_OQOOD", "ON_HANDOVER"].includes(m.triggerType) && (
                          <div className="mt-4 text-xs text-primary bg-info-soft border border-primary/40 rounded-lg px-3 py-2 leading-relaxed">
                            Due date set automatically when deal reaches this milestone.
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col justify-start gap-2 pt-5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={isEdit}
                            checked={m.isDLDFee}
                            onChange={(e) => updateMilestone(i, "isDLDFee", e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-border accent-primary"
                          />
                          <span className="text-xs text-muted-foreground">DLD Fee</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={isEdit}
                            checked={m.isAdminFee}
                            onChange={(e) => updateMilestone(i, "isAdminFee", e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-border accent-primary"
                          />
                          <span className="text-xs text-muted-foreground">Admin Fee</span>
                        </label>
                        <div className="pt-1">
                          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                            Account
                          </label>
                          <select
                            disabled={isEdit}
                            value={m.targetAccount}
                            onChange={(e) =>
                              updateMilestone(i, "targetAccount", e.target.value as "ESCROW" | "CORPORATE")
                            }
                            className="text-xs border border-border rounded px-2 py-1 bg-muted/50 disabled:opacity-60"
                          >
                            <option value="ESCROW">Escrow</option>
                            <option value="CORPORATE">Corporate</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!isEdit && (
              <button
                type="button"
                onClick={addMilestone}
                className="mt-2 w-full py-2.5 border-2 border-dashed border-border text-sm text-muted-foreground hover:text-primary hover:border-primary/40 rounded-lg transition-colors"
              >
                + Add milestone
              </button>
            )}
          </div>

          {error && (
            <div className="bg-destructive-soft border border-destructive/30 rounded-lg px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
        </>
      }
    />
  );
}
