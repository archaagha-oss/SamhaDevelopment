import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
/**
 * OverdueAlertsTable - Interactive table of overdue payments
 * Features:
 * - Sortable columns
 * - Color-coded urgency (red = critical, orange = warning)
 * - Pagination support
 * - Click-through to deal details
 * - Responsive table layout
 */
export default function OverdueAlertsTable({ data, loading = false, onNavigateDeal, onPageChange, pageCount = 1, currentPage = 0, }) {
    const [sortField, setSortField] = useState("daysOverdue");
    const [sortOrder, setSortOrder] = useState("desc");
    // Sort data
    const sortedData = [...data].sort((a, b) => {
        let aVal = a[sortField];
        let bVal = b[sortField];
        if (sortField === "dueDate") {
            aVal = new Date(aVal).getTime();
            bVal = new Date(bVal).getTime();
        }
        if (sortOrder === "asc") {
            return aVal > bVal ? 1 : -1;
        }
        else {
            return aVal < bVal ? 1 : -1;
        }
    });
    // Toggle sort
    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        }
        else {
            setSortField(field);
            setSortOrder("desc");
        }
    };
    // Get urgency color
    const getUrgencyColor = (daysOverdue) => {
        if (daysOverdue > 7)
            return "bg-red-100 text-red-900";
        if (daysOverdue > 3)
            return "bg-orange-100 text-orange-900";
        return "bg-amber-100 text-amber-900";
    };
    const SortIcon = ({ field }) => {
        if (sortField !== field)
            return _jsx("span", { className: "text-slate-300", children: "\u2195" });
        return sortOrder === "asc" ? _jsx("span", { className: "text-blue-600", children: "\u2191" }) : _jsx("span", { className: "text-blue-600", children: "\u2193" });
    };
    if (loading && data.length === 0) {
        return (_jsx("div", { className: "flex items-center justify-center py-8", children: _jsx("div", { className: "w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    }
    if (data.length === 0) {
        return (_jsx("div", { className: "text-center py-8", children: _jsx("p", { className: "text-sm text-slate-600", children: "\u2713 No overdue payments - All on track!" }) }));
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-200", children: [_jsx("th", { className: "text-left px-4 py-3 font-semibold text-slate-900", children: "Deal" }), _jsx("th", { className: "text-left px-4 py-3 font-semibold text-slate-900", children: "Lead Name" }), _jsx("th", { className: "text-right px-4 py-3 font-semibold text-slate-900 cursor-pointer hover:text-blue-600", onClick: () => handleSort("amount"), children: _jsxs("div", { className: "flex items-center justify-end gap-1", children: ["Amount ", _jsx(SortIcon, { field: "amount" })] }) }), _jsx("th", { className: "text-left px-4 py-3 font-semibold text-slate-900", children: "Milestone" }), _jsx("th", { className: "text-center px-4 py-3 font-semibold text-slate-900 cursor-pointer hover:text-blue-600", onClick: () => handleSort("daysOverdue"), children: _jsxs("div", { className: "flex items-center justify-center gap-1", children: ["Days Overdue ", _jsx(SortIcon, { field: "daysOverdue" })] }) }), _jsx("th", { className: "text-center px-4 py-3 font-semibold text-slate-900", children: "Action" })] }) }), _jsx("tbody", { children: sortedData.map((payment) => (_jsxs("tr", { className: "border-b border-slate-200 hover:bg-slate-50 transition", children: [_jsx("td", { className: "px-4 py-3", children: _jsx("button", { onClick: () => onNavigateDeal(payment.dealId), className: "font-semibold text-blue-600 hover:underline", children: payment.dealNumber }) }), _jsx("td", { className: "px-4 py-3 text-slate-700", children: payment.leadName }), _jsxs("td", { className: "px-4 py-3 text-right font-semibold text-slate-900", children: ["AED ", payment.amount.toLocaleString()] }), _jsx("td", { className: "px-4 py-3 text-slate-600", children: payment.milestoneLabel }), _jsx("td", { className: "px-4 py-3 text-center", children: _jsxs("span", { className: `inline-block px-3 py-1 rounded font-semibold ${getUrgencyColor(payment.daysOverdue)}`, children: [payment.daysOverdue, "d"] }) }), _jsx("td", { className: "px-4 py-3 text-center", children: _jsx("button", { onClick: () => onNavigateDeal(payment.dealId), className: "px-3 py-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition", children: "View Deal" }) })] }, payment.id))) })] }) }), pageCount > 1 && onPageChange && (_jsxs("div", { className: "flex items-center justify-center gap-2 pt-4 border-t border-slate-200", children: [_jsx("button", { disabled: currentPage === 0, onClick: () => onPageChange(currentPage - 1), className: "px-3 py-1 text-sm border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50", children: "\u2190 Previous" }), _jsxs("span", { className: "text-xs text-slate-600", children: ["Page ", currentPage + 1, " of ", pageCount] }), _jsx("button", { disabled: currentPage >= pageCount - 1, onClick: () => onPageChange(currentPage + 1), className: "px-3 py-1 text-sm border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50", children: "Next \u2192" })] })), _jsx("p", { className: "text-xs text-slate-500 mt-4 md:hidden", children: "\uD83D\uDCA1 Swipe left/right to see more columns" })] }));
}
