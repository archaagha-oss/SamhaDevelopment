import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useUnitHistory } from "../hooks/useUnit";
export default function UnitHistory({ unitId, createdAt }) {
    const { data, isLoading, error } = useUnitHistory(unitId);
    if (error) {
        return (_jsx("div", { className: "bg-white rounded-lg border border-slate-200 p-6", children: _jsx("p", { className: "text-red-600 text-sm", children: "Failed to load history" }) }));
    }
    const statusHistory = data?.data?.statusHistory || [];
    const priceHistory = data?.data?.priceHistory || [];
    // Combine into unified timeline
    const timeline = [
        // Created event (oldest)
        { id: "created", type: "created", date: createdAt },
        // Status changes
        ...statusHistory.map((h, idx) => ({
            id: `status-${idx}`,
            type: "status",
            date: h.changedAt,
            oldStatus: h.oldStatus,
            newStatus: h.newStatus,
            reason: h.reason,
            changedBy: h.changedBy,
        })),
        // Price changes
        ...priceHistory.map((p, idx) => ({
            id: `price-${idx}`,
            type: "price",
            date: p.changedAt,
            oldPrice: p.oldPrice,
            newPrice: p.newPrice,
            reason: p.reason,
            changedBy: p.changedBy,
        })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const isEmpty = statusHistory.length === 0 && priceHistory.length === 0;
    return (_jsxs("div", { className: "bg-white rounded-lg border border-slate-200 p-6", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4", children: "Timeline" }), isLoading ? (_jsx("div", { className: "space-y-3", children: [1, 2, 3].map((i) => (_jsx("div", { className: "h-14 bg-slate-100 rounded-lg animate-pulse" }, i))) })) : isEmpty ? (_jsx("p", { className: "text-slate-500 text-sm text-center py-6", children: "No changes yet" })) : (_jsxs("div", { className: "space-y-0 relative", children: [_jsx("div", { className: "absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" }), timeline.map((event) => {
                        const isStatus = event.type === "status";
                        const isPrice = event.type === "price";
                        const isCreated = event.type === "created";
                        const bgColor = isStatus ? "bg-blue-100" : isPrice ? "bg-emerald-100" : "bg-slate-100";
                        const dotLabel = isStatus ? "📊" : isPrice ? "💰" : "✨";
                        return (_jsxs("div", { className: "flex gap-4 pb-4 relative", children: [_jsx("div", { className: `w-10 h-10 rounded-full ${bgColor} flex items-center justify-center text-sm flex-shrink-0 relative z-10 border-4 border-white`, children: dotLabel }), _jsxs("div", { className: "flex-1 pt-1 pb-3", children: [isCreated && (_jsxs("div", { className: "bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100", children: [_jsx("p", { className: "text-xs font-semibold text-slate-700", children: "Unit Created" }), _jsx("p", { className: "text-[10px] text-slate-500 mt-0.5", children: new Date(event.date).toLocaleDateString("en-AE", {
                                                        year: "numeric",
                                                        month: "short",
                                                        day: "numeric",
                                                    }) })] })), isStatus && (_jsxs("div", { className: "bg-blue-50 rounded-lg px-3 py-2.5 border border-blue-100", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("span", { className: "font-mono text-xs font-semibold text-slate-700", children: event.oldStatus?.replace(/_/g, " ") }), _jsx("span", { className: "text-slate-400 text-xs", children: "\u2192" }), _jsx("span", { className: "font-mono text-xs font-semibold text-blue-700", children: event.newStatus?.replace(/_/g, " ") })] }), event.reason && (_jsx("p", { className: "text-[10px] text-blue-600 mb-1", children: event.reason })), _jsxs("p", { className: "text-[10px] text-slate-500", children: [new Date(event.date).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" }), event.changedBy && _jsxs("span", { className: "ml-1", children: ["\u00B7 ", event.changedBy] })] })] })), isPrice && (_jsxs("div", { className: "bg-emerald-50 rounded-lg px-3 py-2.5 border border-emerald-100", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsxs("span", { className: "text-xs font-semibold text-slate-700", children: ["AED ", event.oldPrice?.toLocaleString("en-AE")] }), _jsx("span", { className: "text-slate-400 text-xs", children: "\u2192" }), _jsxs("span", { className: "text-xs font-bold text-emerald-700", children: ["AED ", event.newPrice?.toLocaleString("en-AE")] })] }), _jsx("div", { className: "flex items-center gap-2 mb-1", children: event.oldPrice && event.newPrice && (_jsxs(_Fragment, { children: [_jsxs("span", { className: `text-[10px] font-semibold ${event.newPrice > event.oldPrice
                                                                    ? "text-emerald-600"
                                                                    : "text-red-600"}`, children: [event.newPrice > event.oldPrice ? "▲" : "▼", Math.abs(((event.newPrice - event.oldPrice) / event.oldPrice) * 100).toFixed(1), "%"] }), _jsxs("span", { className: "text-[10px] text-emerald-600", children: [event.newPrice > event.oldPrice ? "+" : "", "AED ", (event.newPrice - event.oldPrice).toLocaleString("en-AE")] })] })) }), event.reason && (_jsx("p", { className: "text-[10px] text-emerald-600 mb-1", children: event.reason })), _jsxs("p", { className: "text-[10px] text-slate-500", children: [new Date(event.date).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" }), event.changedBy && _jsxs("span", { className: "ml-1", children: ["\u00B7 ", event.changedBy] })] })] }))] })] }, event.id));
                    })] }))] }));
}
