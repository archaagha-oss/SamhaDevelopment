import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
const TABS = ["all", "leads", "units", "deals"];
// ── helpers ─────────────────────────────────────────────────────────────────
function mapLeads(data) {
    return data.map((l) => ({
        id: l.id,
        title: l.name ?? "Unknown Lead",
        subtitle: [l.email, l.phone].filter(Boolean).join(" · "),
        type: "lead",
        status: l.stage,
    }));
}
function mapUnits(data) {
    return data.map((u) => ({
        id: u.id,
        title: `Unit ${u.unitNumber}`,
        subtitle: [u.type, u.project?.name, u.floor != null ? `Floor ${u.floor}` : undefined]
            .filter(Boolean)
            .join(" · "),
        type: "unit",
        status: u.status,
        projectId: u.projectId,
    }));
}
function mapDeals(data) {
    return data.map((d) => ({
        id: d.id,
        title: d.dealNumber ?? d.id,
        subtitle: [d.lead?.name, d.unit?.unitNumber ? `Unit ${d.unit.unitNumber}` : undefined]
            .filter(Boolean)
            .join(" · "),
        type: "deal",
        status: d.stage,
    }));
}
const statusColor = {
    available: "text-emerald-400",
    reserved: "text-amber-400",
    booked: "text-blue-300",
    sold: "text-blue-400",
    handed_over: "text-purple-400",
    blocked: "text-slate-400",
    new: "text-sky-400",
    contacted: "text-yellow-400",
    qualified: "text-amber-400",
    negotiating: "text-orange-400",
    closed_won: "text-emerald-400",
    closed_lost: "text-red-400",
    spa_signed: "text-blue-300",
    oqood_registered: "text-purple-400",
    cancelled: "text-red-400",
};
function getStatusColor(status) {
    return statusColor[status?.toLowerCase() ?? ""] ?? "text-slate-400";
}
const typeIcon = {
    lead: "◎",
    deal: "◈",
    unit: "⊞",
};
// ── component ────────────────────────────────────────────────────────────────
export default function GlobalSearchModal({ open, onClose }) {
    const navigate = useNavigate();
    const inputRef = useRef(null);
    const debounceRef = useRef(null);
    const itemRefs = useRef([]);
    const [query, setQuery] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [results, setResults] = useState({ leads: [], units: [], deals: [] });
    const [loading, setLoading] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    // Focus input when modal opens, reset state
    useEffect(() => {
        if (open) {
            setQuery("");
            setResults({ leads: [], units: [], deals: [] });
            setActiveTab("all");
            setHighlightedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 40);
        }
    }, [open]);
    // Debounced search
    const doSearch = useCallback(async (q) => {
        if (!q.trim()) {
            setResults({ leads: [], units: [], deals: [] });
            return;
        }
        setLoading(true);
        try {
            const [leadsRes, unitsRes, dealsRes] = await Promise.allSettled([
                axios.get("/api/leads", { params: { search: q, limit: 5 } }),
                axios.get("/api/units", { params: { search: q, limit: 5 } }),
                axios.get("/api/deals", { params: { search: q, limit: 5 } }),
            ]);
            setResults({
                leads: leadsRes.status === "fulfilled"
                    ? mapLeads(leadsRes.value.data.data ?? leadsRes.value.data ?? []) : [],
                units: unitsRes.status === "fulfilled"
                    ? mapUnits(unitsRes.value.data.data ?? unitsRes.value.data ?? []) : [],
                deals: dealsRes.status === "fulfilled"
                    ? mapDeals(dealsRes.value.data.data ?? dealsRes.value.data ?? []) : [],
            });
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        if (debounceRef.current)
            clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(query), 300);
        return () => { if (debounceRef.current)
            clearTimeout(debounceRef.current); };
    }, [query, doSearch]);
    const visible = activeTab === "all"
        ? [...results.leads, ...results.units, ...results.deals]
        : results[activeTab];
    const totalCount = results.leads.length + results.units.length + results.deals.length;
    // Trim itemRefs to match the visible list length
    itemRefs.current.length = visible.length;
    const handleSelect = useCallback((r) => {
        onClose();
        if (r.type === "lead")
            navigate(`/leads/${r.id}`);
        else if (r.type === "deal")
            navigate(`/deals/${r.id}`);
        else if (r.type === "unit" && r.projectId)
            navigate(`/projects/${r.projectId}/units/${r.id}`);
        else
            navigate("/units");
    }, [navigate, onClose]);
    // Reset highlight when results or active tab change
    useEffect(() => { setHighlightedIndex(0); }, [activeTab, query, totalCount]);
    // Keep highlighted item in view
    useEffect(() => {
        itemRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }, [highlightedIndex]);
    // Modal-scoped keyboard handling: Escape, ArrowDown/Up, Enter, Tab cycling tabs
    useEffect(() => {
        if (!open)
            return;
        const handler = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
                return;
            }
            if (e.key === "ArrowDown") {
                if (visible.length === 0)
                    return;
                e.preventDefault();
                setHighlightedIndex((i) => (i + 1) % visible.length);
                return;
            }
            if (e.key === "ArrowUp") {
                if (visible.length === 0)
                    return;
                e.preventDefault();
                setHighlightedIndex((i) => (i - 1 + visible.length) % visible.length);
                return;
            }
            if (e.key === "Home" && visible.length > 0) {
                e.preventDefault();
                setHighlightedIndex(0);
                return;
            }
            if (e.key === "End" && visible.length > 0) {
                e.preventDefault();
                setHighlightedIndex(visible.length - 1);
                return;
            }
            if (e.key === "Enter") {
                const target = visible[highlightedIndex];
                if (target) {
                    e.preventDefault();
                    handleSelect(target);
                }
                return;
            }
            if (e.key === "Tab" && totalCount > 0) {
                e.preventDefault();
                const idx = TABS.indexOf(activeTab);
                const next = e.shiftKey
                    ? TABS[(idx - 1 + TABS.length) % TABS.length]
                    : TABS[(idx + 1) % TABS.length];
                setActiveTab(next);
                return;
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, onClose, visible, highlightedIndex, handleSelect, activeTab, totalCount]);
    if (!open)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4 bg-black/70 backdrop-blur-sm", onClick: onClose, children: _jsxs("div", { className: "bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-700 overflow-hidden", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center gap-3 px-5 py-4 border-b border-slate-700", children: [_jsx("span", { className: "text-slate-400 text-lg flex-shrink-0", children: "\uD83D\uDD0D" }), _jsx("input", { ref: inputRef, type: "text", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Search leads, units, deals\u2026", className: "flex-1 bg-transparent text-slate-100 text-base placeholder-slate-500 focus:outline-none" }), loading && (_jsx("span", { className: "text-slate-500 text-sm flex-shrink-0", children: "Searching\u2026" })), _jsx("button", { onClick: onClose, className: "flex-shrink-0 text-slate-500 hover:text-slate-300 text-xs px-2 py-1 rounded border border-slate-700 font-mono transition-colors", children: "Esc" })] }), query && totalCount > 0 && (_jsx("div", { className: "flex items-center gap-1 px-4 py-2 border-b border-slate-800 bg-slate-900/50", children: TABS.map((tab) => (_jsxs("button", { onClick: () => setActiveTab(tab), className: `px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${activeTab === tab
                            ? "bg-blue-600 text-white"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`, children: [tab, tab !== "all" && results[tab].length > 0 && (_jsx("span", { className: "ml-1.5 opacity-70", children: results[tab].length })), tab === "all" && totalCount > 0 && (_jsx("span", { className: "ml-1.5 opacity-70", children: totalCount }))] }, tab))) })), _jsxs("div", { className: "max-h-[55vh] overflow-y-auto divide-y divide-slate-800/60", children: [!query && (_jsx("div", { className: "px-5 py-12 text-center text-slate-500 text-sm", children: "Start typing to search across leads, units, and deals" })), query && !loading && visible.length === 0 && (_jsxs("div", { className: "px-5 py-12 text-center text-slate-500 text-sm", children: ["No results for ", _jsxs("span", { className: "text-slate-300", children: ["\"", query, "\""] })] })), visible.map((r, i) => (_jsxs("button", { ref: (el) => { itemRefs.current[i] = el; }, onClick: () => handleSelect(r), onMouseEnter: () => setHighlightedIndex(i), className: `w-full flex items-center gap-4 px-5 py-3.5 transition-colors text-left group ${i === highlightedIndex ? "bg-slate-800" : "hover:bg-slate-800"}`, children: [_jsx("span", { className: `text-lg w-5 text-center flex-shrink-0 transition-colors ${i === highlightedIndex ? "text-slate-300" : "text-slate-500 group-hover:text-slate-300"}`, children: typeIcon[r.type] }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-slate-100 text-sm font-medium truncate", children: r.title }), r.subtitle && (_jsx("p", { className: "text-slate-500 text-xs truncate mt-0.5", children: r.subtitle }))] }), _jsxs("div", { className: "flex items-center gap-2 flex-shrink-0", children: [r.status && (_jsx("span", { className: `text-xs font-medium capitalize ${getStatusColor(r.status)}`, children: r.status.toLowerCase().replace(/_/g, " ") })), _jsx("span", { className: "text-[10px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full capitalize border border-slate-700", children: r.type })] })] }, `${r.type}-${r.id}`)))] }), _jsxs("div", { className: "px-5 py-2.5 border-t border-slate-800 flex items-center gap-5 text-[11px] text-slate-600", children: [_jsxs("span", { children: [_jsx("kbd", { className: "font-mono bg-slate-800 px-1 rounded", children: "\u2191\u2193" }), " navigate"] }), _jsxs("span", { children: [_jsx("kbd", { className: "font-mono bg-slate-800 px-1 rounded", children: "\u21B5" }), " select"] }), _jsxs("span", { children: [_jsx("kbd", { className: "font-mono bg-slate-800 px-1 rounded", children: "Esc" }), " close"] })] })] }) }));
}
