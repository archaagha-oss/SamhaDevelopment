import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
const CHANNEL_ICON = { EMAIL: "✉️", WHATSAPP: "💬", SMS: "📱" };
const STATUS_TINT = {
    UNCLAIMED: "bg-amber-100 text-amber-800",
    CLAIMED: "bg-blue-100 text-blue-800",
    RESOLVED: "bg-emerald-100 text-emerald-800",
    DISCARDED: "bg-slate-100 text-slate-500",
};
function timeAgo(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60)
        return "just now";
    if (diff < 3600)
        return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)
        return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}
export default function HotInboxPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("UNCLAIMED");
    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const r = await axios.get(`/api/triage`, { params: { status: filter } });
            setRows(r.data.data ?? []);
        }
        catch (err) {
            toast.error(err.response?.data?.error ?? "Failed to load inbox");
        }
        finally {
            setLoading(false);
        }
    }, [filter]);
    useEffect(() => { reload(); }, [reload]);
    return (_jsxs("div", { className: "p-6 max-w-5xl mx-auto", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-slate-900", children: "Hot Inbox" }), _jsx("p", { className: "text-sm text-slate-500", children: "Inbound messages we couldn't auto-attach. Match each to a lead so it lands on their conversation." })] }), _jsx("div", { className: "flex gap-1 bg-slate-100 rounded-lg p-1", children: ["UNCLAIMED", "CLAIMED", "ALL"].map((f) => (_jsx("button", { onClick: () => setFilter(f), className: `px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`, children: f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase() }, f))) })] }), loading ? (_jsx("div", { className: "bg-white rounded-xl border border-slate-200 px-5 py-12 text-center text-slate-400 text-sm", children: "Loading\u2026" })) : rows.length === 0 ? (_jsx("div", { className: "bg-white rounded-xl border border-slate-200 px-5 py-12 text-center", children: _jsx("p", { className: "text-slate-400 text-sm", children: filter === "UNCLAIMED" ? "🎉 Nothing waiting in the inbox." : "No messages match this filter." }) })) : (_jsx("div", { className: "space-y-3", children: rows.map((row) => (_jsx(TriageCard, { row: row, onAction: reload }, row.id))) }))] }));
}
// ─── Single triage row card ──────────────────────────────────────────────────
function TriageCard({ row, onAction }) {
    const [expanded, setExpanded] = useState(false);
    const [matchOpen, setMatchOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const claim = async () => {
        setBusy(true);
        try {
            await axios.patch(`/api/triage/${row.id}/claim`);
            onAction();
        }
        catch (err) {
            toast.error(err.response?.data?.error ?? "Claim failed");
        }
        finally {
            setBusy(false);
        }
    };
    const discard = async () => {
        if (!confirm("Discard this message? (won't notify anyone)"))
            return;
        setBusy(true);
        try {
            await axios.patch(`/api/triage/${row.id}/discard`);
            onAction();
        }
        catch (err) {
            toast.error(err.response?.data?.error ?? "Discard failed");
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: "bg-white rounded-xl border border-slate-200 overflow-hidden", children: [_jsxs("div", { className: "px-4 py-3 flex items-start gap-3", children: [_jsx("span", { className: "text-xl flex-shrink-0", children: CHANNEL_ICON[row.channel] ?? "📨" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: "text-sm font-semibold text-slate-800", children: row.fromAddress }), _jsx("span", { className: `text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${STATUS_TINT[row.status] ?? "bg-slate-100 text-slate-500"}`, children: row.status }), _jsxs("span", { className: "text-xs text-slate-400", children: ["\u00B7 ", timeAgo(row.receivedAt)] }), _jsxs("span", { className: "text-xs text-slate-400", children: ["\u00B7 ", row.channel] })] }), row.subject && _jsx("p", { className: "text-sm font-medium text-slate-700 mt-0.5", children: row.subject }), _jsx("p", { className: `text-sm text-slate-600 mt-1 ${expanded ? "" : "line-clamp-2"}`, children: row.body || "(no body)" }), row.body && row.body.length > 160 && (_jsx("button", { onClick: () => setExpanded((v) => !v), className: "text-xs text-blue-600 hover:underline mt-1", children: expanded ? "Collapse" : "Expand" }))] }), _jsxs("div", { className: "flex flex-col gap-1.5 flex-shrink-0", children: [row.status === "UNCLAIMED" && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => setMatchOpen(true), disabled: busy, className: "px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50", children: "Attach to lead\u2026" }), _jsx("button", { onClick: claim, disabled: busy, className: "px-3 py-1.5 bg-white text-slate-600 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50", children: "Claim" }), _jsx("button", { onClick: discard, disabled: busy, className: "px-3 py-1.5 bg-white text-red-500 text-xs font-medium border border-red-100 rounded-lg hover:bg-red-50 disabled:opacity-50", children: "Discard" })] })), row.status === "CLAIMED" && (_jsx("button", { onClick: () => setMatchOpen(true), disabled: busy, className: "px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50", children: "Attach to lead\u2026" })), row.status === "RESOLVED" && row.resolvedActivityId && (_jsxs("span", { className: "text-[11px] text-slate-400", children: ["\u2192 Activity ", row.resolvedActivityId.slice(0, 8), "\u2026"] }))] })] }), matchOpen && _jsx(AttachToLeadModal, { row: row, onClose: () => setMatchOpen(false), onAttached: onAction })] }));
}
// ─── "Attach to lead" modal ─────────────────────────────────────────────────
function AttachToLeadModal({ row, onClose, onAttached }) {
    const [query, setQuery] = useState(row.fromAddress);
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [attaching, setAttaching] = useState(false);
    const search = useCallback(async (q) => {
        setSearching(true);
        try {
            const r = await axios.get(`/api/leads`, { params: { search: q, limit: 8 } });
            setResults(r.data.data ?? r.data ?? []);
        }
        catch {
            setResults([]);
        }
        finally {
            setSearching(false);
        }
    }, []);
    useEffect(() => {
        const t = setTimeout(() => { if (query.trim())
            search(query.trim()); }, 250);
        return () => clearTimeout(t);
    }, [query, search]);
    const attach = async (leadId) => {
        setAttaching(true);
        try {
            await axios.patch(`/api/triage/${row.id}/attach`, { leadId });
            toast.success("Attached. The reply now lives on the lead's conversation.");
            onAttached();
            onClose();
        }
        catch (err) {
            toast.error(err.response?.data?.error ?? "Attach failed");
        }
        finally {
            setAttaching(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-2xl w-full max-w-md shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-3.5 border-b border-slate-100", children: [_jsx("h3", { className: "font-semibold text-slate-800 text-sm", children: "Attach to lead" }), _jsx("button", { onClick: onClose, className: "text-slate-400 hover:text-slate-600 text-xl leading-none", children: "\u00D7" })] }), _jsxs("div", { className: "px-5 py-4 space-y-3", children: [_jsxs("p", { className: "text-xs text-slate-500", children: ["Inbound from ", _jsx("span", { className: "font-mono text-slate-700", children: row.fromAddress }), ". Pick the lead this should attach to."] }), _jsx("input", { value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Search leads by name, email, phone\u2026", className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400", autoFocus: true }), _jsxs("div", { className: "max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg", children: [searching && _jsx("p", { className: "px-3 py-4 text-xs text-slate-400 text-center", children: "Searching\u2026" }), !searching && results.length === 0 && _jsx("p", { className: "px-3 py-4 text-xs text-slate-400 text-center", children: "No matches" }), !searching && results.map((lead) => (_jsxs("button", { disabled: attaching, onClick: () => attach(lead.id), className: "w-full text-left px-3 py-2 hover:bg-slate-50 disabled:opacity-50", children: [_jsxs("p", { className: "text-sm font-medium text-slate-800", children: [lead.firstName, " ", lead.lastName] }), _jsxs("p", { className: "text-xs text-slate-400", children: [lead.phone, lead.email ? ` · ${lead.email}` : ""] })] }, lead.id)))] })] })] }) }));
}
