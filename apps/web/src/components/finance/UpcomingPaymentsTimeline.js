import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
/**
 * UpcomingPaymentsTimeline - Timeline visualization of upcoming due dates
 * Shows payments organized by date over next 30 days
 *
 * Features:
 * - Expandable date groups
 * - Sorted chronologically
 * - Total amount per date
 * - Deal-specific drill-down
 * - Responsive design
 */
export default function UpcomingPaymentsTimeline({ data, onNavigateDeal, }) {
    const [expandedDates, setExpandedDates] = useState(new Set(data.slice(0, 3).map((item) => item.date)));
    const toggleDate = (date) => {
        const newSet = new Set(expandedDates);
        if (newSet.has(date)) {
            newSet.delete(date);
        }
        else {
            newSet.add(date);
        }
        setExpandedDates(newSet);
    };
    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        // Determine relative day label
        let label = "";
        if (date.toDateString() === today.toDateString()) {
            label = "Today";
        }
        else if (date.toDateString() === tomorrow.toDateString()) {
            label = "Tomorrow";
        }
        else {
            label = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        }
        return label;
    };
    const getDaysUntil = (dateStr) => {
        const date = new Date(dateStr);
        const today = new Date();
        const daysUntil = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil;
    };
    const getUrgencyColor = (daysUntil) => {
        if (daysUntil <= 3)
            return "border-l-red-500 bg-red-50";
        if (daysUntil <= 7)
            return "border-l-amber-500 bg-amber-50";
        return "border-l-blue-500 bg-blue-50";
    };
    const getUrgencyBadge = (daysUntil) => {
        if (daysUntil <= 0)
            return "bg-red-100 text-red-700";
        if (daysUntil <= 3)
            return "bg-red-100 text-red-700";
        if (daysUntil <= 7)
            return "bg-amber-100 text-amber-700";
        return "bg-blue-100 text-blue-700";
    };
    if (data.length === 0) {
        return (_jsx("div", { className: "text-center py-8", children: _jsx("p", { className: "text-sm text-slate-600", children: "\u2713 No upcoming payments due in the next 30 days" }) }));
    }
    return (_jsxs("div", { className: "space-y-3", children: [data.map((item) => {
                const isExpanded = expandedDates.has(item.date);
                const daysUntil = getDaysUntil(item.date);
                return (_jsxs("div", { className: `border-l-4 rounded-lg p-4 transition-all cursor-pointer ${getUrgencyColor(daysUntil)} ${isExpanded ? "ring-2 ring-blue-200" : ""}`, onClick: () => toggleDate(item.date), children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h4", { className: "font-semibold text-slate-900", children: formatDate(item.date) }), _jsxs("p", { className: "text-xs text-slate-600", children: [item.count, " payments \u00B7 AED ", (item.totalAmount / 1000000).toFixed(1), "M"] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("span", { className: `px-3 py-1 rounded-full text-xs font-semibold ${getUrgencyBadge(daysUntil)}`, children: [daysUntil, "d"] }), _jsx("span", { className: `text-xl transition-transform ${isExpanded ? "rotate-180" : ""}`, children: "\u25BC" })] })] }), isExpanded && (_jsx("div", { className: "mt-4 space-y-2 border-t border-current border-opacity-20 pt-4", children: item.payments.map((payment) => (_jsxs("div", { className: "flex items-center justify-between p-2 bg-white rounded hover:shadow-sm transition", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-semibold text-slate-900", children: payment.dealNumber }), _jsx("p", { className: "text-xs text-slate-600", children: payment.leadName }), _jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: payment.milestoneLabel })] }), _jsxs("div", { className: "flex items-center gap-3 flex-shrink-0 ml-3", children: [_jsxs("span", { className: "font-semibold text-slate-900 text-right whitespace-nowrap", children: ["AED ", payment.amount.toLocaleString()] }), _jsx("button", { onClick: (e) => {
                                                    e.stopPropagation();
                                                    onNavigateDeal(payment.id); // Assuming payment.id contains dealId
                                                }, className: "px-3 py-1 text-xs bg-white border border-slate-300 rounded hover:bg-slate-50 transition", children: "View" })] })] }, payment.id))) }))] }, item.date));
            }), _jsx("div", { className: "border-t border-slate-200 pt-4 mt-4", children: _jsxs("div", { className: "grid grid-cols-3 gap-3 text-center", children: [_jsxs("div", { className: "bg-slate-50 rounded p-3", children: [_jsx("p", { className: "text-xs text-slate-600", children: "Due Dates" }), _jsx("p", { className: "text-lg font-bold text-slate-900", children: data.length })] }), _jsxs("div", { className: "bg-slate-50 rounded p-3", children: [_jsx("p", { className: "text-xs text-slate-600", children: "Total Payments" }), _jsx("p", { className: "text-lg font-bold text-slate-900", children: data.reduce((sum, item) => sum + item.count, 0) })] }), _jsxs("div", { className: "bg-slate-50 rounded p-3", children: [_jsx("p", { className: "text-xs text-slate-600", children: "Total Due" }), _jsxs("p", { className: "text-lg font-bold text-slate-900", children: ["AED ", (data.reduce((sum, item) => sum + item.totalAmount, 0) / 1000000).toFixed(1), "M"] })] })] }) })] }));
}
