import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";

interface Milestone {
  id?: string;
  label: string;
  percentage: string;
  triggerType: string;
  isDLDFee: boolean;
  isAdminFee: boolean;
  daysFromReservation: string;
  fixedDate: string;
  sortOrder: number;
}

interface Plan {
  id: string;
  name: string;
  description?: string;
  milestones: {
    id: string;
    label: string;
    percentage: number;
    triggerType: string;
    isDLDFee: boolean;
    isAdminFee: boolean;
    daysFromReservation?: number | null;
    fixedDate?: string | null;
    sortOrder: number;
  }[];
}

interface Props {
  plan: Plan | null;
  onClose: () => void;
  onSaved: () => void;
}

const TRIGGER_TYPES = [
  { value: "DAYS_FROM_RESERVATION", label: "Days from Reservation" },
  { value: "FIXED_DATE",            label: "Fixed Calendar Date" },
  { value: "ON_SPA_SIGNING",        label: "On SPA Signing" },
  { value: "ON_OQOOD",              label: "On Oqood Registration" },
  { value: "ON_HANDOVER",           label: "On Handover" },
];

const BLANK_MILESTONE: Milestone = {
  label: "", percentage: "", triggerType: "DAYS_FROM_RESERVATION",
  isDLDFee: false, isAdminFee: false, daysFromReservation: "", fixedDate: "", sortOrder: 0,
};

const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white";
const lbl = "block text-xs font-semibold text-slate-600 mb-1";

