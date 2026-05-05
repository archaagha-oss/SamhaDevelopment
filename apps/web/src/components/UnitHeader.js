import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from "react-router-dom";
const STATUS_COLORS = {
    NOT_RELEASED: { bg: "bg-gray-100", text: "text-gray-700" },
    AVAILABLE: { bg: "bg-emerald-100", text: "text-emerald-700" },
    ON_HOLD: { bg: "bg-orange-100", text: "text-orange-700" },
    RESERVED: { bg: "bg-amber-100", text: "text-amber-700" },
    BOOKED: { bg: "bg-violet-100", text: "text-violet-700" },
    SOLD: { bg: "bg-red-100", text: "text-red-700" },
    BLOCKED: { bg: "bg-slate-200", text: "text-slate-600" },
    HANDED_OVER: { bg: "bg-teal-100", text: "text-teal-700" },
};
export default function UnitHeader({ unitNumber, status, projectId, projectName }) {
    const navigate = useNavigate();
    const statusConfig = STATUS_COLORS[status] || STATUS_COLORS.AVAILABLE;
    return (_jsx("div", { className: "bg-white border-b border-slate-200 sticky top-0 z-40", children: _jsxs("div", { className: "max-w-7xl mx-auto px-6 py-3", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-xs text-slate-400 mb-2", children: [_jsx("button", { onClick: () => navigate("/projects"), className: "hover:text-slate-700 transition-colors", children: "Projects" }), _jsx("span", { children: "/" }), _jsx("button", { onClick: () => navigate(`/projects/${projectId}`), className: "hover:text-slate-700 transition-colors", children: projectName || "Project" }), _jsx("span", { children: "/" }), _jsxs("span", { className: "text-slate-600 font-medium", children: ["Unit ", unitNumber] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("h1", { className: "text-xl font-bold text-slate-900", children: ["Unit ", unitNumber] }), _jsx("span", { className: `text-xs font-semibold px-2.5 py-1 rounded-full ${statusConfig.bg} ${statusConfig.text}`, children: status.replace(/_/g, " ") })] })] }) }));
}
