import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * CommissionUnlockStatusTable - Shows which deals are waiting for SPA vs Oqood
 * Color-coded by unlock status
 */
export default function CommissionUnlockStatusTable({ data, onNavigateDeal, }) {
    const getStatusColor = (status) => {
        switch (status) {
            case "UNLOCKED":
                return "bg-emerald-50 border-l-emerald-500";
            case "PENDING":
                return "bg-amber-50 border-l-amber-500";
            case "LOCKED":
                return "bg-slate-50 border-l-slate-400";
            case "NOT_DUE":
                return "bg-blue-50 border-l-blue-400";
            default:
                return "bg-white border-l-slate-300";
        }
    };
    const getStatusBadge = (status) => {
        switch (status) {
            case "UNLOCKED":
                return "bg-emerald-100 text-emerald-700";
            case "PENDING":
                return "bg-amber-100 text-amber-700";
            case "LOCKED":
                return "bg-red-100 text-red-700";
            case "NOT_DUE":
                return "bg-blue-100 text-blue-700";
            default:
                return "bg-slate-100 text-slate-700";
        }
    };
    if (data.length === 0) {
        return (_jsx("div", { className: "text-center py-8 text-slate-600", children: _jsx("p", { children: "No commission deals" }) }));
    }
    return (_jsx("div", { className: "space-y-3", children: data.map((item) => (_jsxs("div", { className: `border-l-4 rounded-lg p-4 transition-all ${getStatusColor(item.unlockStatus)}`, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h4", { className: "font-semibold text-slate-900", children: item.dealNumber }), _jsxs("p", { className: "text-sm text-slate-700 mt-1", children: [item.leadName, " - Unit ", item.unitNumber] }), _jsx("p", { className: "text-xs text-slate-600 mt-1", children: item.unlockReason })] }), _jsxs("div", { className: "flex items-center gap-2 flex-shrink-0", children: [_jsx("span", { className: `px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(item.unlockStatus)}`, children: item.unlockStatus.replace(/_/g, " ") }), _jsx("button", { onClick: () => onNavigateDeal(item.id), className: "px-3 py-1 text-xs bg-white border border-slate-300 rounded hover:bg-slate-50 transition", children: "View" })] })] }), item.commission && (_jsxs("div", { className: "mt-3 pt-3 border-t border-current border-opacity-20 flex items-center justify-between text-sm", children: [_jsxs("span", { className: "text-slate-600", children: ["Commission: AED ", item.commission.amount.toLocaleString()] }), _jsx("span", { className: `px-2 py-0.5 rounded text-xs font-semibold ${item.commission.status === "PENDING_APPROVAL" ? "bg-amber-100 text-amber-700" :
                                item.commission.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" :
                                    "bg-slate-100 text-slate-700"}`, children: item.commission.status.replace(/_/g, " ") })] }))] }, item.id))) }));
}
