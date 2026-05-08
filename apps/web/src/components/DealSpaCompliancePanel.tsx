import { useEffect, useState } from "react";
import axios from "axios";

interface Props {
  dealId: string;
}

interface SpaRules {
  asOf: string;
  purchasePrice: number;
  paidAmount: number;
  paidPercentage: number;
  rules: {
    lateFeeMonthlyPercent: number;
    delayCompensationAnnualPercent: number;
    delayCompensationCapPercent: number;
    liquidatedDamagesPercent: number;
    disposalThresholdPercent: number;
    resaleProcessingFee: number;
    gracePeriodMonths: number;
  };
  lateFees: {
    totalAccrued: number;
    overdueCount: number;
    perPayment: Array<{
      paymentId: string;
      label: string;
      amount: number;
      dueDate: string;
      daysOverdue: number;
      accruedFee: number;
    }>;
  };
  disposal: {
    allowed: boolean;
    paidPercent: number;
    thresholdPercent: number;
    shortfallAmount: number;
    processingFee: number;
  };
  delayCompensation: {
    eligible: boolean;
    anticipatedCompletionDate: string;
    graceEndDate: string;
    monthsDelayedAfterGrace: number;
    rawAmount: number;
    cappedAmount: number;
    capApplied: boolean;
  };
  liquidatedDamages: {
    percentage: number;
    amount: number;
    note: string;
  };
}

const fmtAED = (n: number) =>
  "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

// Read-only summary of the four SPA business rules for one deal:
//   late fees, disposal threshold, delay compensation, liquidated damages.
// Source of truth is GET /api/deals/:id/spa-rules.
export default function DealSpaCompliancePanel({ dealId }: Props) {
  const [data, setData] = useState<SpaRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    axios
      .get<SpaRules>(`/api/deals/${dealId}/spa-rules`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || "Failed to load SPA rules"))
      .finally(() => setLoading(false));
  }, [dealId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <div className="w-3 h-3 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
          Computing SPA rules…
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <p className="text-xs text-red-600">{error ?? "No data"}</p>
      </div>
    );
  }

  const { lateFees, disposal, delayCompensation, liquidatedDamages, rules, paidPercentage } = data;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">SPA Compliance</h3>
        <p className="text-xs text-slate-400">As of {fmtDate(data.asOf)}</p>
      </div>

      {/* Late fees */}
      <div
        className={`rounded-xl border p-3 ${
          lateFees.overdueCount > 0
            ? "border-amber-200 bg-amber-50"
            : "border-slate-100 bg-slate-50"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Late Fees</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {rules.lateFeeMonthlyPercent}%/month, daily accrual, monthly compounding
            </p>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold ${lateFees.overdueCount > 0 ? "text-amber-700" : "text-slate-700"}`}>
              {fmtAED(lateFees.totalAccrued)}
            </p>
            <p className="text-xs text-slate-500">{lateFees.overdueCount} overdue instalment{lateFees.overdueCount === 1 ? "" : "s"}</p>
          </div>
        </div>
        {lateFees.perPayment.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-slate-600 cursor-pointer select-none hover:text-slate-900">
              Per-instalment breakdown
            </summary>
            <table className="w-full mt-2 text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 font-medium">Milestone</th>
                  <th className="py-1 font-medium text-right">Amount</th>
                  <th className="py-1 font-medium text-right">Days late</th>
                  <th className="py-1 font-medium text-right">Accrued</th>
                </tr>
              </thead>
              <tbody>
                {lateFees.perPayment.map((p) => (
                  <tr key={p.paymentId} className="border-t border-amber-100">
                    <td className="py-1 text-slate-700">{p.label}</td>
                    <td className="py-1 text-right text-slate-700">{fmtAED(p.amount)}</td>
                    <td className="py-1 text-right text-slate-500">{p.daysOverdue}</td>
                    <td className="py-1 text-right font-semibold text-amber-700">{fmtAED(p.accruedFee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </div>

      {/* Disposal threshold */}
      <div
        className={`rounded-xl border p-3 ${
          disposal.allowed
            ? "border-emerald-200 bg-emerald-50"
            : "border-slate-100 bg-slate-50"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Disposal / Resale</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Threshold {disposal.thresholdPercent}% paid · processing fee {fmtAED(disposal.processingFee)}
            </p>
          </div>
          <div className="text-right">
            <p
              className={`text-sm font-bold ${
                disposal.allowed ? "text-emerald-700" : "text-slate-700"
              }`}
            >
              {disposal.allowed ? "Allowed" : "Blocked"}
            </p>
            <p className="text-xs text-slate-500">
              {paidPercentage.toFixed(2)}% paid
              {!disposal.allowed && ` · short ${fmtAED(disposal.shortfallAmount)}`}
            </p>
          </div>
        </div>
      </div>

      {/* Delay compensation */}
      <div
        className={`rounded-xl border p-3 ${
          delayCompensation.eligible
            ? "border-violet-200 bg-violet-50"
            : "border-slate-100 bg-slate-50"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Delay Compensation</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {rules.delayCompensationAnnualPercent}%/year of paid · cap {rules.delayCompensationCapPercent}% of price · grace {rules.gracePeriodMonths}mo
            </p>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold ${delayCompensation.eligible ? "text-violet-700" : "text-slate-700"}`}>
              {fmtAED(delayCompensation.cappedAmount)}
            </p>
            <p className="text-xs text-slate-500">
              {delayCompensation.eligible
                ? `${delayCompensation.monthsDelayedAfterGrace.toFixed(1)} mo past grace`
                : `Grace ends ${fmtDate(delayCompensation.graceEndDate)}`}
              {delayCompensation.capApplied && " (capped)"}
            </p>
          </div>
        </div>
      </div>

      {/* Liquidated damages — informational only */}
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Liquidated Damages on Default
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {liquidatedDamages.percentage}% of purchase price after 30-day cure
            </p>
          </div>
          <p className="text-lg font-bold text-slate-700">{fmtAED(liquidatedDamages.amount)}</p>
        </div>
      </div>
    </div>
  );
}
