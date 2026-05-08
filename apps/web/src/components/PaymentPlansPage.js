import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import PaymentPlanFormModal from "./PaymentPlanFormModal";
import ConfirmDialog from "./ConfirmDialog";
import EmptyState from "./EmptyState";
import { Skeleton } from "./Skeleton";
const TRIGGER_LABELS = {
    DAYS_FROM_RESERVATION: "Days from Reservation",
    FIXED_DATE: "Fixed Date",
    ON_SPA_SIGNING: "On SPA Signing",
    ON_OQOOD: "On Oqood",
    ON_HANDOVER: "On Handover",
};
const TRIGGER_BADGE_COLORS = {
    DAYS_FROM_RESERVATION: "bg-slate-100 text-slate-600",
    FIXED_DATE: "bg-amber-100 text-amber-700",
    ON_SPA_SIGNING: "bg-blue-100 text-blue-700",
    ON_OQOOD: "bg-purple-100 text-purple-700",
    ON_HANDOVER: "bg-emerald-100 text-emerald-700",
};
function formatMilestoneDue(m) {
    if (m.triggerType === "FIXED_DATE" && m.fixedDate) {
        return new Date(m.fixedDate).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
    }
    if (m.triggerType === "DAYS_FROM_RESERVATION") {
        return m.daysFromReservation != null ? `+${m.daysFromReservation} days` : "—";
    }
    return "—";
}
export default function PaymentPlansPage() {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editPlan, setEditPlan] = useState(null);
    const [deactivating, setDeactivating] = useState(null);
    const [cloning, setCloning] = useState(null);
    const [confirmTogglePlan, setConfirmTogglePlan] = useState(null);
    const [search, setSearch] = useState("");
    const [filterActive, setFilterActive] = useState("active");
    const load = () => {
        setLoading(true);
        axios.get("/api/payment-plans", { params: { includeInactive: true } })
            .then((r) => setPlans(r.data || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);
    const handleDeactivate = (plan, e) => {
        e.stopPropagation();
        setConfirmTogglePlan(plan);
    };
    const doTogglePlan = async () => {
        const plan = confirmTogglePlan;
        if (!plan)
            return;
        setConfirmTogglePlan(null);
        setDeactivating(plan.id);
        try {
            if (plan.isActive) {
                await axios.delete(`/api/payment-plans/${plan.id}`);
                toast.success(`"${plan.name}" deactivated`);
            }
            else {
                await axios.patch(`/api/payment-plans/${plan.id}`, { isActive: true });
                toast.success(`"${plan.name}" reactivated`);
            }
            load();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to update plan");
        }
        finally {
            setDeactivating(null);
        }
    };
    const handleClone = async (plan, e) => {
        e.stopPropagation();
        if (cloning)
            return;
        setCloning(plan.id);
        try {
            const milestones = plan.milestones.map(({ label, percentage, triggerType, isDLDFee, isAdminFee, daysFromReservation, fixedDate, sortOrder }) => ({
                label, percentage, triggerType, isDLDFee, isAdminFee, daysFromReservation, fixedDate, sortOrder,
            }));
            await axios.post("/api/payment-plans", {
                name: `${plan.name} (Copy)`,
                description: plan.description,
                milestones,
            });
            toast.success(`"${plan.name}" cloned`);
            load();
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to clone plan");
        }
        finally {
            setCloning(null);
        }
    };
    const filtered = plans.filter((p) => {
        const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
        const matchActive = filterActive === "all" ? true :
            filterActive === "active" ? p.isActive :
                !p.isActive;
        return matchSearch && matchActive;
    });
    const totalPercent = (milestones) => milestones.reduce((s, m) => s + m.percentage, 0);
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-lg font-bold text-slate-900", children: "Payment Plans" }), _jsxs("p", { className: "text-slate-400 text-xs mt-0.5", children: [plans.filter(p => p.isActive).length, " active templates"] })] }), _jsxs("button", { onClick: () => { setEditPlan(null); setShowForm(true); }, className: "px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5", children: [_jsx("span", { className: "text-base leading-none", children: "+" }), " New Plan"] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("input", { type: "text", placeholder: "Search plans\u2026", value: search, onChange: (e) => setSearch(e.target.value), className: "text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-52 focus:outline-none focus:border-blue-400 bg-slate-50" }), _jsx("div", { className: "flex gap-1", children: ["all", "active", "inactive"].map((f) => (_jsx("button", { onClick: () => setFilterActive(f), className: `px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize ${filterActive === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`, children: f }, f))) })] })] }), _jsx("div", { className: "flex-1 overflow-auto p-6", children: loading ? (_jsx("div", { className: "space-y-3 max-w-4xl", children: Array.from({ length: 4 }).map((_, i) => (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 p-5 space-y-3", children: [_jsx(Skeleton, { className: "h-5 w-1/3" }), _jsx(Skeleton, { className: "h-3 w-2/3" }), _jsx(Skeleton, { className: "h-3 w-1/2" })] }, i))) })) : filtered.length === 0 ? (_jsx(EmptyState, { icon: "\u25EB", title: plans.length === 0 ? "No payment plans yet" : "No plans match your filter", description: plans.length === 0 ? "Define milestone schedules to attach to deals." : "Try adjusting your filters.", action: plans.length === 0 ? { label: "Create first plan", onClick: () => { setEditPlan(null); setShowForm(true); } } : undefined })) : (_jsx("div", { className: "space-y-3 max-w-4xl", children: filtered.map((plan) => {
                        const isExpanded = expandedId === plan.id;
                        const pct = totalPercent(plan.milestones);
                        const deals = plan._count?.deals ?? 0;
                        return (_jsxs("div", { className: `bg-white rounded-xl border transition-all ${isExpanded ? "border-blue-300 shadow-sm" : "border-slate-200 hover:border-slate-300"} ${!plan.isActive ? "opacity-60" : ""}`, children: [_jsxs("div", { className: "flex items-center gap-4 px-5 py-4 cursor-pointer", onClick: () => setExpandedId(isExpanded ? null : plan.id), children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("h3", { className: "font-bold text-slate-900", children: plan.name }), !plan.isActive && (_jsx("span", { className: "text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium", children: "Inactive" })), _jsxs("span", { className: `text-xs px-2 py-0.5 rounded-full font-medium ${pct === 100 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`, children: [pct, "%"] })] }), plan.description && (_jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: plan.description }))] }), _jsxs("div", { className: "flex items-center gap-4 shrink-0 text-sm", children: [_jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-xs text-slate-400", children: "Milestones" }), _jsx("p", { className: "font-bold text-slate-800", children: plan.milestones.length })] }), _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-xs text-slate-400", children: "Deals" }), _jsx("p", { className: "font-bold text-slate-800", children: deals })] }), _jsxs("div", { className: "flex items-center gap-1", onClick: (e) => e.stopPropagation(), children: [_jsx("button", { onClick: (e) => { e.stopPropagation(); setEditPlan(plan); setShowForm(true); }, className: "text-slate-400 hover:text-blue-600 text-sm px-2 py-1 rounded hover:bg-blue-50 transition-colors", title: "Edit plan", children: "\u270E" }), _jsx("button", { onClick: (e) => handleClone(plan, e), disabled: cloning === plan.id, className: "text-slate-400 hover:text-slate-700 text-sm px-2 py-1 rounded hover:bg-slate-100 transition-colors disabled:opacity-40", title: "Clone plan", children: cloning === plan.id ? "…" : "⊕" }), _jsx("button", { onClick: (e) => handleDeactivate(plan, e), disabled: deactivating === plan.id, className: `text-xs px-2 py-1 rounded transition-colors disabled:opacity-40 ${plan.isActive ? "text-red-400 hover:text-red-600 hover:bg-red-50" : "text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50"}`, title: plan.isActive ? "Deactivate" : "Reactivate", children: deactivating === plan.id ? "…" : plan.isActive ? "Deactivate" : "Reactivate" })] }), _jsx("span", { className: "text-slate-300 text-sm", children: isExpanded ? "▲" : "▼" })] })] }), isExpanded && (_jsx("div", { className: "border-t border-slate-100 overflow-x-auto", children: plan.milestones.length === 0 ? (_jsx("p", { className: "px-5 py-4 text-sm text-slate-400 text-center", children: "No milestones defined" })) : (_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-slate-50 text-left", children: [_jsx("th", { className: "px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "#" }), _jsx("th", { className: "px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Label" }), _jsx("th", { className: "px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "%" }), _jsx("th", { className: "px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Trigger" }), _jsx("th", { className: "px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Due Date" }), _jsx("th", { className: "px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide", children: "Flags" })] }) }), _jsx("tbody", { className: "divide-y divide-slate-50", children: plan.milestones.map((m, i) => (_jsxs("tr", { className: "hover:bg-slate-50/60", children: [_jsx("td", { className: "px-5 py-2.5 text-xs text-slate-400", children: i + 1 }), _jsx("td", { className: "px-5 py-2.5 font-medium text-slate-800", children: m.label }), _jsx("td", { className: "px-5 py-2.5", children: _jsxs("span", { className: "font-bold text-slate-900", children: [m.percentage, "%"] }) }), _jsx("td", { className: "px-5 py-2.5", children: _jsx("span", { className: `text-xs px-2 py-0.5 rounded-full font-medium ${TRIGGER_BADGE_COLORS[m.triggerType] ?? "bg-slate-100 text-slate-600"}`, children: TRIGGER_LABELS[m.triggerType] || m.triggerType }) }), _jsx("td", { className: "px-5 py-2.5 text-xs text-slate-500 font-medium", children: formatMilestoneDue(m) }), _jsx("td", { className: "px-5 py-2.5", children: _jsxs("div", { className: "flex gap-1.5", children: [m.isDLDFee && _jsx("span", { className: "text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium", children: "DLD" }), m.isAdminFee && _jsx("span", { className: "text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium", children: "Admin" })] }) })] }, m.id))) }), _jsx("tfoot", { children: _jsxs("tr", { className: "bg-slate-50 border-t border-slate-200", children: [_jsx("td", { colSpan: 2, className: "px-5 py-2.5 text-xs font-semibold text-slate-600", children: "Total" }), _jsx("td", { className: "px-5 py-2.5", children: _jsxs("span", { className: `font-bold text-sm ${pct === 100 ? "text-emerald-700" : "text-red-600"}`, children: [pct, "%"] }) }), _jsx("td", { colSpan: 3 })] }) })] })) }))] }, plan.id));
                    }) })) }), showForm && (_jsx(PaymentPlanFormModal, { plan: editPlan, onClose: () => { setShowForm(false); setEditPlan(null); }, onSaved: () => { setShowForm(false); setEditPlan(null); load(); } })), _jsx(ConfirmDialog, { open: !!confirmTogglePlan, title: confirmTogglePlan?.isActive ? "Deactivate Plan" : "Reactivate Plan", message: confirmTogglePlan?.isActive
                    ? `Deactivate "${confirmTogglePlan?.name}"? It will no longer appear in new deal forms.`
                    : `Reactivate "${confirmTogglePlan?.name}"?`, confirmLabel: confirmTogglePlan?.isActive ? "Deactivate" : "Reactivate", variant: confirmTogglePlan?.isActive ? "danger" : "info", onConfirm: doTogglePlan, onCancel: () => setConfirmTogglePlan(null) })] }));
}
