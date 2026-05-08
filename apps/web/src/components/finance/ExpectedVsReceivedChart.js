import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
/**
 * ExpectedVsReceivedChart - Monthly payment comparison
 * Shows bar chart comparing expected payments vs actual received
 *
 * Features:
 * - Side-by-side bar comparison
 * - Gap visualization (shortfall highlighting)
 * - Monthly breakdown
 * - Responsive design
 */
export default function ExpectedVsReceivedChart({ data }) {
    // Calculate chart metrics
    const metrics = useMemo(() => {
        const maxAmount = Math.max(...data.flatMap((d) => [d.expected, d.received]));
        const totalExpected = data.reduce((sum, d) => sum + d.expected, 0);
        const totalReceived = data.reduce((sum, d) => sum + d.received, 0);
        const totalGap = totalExpected - totalReceived;
        return { maxAmount, totalExpected, totalReceived, totalGap };
    }, [data]);
    // Format month label
    const formatMonth = (monthStr) => {
        const [year, month] = monthStr.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "space-y-4", children: data.map((item) => {
                    const expectedPercent = (item.expected / metrics.maxAmount) * 100;
                    const receivedPercent = (item.received / metrics.maxAmount) * 100;
                    const gap = item.expected - item.received;
                    const gapPercent = (gap / item.expected) * 100 || 0;
                    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h4", { className: "text-sm font-semibold text-slate-900", children: formatMonth(item.month) }), _jsxs("span", { className: "text-xs text-slate-600", children: ["Gap: ", _jsxs("span", { className: gap > 0 ? "text-red-600 font-semibold" : "text-emerald-600", children: [" AED ", (gap / 1000000).toFixed(1), "M"] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "w-full bg-slate-200 rounded h-6 overflow-hidden relative", children: _jsx("div", { className: "bg-slate-400 h-full flex items-center pl-2", style: { width: `${expectedPercent}%` }, children: expectedPercent > 15 && _jsx("span", { className: "text-xs font-semibold text-white", children: "Expected" }) }) }), _jsxs("p", { className: "text-xs text-slate-600 mt-1", children: ["AED ", (item.expected / 1000000).toFixed(1), "M"] })] }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "w-full bg-emerald-100 rounded h-6 overflow-hidden relative", children: _jsx("div", { className: "bg-emerald-500 h-full flex items-center pl-2", style: { width: `${receivedPercent}%` }, children: receivedPercent > 15 && _jsx("span", { className: "text-xs font-semibold text-white", children: "Received" }) }) }), _jsxs("p", { className: "text-xs text-slate-600 mt-1", children: ["AED ", (item.received / 1000000).toFixed(1), "M"] })] })] }), gap > 0 && (_jsxs("div", { className: "mt-1 text-xs text-red-600", children: ["\u26A0\uFE0F Shortfall: ", gapPercent.toFixed(0), "%"] }))] }, item.month));
                }) }), _jsxs("div", { className: "border-t border-slate-200 pt-4 grid grid-cols-3 gap-3", children: [_jsxs("div", { className: "bg-slate-50 rounded p-3", children: [_jsx("p", { className: "text-xs text-slate-600", children: "Total Expected" }), _jsxs("p", { className: "text-lg font-bold text-slate-900", children: ["AED ", (metrics.totalExpected / 1000000).toFixed(1), "M"] })] }), _jsxs("div", { className: "bg-emerald-50 rounded p-3", children: [_jsx("p", { className: "text-xs text-slate-600", children: "Total Received" }), _jsxs("p", { className: "text-lg font-bold text-emerald-700", children: ["AED ", (metrics.totalReceived / 1000000).toFixed(1), "M"] })] }), _jsxs("div", { className: `rounded p-3 ${metrics.totalGap > 0 ? "bg-red-50" : "bg-emerald-50"}`, children: [_jsx("p", { className: "text-xs text-slate-600", children: "Total Gap" }), _jsxs("p", { className: `text-lg font-bold ${metrics.totalGap > 0 ? "text-red-700" : "text-emerald-700"}`, children: ["AED ", (metrics.totalGap / 1000000).toFixed(1), "M"] })] })] })] }));
}
