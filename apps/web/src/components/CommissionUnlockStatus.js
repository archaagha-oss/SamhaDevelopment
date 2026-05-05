import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function CommissionUnlockStatus({ amount, status, spaSignedMet, oqoodRegisteredMet, }) {
    const isUnlocked = status === "PENDING_APPROVAL" || status === "APPROVED" || status === "PAID";
    const isPaid = status === "PAID";
    const isApproved = status === "APPROVED";
    const statusColors = {
        NOT_DUE: "bg-gray-100 text-gray-800",
        PENDING_APPROVAL: "bg-yellow-100 text-yellow-800",
        APPROVED: "bg-blue-100 text-blue-800",
        PAID: "bg-green-100 text-green-800",
        CANCELLED: "bg-red-100 text-red-800",
    };
    return (_jsxs("div", { className: "p-4 rounded-lg border border-purple-200 bg-purple-50", children: [_jsxs("div", { className: "flex justify-between items-start mb-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-gray-700", children: "Broker Commission" }), _jsxs("p", { className: "text-2xl font-bold text-purple-700", children: [amount.toLocaleString(), " AED"] })] }), _jsx("span", { className: `px-3 py-1 rounded-full text-xs font-semibold ${statusColors[status] || statusColors.NOT_DUE}`, children: status.replace(/_/g, " ") })] }), _jsxs("div", { className: "space-y-2 mb-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: `w-5 h-5 rounded border flex items-center justify-center ${spaSignedMet
                                    ? "bg-green-500 border-green-600"
                                    : "bg-gray-200 border-gray-300"}`, children: spaSignedMet && _jsx("span", { className: "text-white text-xs", children: "\u2713" }) }), _jsxs("span", { className: "text-sm", children: ["SPA Signed ", _jsx("span", { className: "text-gray-600", children: "(Sales Purchase Agreement)" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: `w-5 h-5 rounded border flex items-center justify-center ${oqoodRegisteredMet
                                    ? "bg-green-500 border-green-600"
                                    : "bg-gray-200 border-gray-300"}`, children: oqoodRegisteredMet && _jsx("span", { className: "text-white text-xs", children: "\u2713" }) }), _jsxs("span", { className: "text-sm", children: ["Oqood Registered ", _jsx("span", { className: "text-gray-600", children: "(UAE Property Registration)" })] })] })] }), !isUnlocked && (_jsxs("div", { className: "bg-white rounded p-3 border border-gray-200", children: [_jsx("p", { className: "text-xs font-semibold text-gray-700 mb-2", children: "Commission will unlock when both conditions are met:" }), _jsxs("ul", { className: "text-xs text-gray-600 space-y-1", children: [_jsxs("li", { children: [spaSignedMet ? "✅" : "⭕", " SPA (Sales Purchase Agreement) is signed"] }), _jsxs("li", { children: [oqoodRegisteredMet ? "✅" : "⭕", " Oqood is registered with UAE authorities"] })] })] })), isUnlocked && (_jsxs("div", { className: "bg-green-50 border border-green-200 rounded p-3", children: [_jsx("p", { className: "text-xs font-semibold text-green-800", children: "\u2705 All conditions met! Commission is unlocked." }), isApproved && (_jsx("p", { className: "text-xs text-green-700 mt-1", children: "Approved and ready for payment." })), isPaid && (_jsx("p", { className: "text-xs text-green-700 mt-1", children: "Commission has been paid." }))] }))] }));
}
