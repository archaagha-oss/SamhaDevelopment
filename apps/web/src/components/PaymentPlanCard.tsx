import { useState } from "react";
import { useUpdateUnit } from "../hooks/useUpdateUnit";
import { formatAED } from "../lib/format";

interface Props {
  unitId: string;
  paymentPlan?: string;
  price: number;
}

interface Tranche {
  label: string;
  pct: number;
  amount: number;
}

const TRANCHE_LABELS_BY_COUNT: Record<number, string[]> = {
  2: ["Down payment", "On handover"],
  3: ["Down payment", "During construction", "On handover"],
  4: ["Booking", "Down payment", "During construction", "On handover"],
};

function parsePlan(plan: string): number[] | null {
  const parts = plan.split(/[\/\-x×]/i).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const nums = parts.map((s) => Number(s.replace(/[^\d.]/g, "")));
  if (nums.some((n) => !Number.isFinite(n) || n <= 0)) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.5) return null;
  return nums;
}

function decompose(plan: string, price: number): Tranche[] | null {
  const pcts = parsePlan(plan);
  if (!pcts) return null;
  const labels = TRANCHE_LABELS_BY_COUNT[pcts.length] ?? pcts.map((_, i) => `Tranche ${i + 1}`);
  return pcts.map((pct, i) => ({
    label: labels[i],
    pct,
    amount: Math.round((pct / 100) * price),
  }));
}

const COMMON_PLANS = ["60/40", "50/50", "40/60", "30/40/30", "20/30/50", "10/20/30/40"];

export default function PaymentPlanCard({ unitId, paymentPlan, price }: Props) {
  const updateUnit = useUpdateUnit(unitId);
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(paymentPlan ?? "");
  const [error, setError]       = useState<string | null>(null);

  const tranches = paymentPlan ? decompose(paymentPlan, price) : null;

  async function save(value: string) {
    if (!parsePlan(value)) {
      setError("Plan must be percentages summing to 100 (e.g. 60/40 or 30/40/30)");
      return;
    }
    setError(null);
    try {
      await updateUnit.mutateAsync({ paymentPlan: value });
      setEditing(false);
    } catch {
      setError("Could not save payment plan");
    }
  }

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment plan</p>
        {!editing && (
          <button
            type="button"
            onClick={() => { setDraft(paymentPlan ?? ""); setEditing(true); setError(null); }}
            className="text-xs text-primary hover:text-primary font-medium"
          >
            {paymentPlan ? "Edit" : "+ Set plan"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. 60/40 or 30/40/30"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-ring"
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5">
            {COMMON_PLANS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDraft(p)}
                className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
              >
                {p}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => save(draft.trim())}
              disabled={updateUnit.isPending || !draft.trim()}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(null); }}
              className="px-3 py-2 border border-border text-sm rounded-lg hover:bg-muted/50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : !paymentPlan ? (
        <p className="text-sm text-muted-foreground">No payment plan set.</p>
      ) : !tranches ? (
        <div>
          <p className="text-sm font-semibold text-foreground">{paymentPlan}</p>
          <p className="text-xs text-muted-foreground mt-1">Free-form plan — not decomposable into tranches.</p>
        </div>
      ) : (
        <>
          <p className="text-sm font-semibold text-foreground mb-3">{paymentPlan}</p>
          <div className="space-y-2">
            {tranches.map((t) => (
              <div key={t.label} className="flex items-center gap-3">
                <div className="w-32 text-xs text-muted-foreground">{t.label}</div>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full"
                    style={{ width: `${Math.min(100, t.pct)}%` }}
                  />
                </div>
                <div className="w-16 text-right">
                  <span className="text-xs font-semibold text-foreground">{t.pct}%</span>
                </div>
                <div className="w-32 text-right">
                  <span className="text-xs font-semibold text-foreground">
                    {formatAED(t.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Indicative split based on current asking price. Actual milestones live on the deal's payment schedule.
          </p>
        </>
      )}
    </div>
  );
}
