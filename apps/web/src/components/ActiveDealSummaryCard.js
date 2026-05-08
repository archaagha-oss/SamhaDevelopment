import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useNavigate } from "react-router-dom";
const STAGE_TONE = {
    RESERVATION_PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    RESERVATION_CONFIRMED: "bg-amber-50 text-amber-700 border-amber-200",
    SPA_PENDING: "bg-blue-50 text-blue-700 border-blue-200",
    SPA_SENT: "bg-blue-50 text-blue-700 border-blue-200",
    SPA_SIGNED: "bg-violet-50 text-violet-700 border-violet-200",
    OQOOD_PENDING: "bg-violet-50 text-violet-700 border-violet-200",
    OQOOD_REGISTERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    INSTALLMENTS_ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    HANDOVER_PENDING: "bg-indigo-50 text-indigo-700 border-indigo-200",
    COMPLETED: "bg-slate-100 text-slate-600 border-slate-200",
    CANCELLED: "bg-red-50 text-red-700 border-red-200",
};
function daysUntil(dateStr) {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}
export default function ActiveDealSummaryCard({ unit }) {
    const navigate = useNavigate();
    const activeDeal = unit.deals?.[0];
    const activeReservation = unit.reservations?.[0];
    const interestCount = unit.interests?.length ?? 0;
    if (activeDeal) {
        const buyer = `${activeDeal.lead.firstName} ${activeDeal.lead.lastName}`;
        const tone = STAGE_TONE[activeDeal.stage] ?? "bg-slate-100 text-slate-700 border-slate-200";
        return (_jsxs("div", { className: "bg-white rounded-lg border-l-4 border-violet-500 border border-slate-200 px-5 py-3.5 flex items-center gap-4 flex-wrap", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-[10px] font-semibold uppercase tracking-wide text-violet-600", children: "Active deal" }), _jsx("span", { className: "font-mono text-xs font-semibold text-slate-700", children: activeDeal.dealNumber })] }), _jsx("div", { className: "h-4 w-px bg-slate-200" }), _jsx("button", { type: "button", onClick: () => navigate(`/leads/${activeDeal.lead.id}`), className: "text-sm font-semibold text-slate-800 hover:text-blue-700 truncate", title: "Open lead profile", children: buyer }), _jsx("span", { className: `text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${tone}`, children: activeDeal.stage.replace(/_/g, " ") }), _jsxs("div", { className: "ml-auto flex items-center gap-3", children: [_jsxs("span", { className: "text-sm font-bold text-slate-900", children: ["AED ", activeDeal.salePrice.toLocaleString("en-AE")] }), _jsx("button", { type: "button", onClick: () => navigate(`/deals/${activeDeal.id}`), className: "px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-md transition-colors", children: "Open deal \u2192" })] })] }));
    }
    if (activeReservation) {
        const days = daysUntil(activeReservation.expiresAt);
        const urgent = days <= 2;
        const buyer = `${activeReservation.lead.firstName} ${activeReservation.lead.lastName}`;
        return (_jsxs("div", { className: `bg-white rounded-lg border-l-4 border border-slate-200 px-5 py-3.5 flex items-center gap-4 flex-wrap ${urgent ? "border-l-red-500" : "border-l-amber-500"}`, children: [_jsx("div", { className: "flex items-center gap-2", children: _jsx("span", { className: "text-[10px] font-semibold uppercase tracking-wide text-amber-600", children: "Reserved" }) }), _jsx("div", { className: "h-4 w-px bg-slate-200" }), _jsx("button", { type: "button", onClick: () => navigate(`/leads/${activeReservation.lead.id}`), className: "text-sm font-semibold text-slate-800 hover:text-blue-700 truncate", children: buyer }), activeReservation.lead.phone && (_jsx("span", { className: "text-xs text-slate-500", children: activeReservation.lead.phone })), _jsxs("div", { className: "ml-auto flex items-center gap-3", children: [_jsx("span", { className: `text-xs font-semibold ${urgent ? "text-red-600" : "text-slate-700"}`, children: days > 0 ? `${days}d remaining` : "Expired" }), _jsx("button", { type: "button", onClick: () => navigate(`/leads/${activeReservation.lead.id}`), className: "px-3 py-1.5 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold rounded-md transition-colors", children: "View lead \u2192" })] })] }));
    }
    if (interestCount > 0) {
        const primary = unit.interests?.find((i) => i.isPrimary) ?? unit.interests?.[0];
        return (_jsxs("div", { className: "bg-white rounded-lg border-l-4 border-l-blue-400 border border-slate-200 px-5 py-3.5 flex items-center gap-4 flex-wrap", children: [_jsxs("span", { className: "text-[10px] font-semibold uppercase tracking-wide text-blue-600", children: [interestCount, " interested ", interestCount === 1 ? "lead" : "leads"] }), primary && (_jsxs(_Fragment, { children: [_jsx("div", { className: "h-4 w-px bg-slate-200" }), _jsxs("button", { type: "button", onClick: () => navigate(`/leads/${primary.lead.id}`), className: "text-sm font-semibold text-slate-800 hover:text-blue-700 truncate", children: [primary.lead.firstName, " ", primary.lead.lastName, primary.isPrimary && _jsx("span", { className: "ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold", children: "Primary" })] })] })), unit.status === "AVAILABLE" && (_jsx("button", { type: "button", onClick: () => navigate(`/deals?unitId=${unit.id}`), className: "ml-auto px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-colors", children: "+ Create deal" }))] }));
    }
    if (unit.status === "AVAILABLE") {
        return (_jsxs("div", { className: "bg-white rounded-lg border border-dashed border-slate-300 px-5 py-3 flex items-center justify-between", children: [_jsx("p", { className: "text-xs text-slate-500", children: "No active deal, reservation, or interested leads yet" }), _jsx("button", { type: "button", onClick: () => navigate(`/deals?unitId=${unit.id}`), className: "px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-colors", children: "+ Create deal" })] }));
    }
    return null;
}
