import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ApprovedCommissionsTable - Shows approved commissions with payment status
 * Tracks: Amount, Approval date, Payment status, Paid date
 */
export default function ApprovedCommissionsTable({ data, loading = false, onPageChange, pageCount = 1, currentPage = 0, }) {
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center py-8", children: _jsx("div", { className: "w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) }));
    }
    if (data.length === 0) {
        return (_jsx("div", { className: "text-center py-8 text-slate-600", children: _jsx("p", { children: "No approved commissions" }) }));
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-200", children: [_jsx("th", { className: "text-left px-4 py-3 font-semibold text-slate-900", children: "Deal" }), _jsx("th", { className: "text-left px-4 py-3 font-semibold text-slate-900", children: "Lead" }), _jsx("th", { className: "text-right px-4 py-3 font-semibold text-slate-900", children: "Commission" }), _jsx("th", { className: "text-center px-4 py-3 font-semibold text-slate-900", children: "Payment Status" }), _jsx("th", { className: "text-left px-4 py-3 font-semibold text-slate-900", children: "Approved Date" }), _jsx("th", { className: "text-left px-4 py-3 font-semibold text-slate-900", children: "Paid Date" })] }) }), _jsx("tbody", { children: data.map((commission, index) => (_jsxs("tr", { className: `border-b border-slate-200 transition ${index % 2 === 0 ? "bg-slate-50" : "bg-white"} hover:bg-blue-50`, children: [_jsx("td", { className: "px-4 py-3 font-semibold text-slate-900", children: commission.dealNumber }), _jsx("td", { className: "px-4 py-3 text-slate-700", children: commission.leadName }), _jsxs("td", { className: "px-4 py-3 text-right font-semibold text-slate-900", children: ["AED ", commission.amount.toLocaleString()] }), _jsx("td", { className: "px-4 py-3 text-center", children: _jsx("span", { className: `px-3 py-1 rounded text-xs font-semibold ${commission.paidStatus === "PAID"
                                                ? "bg-emerald-100 text-emerald-700"
                                                : "bg-amber-100 text-amber-700"}`, children: commission.paidStatus }) }), _jsx("td", { className: "px-4 py-3 text-slate-600 text-sm", children: commission.approvedDate
                                            ? new Date(commission.approvedDate).toLocaleDateString("en-AE")
                                            : "-" }), _jsx("td", { className: "px-4 py-3 text-slate-600 text-sm", children: commission.paidDate
                                            ? new Date(commission.paidDate).toLocaleDateString("en-AE")
                                            : "-" })] }, commission.id))) })] }) }), pageCount > 1 && onPageChange && (_jsxs("div", { className: "flex items-center justify-center gap-2 pt-4 border-t border-slate-200", children: [_jsx("button", { disabled: currentPage === 0, onClick: () => onPageChange(currentPage - 1), className: "px-3 py-1 text-sm border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50", children: "\u2190 Previous" }), _jsxs("span", { className: "text-xs text-slate-600", children: ["Page ", currentPage + 1, " of ", pageCount] }), _jsx("button", { disabled: currentPage >= pageCount - 1, onClick: () => onPageChange(currentPage + 1), className: "px-3 py-1 text-sm border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50", children: "Next \u2192" })] }))] }));
}
