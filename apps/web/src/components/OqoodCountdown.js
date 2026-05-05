import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function OqoodCountdown({ deadline, daysRemaining, status, isOverdue, }) {
    const statusColors = {
        green: "bg-green-50 border-green-200 text-green-800",
        yellow: "bg-yellow-50 border-yellow-200 text-yellow-800",
        red: "bg-red-50 border-red-200 text-red-800",
        overdue: "bg-red-100 border-red-300 text-red-900",
    };
    const statusIcons = {
        green: "✅",
        yellow: "⚠️",
        red: "🔴",
        overdue: "❌",
    };
    const statusLabels = {
        green: "On Track",
        yellow: "Approaching",
        red: "Urgent",
        overdue: "Overdue",
    };
    return (_jsxs("div", { className: `p-4 rounded border-2 ${statusColors[status]}`, children: [_jsxs("div", { className: "flex items-center gap-3 mb-2", children: [_jsx("span", { className: "text-2xl", children: statusIcons[status] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold", children: "Oqood Registration Deadline" }), _jsx("p", { className: "text-xs opacity-75", children: "UAE legal requirement" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4 mt-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs opacity-75", children: "Deadline" }), _jsx("p", { className: "font-bold text-lg", children: new Date(deadline).toLocaleDateString() })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs opacity-75", children: "Time Remaining" }), _jsx("p", { className: `font-bold text-lg ${isOverdue ? "text-red-600" : ""}`, children: isOverdue ? `${Math.abs(daysRemaining)} days overdue` : `${daysRemaining} days` })] })] }), _jsxs("div", { className: "mt-4", children: [_jsxs("div", { className: "flex justify-between items-center mb-2", children: [_jsx("span", { className: "text-xs font-medium opacity-75", children: "Status" }), _jsx("span", { className: "px-2 py-1 bg-white rounded text-xs font-semibold", children: statusLabels[status] })] }), _jsx("div", { className: "w-full bg-gray-300 rounded-full h-2", children: _jsx("div", { className: `h-2 rounded-full transition-all ${status === "green"
                                ? "bg-green-500"
                                : status === "yellow"
                                    ? "bg-yellow-500"
                                    : "bg-red-600"}`, style: {
                                width: `${Math.max(0, Math.min(100, (daysRemaining / 90) * 100))}%`,
                            } }) })] }), isOverdue && (_jsx("p", { className: "text-xs mt-3 font-semibold", children: "\u26A0\uFE0F This deal requires immediate attention! Oqood registration deadline has passed." }))] }));
}
