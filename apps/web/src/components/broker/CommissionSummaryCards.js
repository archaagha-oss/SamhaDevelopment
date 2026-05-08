import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import MetricsCard from "../finance/MetricsCard";
/**
 * CommissionSummaryCards - Display commission metrics in a 2x4 grid
 * Shows: Earned, Approved, Pending, Paid (amounts + deal counts)
 */
export default function CommissionSummaryCards({ data }) {
    return (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsx(MetricsCard, { label: "Total Earned", value: `AED ${(data.totalEarned / 1000000).toFixed(1)}M`, subtext: `${data.totalDeals} deals`, trend: "stable" }), _jsx(MetricsCard, { label: "Approved", value: `AED ${(data.approved / 1000000).toFixed(1)}M`, subtext: `${data.approvedDeals} deals`, trend: "up", className: "bg-emerald-50 border-emerald-200" }), _jsx(MetricsCard, { label: "Pending Approval", value: `AED ${(data.pending / 1000000).toFixed(1)}M`, subtext: `${data.pendingDeals} deals`, trend: "stable", className: "bg-amber-50 border-amber-200" }), _jsx(MetricsCard, { label: "Paid", value: `AED ${(data.paid / 1000000).toFixed(1)}M`, subtext: `${data.paidDeals} deals`, trend: "up", className: "bg-blue-50 border-blue-200" })] }));
}