export default function PaymentPlanFormModal({ plan, onClose, onSaved }: Props) {
  const isEdit = !!plan;
  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [milestones, setMilestones] = useState<Milestone[]>(() =>
    plan?.milestones?.length
      ? plan.milestones.map((m) => ({
          id: m.id,
          label: m.label,
          percentage: String(m.percentage),
          triggerType: m.triggerType || "DAYS_FROM_RESERVATION",
          isDLDFee: m.isDLDFee,
          isAdminFee: m.isAdminFee,
          daysFromReservation: m.daysFromReservation != null ? String(m.daysFromReservation) : "",
          fixedDate: m.fixedDate ? m.fixedDate.split("T")[0] : "",
          sortOrder: m.sortOrder,
        }))
      : [{ ...BLANK_MILESTONE, sortOrder: 1 }]
  );
  const [previewPrice, setPreviewPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPct = milestones.reduce((s, m) => s + (parseFloat(m.percentage) || 0), 0);
  const previewNum = parseFloat(previewPrice.replace(/,/g, "")) || 0;

  const addMilestone = () => {
    setMilestones((ms) => [...ms, { ...BLANK_MILESTONE, sortOrder: ms.length + 1 }]);
  };

  const removeMilestone = (i: number) => {
    setMilestones((ms) => ms.filter((_, idx) => idx !== i).map((m, idx) => ({ ...m, sortOrder: idx + 1 })));
  };

  const updateMilestone = <K extends keyof Milestone>(i: number, key: K, val: Milestone[K]) => {
    setMilestones((ms) => ms.map((m, idx) => idx === i ? { ...m, [key]: val } : m));
  };

  const moveMilestone = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= milestones.length) return;
    setMilestones((ms) => {
      const next = [...ms];
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((m, idx) => ({ ...m, sortOrder: idx + 1 }));
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Math.abs(totalPct - 100) > 0.01) {
      setError(`Milestone percentages must sum to 100% (currently ${totalPct.toFixed(2)}%)`);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        milestones: milestones.map((m, i) => ({
          label: m.label.trim(),
          percentage: parseFloat(m.percentage),
          triggerType: m.triggerType,
          isDLDFee: m.isDLDFee,
          isAdminFee: m.isAdminFee,
          daysFromReservation: m.triggerType === "DAYS_FROM_RESERVATION" && m.daysFromReservation
            ? parseInt(m.daysFromReservation) : undefined,
          fixedDate: m.triggerType === "FIXED_DATE" && m.fixedDate ? m.fixedDate : undefined,
          sortOrder: i + 1,
        })),
      };
      if (isEdit) {
        await axios.patch(`/api/payment-plans/${plan.id}`, { name: payload.name, description: payload.description });
        toast.success("Payment plan updated");
      } else {
        await axios.post("/api/payment-plans", payload);
        toast.success("Payment plan created");
      }
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save plan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="font-bold text-slate-900 text-lg">{isEdit ? "Edit Payment Plan" : "New Payment Plan"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        <form id="plan-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* Name + Description */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Plan Name *</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 60/40 Post-Handover" className={inp} />
            </div>
            <div>
              <label className={lbl}>Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description…" className={inp} />
            </div>
          </div>

          {/* Preview price input */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Preview at sale price AED</span>
            <input
              type="number" step="1000" min="0" placeholder="e.g. 1500000"
              value={previewPrice}
              onChange={(e) => setPreviewPrice(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-400"
            />
            <span className={`text-xs font-bold px-2 py-1 rounded ${Math.abs(totalPct - 100) < 0.01 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
              Total: {totalPct.toFixed(1)}%
            </span>
          </div>

          {/* Milestones */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Milestones</p>
              {isEdit && (
                <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                  Milestone structure cannot be changed on existing plans. Clone to create a new version.
                </p>
              )}
            </div>

            <div className="space-y-2">
              {milestones.map((m, i) => {
                const estimatedAmt = previewNum > 0 ? (previewNum * (parseFloat(m.percentage) || 0) / 100) : null;
                return (
                  <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2.5 flex items-center gap-3">
                      {/* Reorder */}
                      <div className="flex flex-col gap-0.5">
                        <button type="button" onClick={() => moveMilestone(i, -1)} disabled={i === 0 || isEdit}
                          className="text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-20 leading-none">▲</button>
                        <button type="button" onClick={() => moveMilestone(i, 1)} disabled={i === milestones.length - 1 || isEdit}
                          className="text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-20 leading-none">▼</button>
                      </div>
                      <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                      <input
                        required
                        disabled={isEdit}
                        value={m.label}
                        onChange={(e) => updateMilestone(i, "label", e.target.value)}
                        placeholder="Milestone label…"
                        className="flex-1 text-sm font-medium bg-transparent border-none focus:outline-none text-slate-800 disabled:opacity-60"
                      />
                      {estimatedAmt !== null && (
                        <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                          ≈ AED {estimatedAmt.toLocaleString("en-AE", { maximumFractionDigits: 0 })}
                        </span>
                      )}
                      {!isEdit && (
                        <button type="button" onClick={() => removeMilestone(i)}
                          className="text-red-400 hover:text-red-600 text-sm px-1 transition-colors">×</button>
                      )}
                    </div>
                    <div className="px-4 py-3 grid grid-cols-4 gap-3 items-start">
                      {/* Percentage */}
                      <div>
                        <label className={lbl}>Percentage *</label>
                        <div className="relative">
                          <input
                            required type="number" step="0.01" min="0" max="100"
                            disabled={isEdit}
                            value={m.percentage}
                            onChange={(e) => updateMilestone(i, "percentage", e.target.value)}
                            className={`${inp} pr-6 disabled:opacity-60`}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                        </div>
                      </div>

                      {/* Trigger type */}
                      <div>
                        <label className={lbl}>Due Date Trigger</label>
                        <select
                          disabled={isEdit}
                          value={m.triggerType}
                          onChange={(e) => updateMilestone(i, "triggerType", e.target.value)}
                          className={`${inp} disabled:opacity-60`}
                        >
                          {TRIGGER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>

                      {/* Conditional date input */}
                      <div>
                        {m.triggerType === "DAYS_FROM_RESERVATION" && (
                          <>
                            <label className={lbl}>Days from Reservation</label>
                            <input
                              required type="number" min="0"
                              disabled={isEdit}
                              value={m.daysFromReservation}
                              onChange={(e) => updateMilestone(i, "daysFromReservation", e.target.value)}
                              placeholder="e.g. 30"
                              className={`${inp} disabled:opacity-60`}
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
                              className={`${inp} disabled:opacity-60`}
                            />
                          </>
                        )}
                        {["ON_SPA_SIGNING", "ON_OQOOD", "ON_HANDOVER"].includes(m.triggerType) && (
                          <div className="mt-4 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 leading-relaxed">
                            Due date set automatically when deal reaches this milestone
                          </div>
                        )}
                      </div>

                      {/* Flags */}
                      <div className="flex flex-col justify-start gap-2 pt-5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={isEdit}
                            checked={m.isDLDFee}
                            onChange={(e) => updateMilestone(i, "isDLDFee", e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-300 disabled:opacity-60"
                          />
                          <span className="text-xs text-slate-600">DLD Fee</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={isEdit}
                            checked={m.isAdminFee}
                            onChange={(e) => updateMilestone(i, "isAdminFee", e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-300 disabled:opacity-60"
                          />
                          <span className="text-xs text-slate-600">Admin Fee</span>
                        </label>
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
                className="mt-2 w-full py-2.5 border-2 border-dashed border-slate-200 text-sm text-slate-400 hover:text-blue-600 hover:border-blue-300 rounded-lg transition-colors"
              >
                + Add Milestone
              </button>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm transition-colors">
            Cancel
          </button>
          <button form="plan-form" type="submit" disabled={submitting}
            className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm transition-colors disabled:opacity-50">
            {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
