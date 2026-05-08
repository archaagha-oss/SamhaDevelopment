import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { useAgents } from "../hooks/useAgents";
import QuickLeadModal from "./QuickLeadModal";
import ConfirmDialog from "./ConfirmDialog";
import EmptyState from "./EmptyState";
import Breadcrumbs from "./Breadcrumbs";
const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "OFFER_SENT", "SITE_VISIT", "NEGOTIATING", "CLOSED_WON", "CLOSED_LOST"];
const STAGE_STYLE = {
    NEW: { header: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
    CONTACTED: { header: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
    QUALIFIED: { header: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500" },
    OFFER_SENT: { header: "bg-violet-50 text-violet-700", dot: "bg-violet-500" },
    SITE_VISIT: { header: "bg-cyan-50 text-cyan-700", dot: "bg-cyan-500" },
    NEGOTIATING: { header: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
    CLOSED_WON: { header: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
    CLOSED_LOST: { header: "bg-red-50 text-red-700", dot: "bg-red-500" },
};
const SOURCE_COLORS = {
    DIRECT: "bg-blue-100 text-blue-700",
    BROKER: "bg-purple-100 text-purple-700",
    WEBSITE: "bg-cyan-100 text-cyan-700",
    REFERRAL: "bg-emerald-100 text-emerald-700",
};
function daysSince(dateStr) {
    if (!dateStr)
        return null;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}
function isOverdue(dateStr) {
    if (!dateStr)
        return false;
    return new Date(dateStr) < new Date();
}
export default function LeadsPage({ onViewLead } = {}) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data: agents = [] } = useAgents();
    const [searchParams, setSearchParams] = useSearchParams();
    const [search, setSearch] = useState(searchParams.get("q") || "");
    const [stageFilter, setStageFilter] = useState(searchParams.get("stage") || "");
    const [sourceFilter, setSourceFilter] = useState(searchParams.get("source") || "");
    const [agentFilter, setAgentFilter] = useState(searchParams.get("agent") || "");
    const [budgetMin, setBudgetMin] = useState(searchParams.get("min") || "");
    const [budgetMax, setBudgetMax] = useState(searchParams.get("max") || "");
    const [showFilters, setShowFilters] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [allLeads, setAllLeads] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openCardMenuId, setOpenCardMenuId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const searchTimer = useRef(null);
    const fetchLeads = useCallback((q, stage) => {
        setLoading(true);
        setError(null);
        const params = { page: "1", limit: "200" };
        if (q)
            params.search = q;
        if (stage)
            params.stage = stage;
        axios.get("/api/leads", { params })
            .then((r) => {
            const data = r.data.data ?? r.data;
            setAllLeads(Array.isArray(data) ? data : []);
            setTotal(r.data.pagination?.total ?? (Array.isArray(data) ? data.length : 0));
        })
            .catch((err) => setError(err.response?.data?.error || "Failed to load leads"))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => { fetchLeads(search, stageFilter); }, [fetchLeads]);
    // Sync filters → URL
    useEffect(() => {
        const p = {};
        if (search)
            p.q = search;
        if (stageFilter)
            p.stage = stageFilter;
        if (sourceFilter)
            p.source = sourceFilter;
        if (agentFilter)
            p.agent = agentFilter;
        if (budgetMin)
            p.min = budgetMin;
        if (budgetMax)
            p.max = budgetMax;
        setSearchParams(p, { replace: true });
    }, [search, stageFilter, sourceFilter, agentFilter, budgetMin, budgetMax]);
    const handleSearchChange = (val) => {
        setSearch(val);
        if (searchTimer.current)
            clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => fetchLeads(val, stageFilter), 350);
    };
    const handleStageFilter = (stage) => {
        const next = stageFilter === stage ? "" : stage;
        setStageFilter(next);
        fetchLeads(search, next);
    };
    const handleDeleteLead = async (id) => {
        setConfirmDeleteId(id);
    };
    const confirmDelete = async () => {
        const id = confirmDeleteId;
        if (!id)
            return;
        setConfirmDeleteId(null);
        setDeletingId(id);
        try {
            await axios.delete(`/api/leads/${id}`);
            fetchLeads(search, stageFilter);
            queryClient.invalidateQueries({ queryKey: ["leads"] });
        }
        catch (err) {
            toast.error(err.response?.data?.error || "Failed to delete lead");
        }
        finally {
            setDeletingId(null);
        }
    };
    const activeFilterCount = [sourceFilter, agentFilter, budgetMin, budgetMax].filter(Boolean).length;
    const byStage = (stage) => allLeads.filter((l) => {
        if (l.stage !== stage)
            return false;
        if (sourceFilter && l.source !== sourceFilter)
            return false;
        if (agentFilter && l.assignedAgent?.name !== agentFilter)
            return false;
        if (budgetMin && (l.budget ?? 0) < parseFloat(budgetMin))
            return false;
        if (budgetMax && (l.budget ?? Infinity) > parseFloat(budgetMax))
            return false;
        return true;
    });
    const handleCreated = () => {
        fetchLeads(search, stageFilter);
        queryClient.invalidateQueries({ queryKey: ["leads"] });
    };
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "px-4 sm:px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0", children: [_jsx(Breadcrumbs, { variant: "light", className: "mb-2", crumbs: [{ label: "Home", path: "/" }, { label: "Leads" }] }), _jsxs("div", { className: "flex items-center justify-between gap-3 flex-wrap", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("h1", { className: "text-lg font-bold text-slate-900", children: "Leads Pipeline" }), _jsxs("p", { className: "text-slate-400 text-xs mt-0.5", children: [total, " leads total"] })] }), _jsxs("div", { className: "flex items-center gap-2 sm:gap-3 flex-1 sm:flex-initial sm:justify-end min-w-0", children: [_jsx("input", { type: "text", placeholder: "Search name or phone\u2026", value: search, onChange: (e) => handleSearchChange(e.target.value), "aria-label": "Search leads", className: "text-sm border border-slate-200 rounded-lg px-3 py-1.5 flex-1 sm:flex-initial sm:w-52 focus:outline-none focus:border-blue-400 bg-slate-50 min-w-0" }), _jsxs("button", { onClick: () => setShowFilters((v) => !v), "aria-pressed": showFilters, className: `px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${showFilters || activeFilterCount > 0 ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`, children: [_jsx("span", { "aria-hidden": "true", children: "\u229F" }), _jsxs("span", { className: "hidden sm:inline", children: ["Filters", activeFilterCount > 0 ? ` (${activeFilterCount})` : ""] }), _jsx("span", { className: "sm:hidden", children: activeFilterCount > 0 ? `(${activeFilterCount})` : "" })] }), _jsxs("button", { onClick: () => setShowForm(true), className: "px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0", children: [_jsx("span", { className: "text-base leading-none", "aria-hidden": "true", children: "+" }), _jsx("span", { className: "hidden sm:inline", children: "New Lead" }), _jsx("span", { className: "sm:hidden", children: "New" })] })] })] })] }), showFilters && (_jsxs("div", { className: "flex items-center gap-3 px-6 py-3 bg-blue-50/50 border-b border-blue-100 flex-shrink-0 flex-wrap", children: [_jsxs("select", { value: sourceFilter, onChange: (e) => setSourceFilter(e.target.value), className: "text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-blue-400", children: [_jsx("option", { value: "", children: "All Sources" }), ["DIRECT", "BROKER", "WEBSITE", "REFERRAL"].map((s) => _jsx("option", { value: s, children: s }, s))] }), _jsxs("select", { value: agentFilter, onChange: (e) => setAgentFilter(e.target.value), className: "text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-blue-400", children: [_jsx("option", { value: "", children: "All Agents" }), agents.map((a) => _jsx("option", { value: a.name, children: a.name }, a.id))] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("input", { type: "number", placeholder: "Budget min", value: budgetMin, onChange: (e) => setBudgetMin(e.target.value), className: "text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-32 bg-white focus:outline-none focus:border-blue-400" }), _jsx("span", { className: "text-slate-400 text-sm", children: "\u2013" }), _jsx("input", { type: "number", placeholder: "Budget max", value: budgetMax, onChange: (e) => setBudgetMax(e.target.value), className: "text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-32 bg-white focus:outline-none focus:border-blue-400" })] }), activeFilterCount > 0 && (_jsx("button", { onClick: () => { setSourceFilter(""); setAgentFilter(""); setBudgetMin(""); setBudgetMax(""); }, className: "text-xs text-blue-600 hover:underline", children: "Clear filters" }))] })), _jsxs("div", { className: "flex items-center gap-2 px-4 sm:px-6 py-2.5 bg-white border-b border-slate-100 flex-shrink-0 overflow-x-auto scrollbar-thin", role: "tablist", "aria-label": "Filter leads by stage", children: [STAGES.map((s) => {
                        const active = stageFilter === s;
                        const style = STAGE_STYLE[s];
                        return (_jsxs("button", { onClick: () => handleStageFilter(s), role: "tab", "aria-selected": active, className: `flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all shrink-0 ${active
                                ? `${style.header} border-current shadow-sm`
                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`, children: [_jsx("span", { className: `w-1.5 h-1.5 rounded-full ${style.dot}`, "aria-hidden": "true" }), s.replace(/_/g, " ")] }, s));
                    }), stageFilter && (_jsx("button", { onClick: () => handleStageFilter(stageFilter), className: "text-xs text-slate-400 hover:text-slate-600 ml-1 underline shrink-0", children: "Clear" }))] }), _jsx("div", { className: "flex-1 overflow-x-auto scrollbar-thin relative", role: "region", "aria-label": "Leads pipeline. Scroll horizontally to see all stages.", children: loading ? (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }) })) : error ? (_jsxs("div", { className: "flex flex-col items-center justify-center h-64 gap-3", children: [_jsx("p", { className: "text-red-500 text-sm font-medium", children: error }), _jsx("button", { onClick: () => fetchLeads(search, stageFilter), className: "px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700", children: "Retry" })] })) : allLeads.length === 0 ? (_jsx(EmptyState, { icon: "\u25CE", title: search ? "No leads match your search" : "No leads yet", description: search ? "Try different keywords." : "Add your first lead to start filling the pipeline.", action: !search ? { label: "Add Lead", onClick: () => setShowForm(true) } : undefined })) : (_jsx("div", { className: "flex gap-3 p-4 h-full min-w-max", children: STAGES.map((stage) => {
                        const leads = byStage(stage);
                        const style = STAGE_STYLE[stage];
                        return (_jsxs("div", { className: "w-64 flex flex-col bg-slate-50 rounded-xl border border-slate-200 overflow-hidden", children: [_jsxs("div", { className: `flex items-center justify-between px-3 py-2.5 ${style.header}`, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: `w-2 h-2 rounded-full ${style.dot}` }), _jsx("span", { className: "text-xs font-semibold", children: stage.replace(/_/g, " ") })] }), _jsx("span", { className: "text-xs font-bold opacity-70", children: leads.length })] }), _jsx("div", { className: "flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2", children: leads.length === 0 ? (_jsx("div", { className: "py-6 text-center", children: _jsx("p", { className: "text-slate-400 text-xs", children: "No leads in this stage" }) })) : (leads.map((lead) => {
                                        const daysSinceContact = daysSince(lead.lastContactedAt);
                                        const followUpOverdue = isOverdue(lead.nextFollowUpDate);
                                        const stale = daysSinceContact !== null && daysSinceContact > 7;
                                        return (_jsxs("div", { onClick: () => onViewLead ? onViewLead(lead.id) : navigate(`/leads/${lead.id}`), className: "bg-white rounded-lg border border-slate-200 p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all group relative", children: [_jsxs("div", { className: "flex items-start justify-between mb-1.5", children: [_jsxs("p", { className: "text-sm font-semibold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors", children: [lead.firstName, " ", lead.lastName] }), _jsxs("div", { className: "flex items-center gap-1 ml-1 flex-shrink-0", children: [lead.source && (_jsx("span", { className: `text-[10px] px-1.5 py-0.5 rounded font-medium ${SOURCE_COLORS[lead.source] || "bg-slate-100 text-slate-600"}`, children: lead.source })), _jsxs("div", { onClick: (e) => e.stopPropagation(), className: "relative", children: [_jsx("button", { onClick: () => setOpenCardMenuId(openCardMenuId === lead.id ? null : lead.id), className: "p-0.5 text-slate-300 hover:text-slate-600 rounded opacity-0 group-hover:opacity-100 transition-all text-xs leading-none", children: "\u22EE" }), openCardMenuId === lead.id && (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 z-10", onClick: () => setOpenCardMenuId(null) }), _jsxs("div", { className: "absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1", children: [_jsx("button", { onClick: () => { setOpenCardMenuId(null); navigate(`/leads/${lead.id}`); }, className: "w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50", children: "View Profile" }), _jsx("button", { onClick: () => { setOpenCardMenuId(null); handleDeleteLead(lead.id); }, disabled: deletingId === lead.id, className: "w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 disabled:opacity-50", children: "Delete Lead" })] })] }))] })] })] }), _jsx("p", { className: "text-xs text-slate-500 mb-2", children: lead.phone }), lead.budget && (_jsxs("p", { className: "text-xs text-slate-600 mb-1.5", children: [_jsx("span", { className: "text-slate-400", children: "Budget " }), _jsxs("span", { className: "font-medium", children: ["AED ", lead.budget.toLocaleString()] })] })), lead.interests?.length > 0 && (_jsx("p", { className: "text-xs text-slate-500 truncate mb-1.5", children: lead.interests.map((i) => i.unit.unitNumber).join(", ") })), (stale || followUpOverdue) && (_jsxs("div", { className: "flex flex-wrap gap-1 mb-1.5", children: [followUpOverdue && (_jsx("span", { className: "text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-semibold", children: "Follow-up overdue" })), stale && !followUpOverdue && (_jsxs("span", { className: "text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium", children: [daysSinceContact, "d no contact"] }))] })), _jsxs("div", { className: "flex items-center justify-between mt-2 pt-2 border-t border-slate-100", children: [_jsx("span", { className: "text-[10px] text-slate-400", children: lead.assignedAgent?.name || "Unassigned" }), _jsxs("div", { className: "flex items-center gap-2", children: [lead._count && (_jsxs("span", { className: "text-[10px] text-slate-400", children: [lead._count.activities, " act"] })), daysSinceContact !== null && !stale && (_jsx("span", { className: "text-[10px] text-slate-400", children: daysSinceContact === 0 ? "Today" : `${daysSinceContact}d ago` }))] })] })] }, lead.id));
                                    })) })] }, stage));
                    }) })) }), showForm && (_jsx(QuickLeadModal, { onClose: () => setShowForm(false), onCreated: handleCreated })), _jsx(ConfirmDialog, { open: !!confirmDeleteId, title: "Delete Lead", message: "Delete this lead? This cannot be undone.", confirmLabel: "Delete", variant: "danger", onConfirm: confirmDelete, onCancel: () => setConfirmDeleteId(null) })] }));
}
