import { useEffect, useState } from "react";
import axios from "axios";
import { formatAED as fmtAED } from "../lib/format";

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
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-3 h-3 border-2 border-border border-t-transparent rounded-full animate-spin" />
          Computing SPA rules…
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <p className="text-xs text-destructive">{error ?? "No data"}</p>
      </div>
    );
  }

  const { lateFees, disposal, delayCompensation, liquidatedDamages, rules, paidPercentage } = data;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">SPA Compliance</h3>
        <p className="text-xs text-muted-foreground">As of {fmtDate(data.asOf)}</p>
      </div>

      {/* Late fees */}
      <div
        className={`rounded-xl border p-3 ${
          lateFees.overdueCount > 0
            ? "border-warning/30 bg-warning-soft"
            : "border-border bg-muted/50"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Late Fees</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {rules.lateFeeMonthlyPercent}%/month, daily accrual, monthly compounding
            </p>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold ${lateFees.overdueCount > 0 ? "text-warning" : "text-foreground"}`}>
              {fmtAED(lateFees.totalAccrued)}
            </p>
            <p className="text-xs text-muted-foreground">{lateFees.overdueCount} overdue instalment{lateFees.overdueCount === 1 ? "" : "s"}</p>
          </div>
        </div>
        {lateFees.perPayment.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground">
              Per-instalment breakdown
            </summary>
            <table className="w-full mt-2 text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 font-medium">Milestone</th>
                  <th className="py-1 font-medium text-right">Amount</th>
                  <th className="py-1 font-medium text-right">Days late</th>
                  <th className="py-1 font-medium text-right">Accrued</th>
                </tr>
              </thead>
              <tbody>
                {lateFees.perPayment.map((p) => (
                  <tr key={p.paymentId} className="border-t border-warning/30">
                    <td className="py-1 text-foreground">{p.label}</td>
                    <td className="py-1 text-right text-foreground">{fmtAED(p.amount)}</td>
                    <td className="py-1 text-right text-muted-foreground">{p.daysOverdue}</td>
                    <td className="py-1 text-right font-semibold text-warning">{fmtAED(p.accruedFee)}</td>
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
            ? "border-success/30 bg-success-soft"
            : "border-border bg-muted/50"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Disposal / Resale</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Threshold {disposal.thresholdPercent}% paid · processing fee {fmtAED(disposal.processingFee)}
            </p>
          </div>
          <div className="text-right">
            <p
              className={`text-sm font-bold ${
                disposal.allowed ? "text-success" : "text-foreground"
              }`}
            >
              {disposal.allowed ? "Allowed" : "Blocked"}
            </p>
            <p className="text-xs text-muted-foreground">
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
            ? "border-accent-2/30 bg-stage-active"
            : "border-border bg-muted/50"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Delay Compensation</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {rules.delayCompensationAnnualPercent}%/year of paid · cap {rules.delayCompensationCapPercent}% of price · grace {rules.gracePeriodMonths}mo
            </p>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold ${delayCompensation.eligible ? "text-accent-2" : "text-foreground"}`}>
              {fmtAED(delayCompensation.cappedAmount)}
            </p>
            <p className="text-xs text-muted-foreground">
              {delayCompensation.eligible
                ? `${delayCompensation.monthsDelayedAfterGrace.toFixed(1)} mo past grace`
                : `Grace ends ${fmtDate(delayCompensation.graceEndDate)}`}
              {delayCompensation.capApplied && " (capped)"}
            </p>
          </div>
        </div>
      </div>

      {/* Liquidated damages — informational only */}
      <div className="rounded-xl border border-border bg-muted/50 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Liquidated Damages on Default
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {liquidatedDamages.percentage}% of purchase price after 30-day cure
            </p>
          </div>
          <p className="text-lg font-bold text-foreground">{fmtAED(liquidatedDamages.amount)}</p>
        </div>
      </div>
    </div>
  );
}
