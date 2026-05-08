import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
/**
 * PaymentBreakdownChart - Payment status distribution visualization
 * Shows breakdown of payments by status (Paid, Pending, Overdue, Partial, etc.)
 *
 * Features:
 * - Visual percentage breakdown
 * - Color-coded status indicators
 * - Amount and count display
 * - Responsive design
 */
export default function PaymentBreakdownChart({ data }) {
    // Calculate totals and percentages
    const breakdown = useMemo(() => {
        const total = Object.values(data).reduce((sum, d) => sum + d.amount, 0);
        const totalCount = Object.values(data).reduce((sum, d) => sum + d.count, 0);
        return Object.entries(data).map(([status, values]) => ({
            status,
            amount: values.amount,
            count: values.count,
            percent: total > 0 ? ((values.amount / total) * 100).toFixed(1) : "0",
        }));
    }, [data]);
    // Status colors
    const statusColors = {
        PAID: { bar: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
        PENDING: { bar: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
        OVERDUE: { bar: "bg-red-500", bg: "bg-red-50", text: "text-red-700" },
        PARTIAL: { bar: "bg-orange-500", bg: "bg-orange-50", text: "text-orange-700" },
        PDC_PENDING: { bar: "bg-orange-600", bg: "bg-orange-50", text: "text-orange-700" },
        PDC_CLEARED: { bar: "bg-teal-500", bg: "bg-teal-50", text: "text-teal-700" },
        CANCELLED: { bar: "bg-slate-300", bg: "bg-slate-50", text: "text-slate-600" },
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3", children: breakdown.map((item) => {
                    const colors = statusColors[item.status] || { bar: "bg-slate-400", bg: "bg-slate-50", text: "text-slate-700" };
                    return (_jsxs("div", { className: `${colors.bg} rounded-lg p-3`, children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h4", { className: `text-sm font-semibold ${colors.text}`, children: item.status.replace(/_/g, " ") }), _jsxs("span", { className: `text-xs font-bold ${colors.text}`, children: [item.percent, "%"] })] }), _jsx("div", { className: "w-full bg-white rounded h-2 overflow-hidden border border-slate-200", children: _jsx("div", { className: `${colors.bar} h-full`, style: { width: `${item.percent}%` } }) }), _jsxs("div", { className: "flex items-center justify-between mt-2 text-xs text-slate-600", children: [_jsxs("span", { children: ["AED ", (item.amount / 1000000).toFixed(1), "M"] }), _jsxs("span", { children: [item.count, " payments"] })] })] }, item.status));
                }) }), _jsxs("div", { className: "border-t border-slate-200 pt-4 grid grid-cols-3 gap-4 text-center", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-600", children: "Total Payments" }), _jsx("p", { className: "text-lg font-bold text-slate-900", children: breakdown.reduce((sum, item) => sum + item.count, 0) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-600", children: "Total Amount" }), _jsxs("p", { className: "text-lg font-bold text-slate-900", children: ["AED ", (breakdown.reduce((sum, item) => sum + item.amount, 0) / 1000000).toFixed(1), "M"] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-slate-600", children: "Collection %" }), _jsxs("p", { className: "text-lg font-bold text-emerald-600", children: [breakdown.find((item) => item.status === "PAID")?.percent || "0", "%"] })] })] })] }));
}
