import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { formatAreaShort } from "../utils/formatArea";
const STATUS_COLORS = {
    NOT_RELEASED: "bg-gray-100 text-gray-600",
    AVAILABLE: "bg-emerald-100 text-emerald-700",
    RESERVED: "bg-amber-100 text-amber-700",
    BOOKED: "bg-violet-100 text-violet-700",
    SOLD: "bg-red-100 text-red-700",
    BLOCKED: "bg-slate-200 text-slate-600",
    HANDED_OVER: "bg-teal-100 text-teal-700",
};
export default function UnitSimilarUnits({ currentUnitId, projectId, type }) {
    const navigate = useNavigate();
    const { data, isLoading } = useQuery({
        queryKey: ["similar-units", projectId, type],
        queryFn: async () => {
            const res = await axios.get("/api/units", {
                params: { projectId, type, limit: 20 },
            });
            const units = res.data.data || res.data;
            return units.filter((u) => u.id !== currentUnitId).slice(0, 6);
        },
        staleTime: 5 * 60 * 1000,
    });
    const units = data ?? [];
    const availableCount = units.filter((u) => u.status === "AVAILABLE").length;
    if (isLoading) {
        return (_jsxs("div", { className: "bg-white rounded-lg border border-slate-200 p-5", children: [_jsx("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3", children: "Similar Units" }), _jsx("div", { className: "space-y-2", children: [1, 2, 3].map((i) => _jsx("div", { className: "h-10 bg-slate-100 rounded animate-pulse" }, i)) })] }));
    }
    if (units.length === 0)
        return null;
    return (_jsxs("div", { className: "bg-white rounded-lg border border-slate-200 p-5", children: [_jsx("div", { className: "flex items-center justify-between mb-1", children: _jsxs("p", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wide", children: ["Similar Units", _jsx("span", { className: "ml-2 text-slate-400 font-normal", children: type.replace(/_/g, " ") })] }) }), _jsxs("p", { className: "text-[10px] text-slate-400 mb-3", children: [availableCount, " of ", units.length, " available in this project"] }), _jsx("div", { className: "space-y-1", children: units.map((u) => (_jsxs("button", { onClick: () => navigate(`/projects/${u.projectId}/units/${u.id}`), className: "w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors text-left group", children: [_jsx("span", { className: "font-mono text-xs font-semibold text-slate-800 w-12 flex-shrink-0 group-hover:text-blue-600", children: u.unitNumber }), _jsxs("span", { className: "text-[10px] text-slate-400 flex-shrink-0", children: ["Fl.", u.floor] }), _jsx("span", { className: "text-[10px] text-slate-400 flex-1", children: formatAreaShort(u.area) }), _jsxs("span", { className: "text-[10px] font-semibold text-slate-700", children: ["AED ", u.price.toLocaleString("en-AE")] }), _jsx("span", { className: `text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[u.status] || "bg-slate-100 text-slate-600"}`, children: u.status.replace(/_/g, " ") })] }, u.id))) })] }));
}
