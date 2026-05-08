import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import axios from "axios";
const fmtAED = (n) => "AED " + n.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDate = (d) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
// Read-only summary of the four SPA business rules for one deal:
//   late fees, disposal threshold, delay compensation, liquidated damages.
// Source of truth is GET /api/deals/:id/spa-rules.
export default function DealSpaCompliancePanel({ dealId }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        setLoading(true);
        axios
            .get(`/api/deals/${dealId}/spa-rules`)
            .then((r) => setData(r.data))
            .catch((e) => setError(e.response?.data?.error || "Failed to load SPA rules"))
            .finally(() => setLoading(false));
    }, [dealId]);
    if (loading) {
        return (_jsx("div", { className: "bg-white rounded-2xl border border-slate-100 p-5", children: _jsxs("div", { className: "flex items-center gap-2 text-xs text-slate-400", children: [_jsx("div", { className: "w-3 h-3 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" }), "Computing SPA rules\u2026"] }) }));
    }
    if (error || !data) {
        return (_jsx("div", { className: "bg-white rounded-2xl border border-slate-100 p-5", children: _jsx("p", { className: "text-xs text-red-600", children: error ?? "No data" }) }));
    }
    const { lateFees, disposal, delayCompensation, liquidatedDamages, rules, paidPercentage } = data;
    return (_jsxs("div", { className: "bg-white rounded-2xl border border-slate-100 p-5 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-bold text-slate-800", children: "SPA Compliance" }), _jsxs("p", { className: "text-xs text-slate-400", children: ["As of ", fmtDate(data.asOf)] })] }), _jsxs("div", { className: `rounded-xl border p-3 ${lateFees.overdueCount > 0
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-100 bg-slate-50"}`, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-bold uppercase tracking-wide text-slate-600", children: "Late Fees" }), _jsxs("p", { className: "text-xs text-slate-500 mt-0.5", children: [rules.lateFeeMonthlyPercent, "%/month, daily accrual, monthly compounding"] })] }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: `text-lg font-bold ${lateFees.overdueCount > 0 ? "text-amber-700" : "text-slate-700"}`, children: fmtAED(lateFees.totalAccrued) }), _jsxs("p", { className: "text-xs text-slate-500", children: [lateFees.overdueCount, " overdue instalment", lateFees.overdueCount === 1 ? "" : "s"] })] })] }), lateFees.perPayment.length > 0 && (_jsxs("details", { className: "mt-3", children: [_jsx("summary", { className: "text-xs text-slate-600 cursor-pointer select-none hover:text-slate-900", children: "Per-instalment breakdown" }), _jsxs("table", { className: "w-full mt-2 text-xs", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-slate-500", children: [_jsx("th", { className: "py-1 font-medium", children: "Milestone" }), _jsx("th", { className: "py-1 font-medium text-right", children: "Amount" }), _jsx("th", { className: "py-1 font-medium text-right", children: "Days late" }), _jsx("th", { className: "py-1 font-medium text-right", children: "Accrued" })] }) }), _jsx("tbody", { children: lateFees.perPayment.map((p) => (_jsxs("tr", { className: "border-t border-amber-100", children: [_jsx("td", { className: "py-1 text-slate-700", children: p.label }), _jsx("td", { className: "py-1 text-right text-slate-700", children: fmtAED(p.amount) }), _jsx("td", { className: "py-1 text-right text-slate-500", children: p.daysOverdue }), _jsx("td", { className: "py-1 text-right font-semibold text-amber-700", children: fmtAED(p.accruedFee) })] }, p.paymentId))) })] })] }))] }), _jsx("div", { className: `rounded-xl border p-3 ${disposal.allowed
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-slate-100 bg-slate-50"}`, children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-bold uppercase tracking-wide text-slate-600", children: "Disposal / Resale" }), _jsxs("p", { className: "text-xs text-slate-500 mt-0.5", children: ["Threshold ", disposal.thresholdPercent, "% paid \u00B7 processing fee ", fmtAED(disposal.processingFee)] })] }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: `text-sm font-bold ${disposal.allowed ? "text-emerald-700" : "text-slate-700"}`, children: disposal.allowed ? "Allowed" : "Blocked" }), _jsxs("p", { className: "text-xs text-slate-500", children: [paidPercentage.toFixed(2), "% paid", !disposal.allowed && ` · short ${fmtAED(disposal.shortfallAmount)}`] })] })] }) }), _jsx("div", { className: `rounded-xl border p-3 ${delayCompensation.eligible
                    ? "border-violet-200 bg-violet-50"
                    : "border-slate-100 bg-slate-50"}`, children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-bold uppercase tracking-wide text-slate-600", children: "Delay Compensation" }), _jsxs("p", { className: "text-xs text-slate-500 mt-0.5", children: [rules.delayCompensationAnnualPercent, "%/year of paid \u00B7 cap ", rules.delayCompensationCapPercent, "% of price \u00B7 grace ", rules.gracePeriodMonths, "mo"] })] }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: `text-lg font-bold ${delayCompensation.eligible ? "text-violet-700" : "text-slate-700"}`, children: fmtAED(delayCompensation.cappedAmount) }), _jsxs("p", { className: "text-xs text-slate-500", children: [delayCompensation.eligible
                                            ? `${delayCompensation.monthsDelayedAfterGrace.toFixed(1)} mo past grace`
                                            : `Grace ends ${fmtDate(delayCompensation.graceEndDate)}`, delayCompensation.capApplied && " (capped)"] })] })] }) }), _jsx("div", { className: "rounded-xl border border-slate-100 bg-slate-50 p-3", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-bold uppercase tracking-wide text-slate-600", children: "Liquidated Damages on Default" }), _jsxs("p", { className: "text-xs text-slate-500 mt-0.5", children: [liquidatedDamages.percentage, "% of purchase price after 30-day cure"] })] }), _jsx("p", { className: "text-lg font-bold text-slate-700", children: fmtAED(liquidatedDamages.amount) })] }) })] }));
}
