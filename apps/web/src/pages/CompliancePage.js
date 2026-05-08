import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
const SEVERITY_TINT = {
    EXPIRED: { row: "border-red-200    bg-red-50/40", pill: "bg-red-600 text-white", label: "Expired" },
    CRITICAL: { row: "border-orange-200 bg-orange-50/40", pill: "bg-orange-500 text-white", label: "≤ 14 days" },
    WARNING: { row: "border-amber-200  bg-amber-50/40", pill: "bg-amber-500 text-white", label: "≤ 30 days" },
    ATTENTION: { row: "border-yellow-100 bg-yellow-50/30", pill: "bg-yellow-300 text-yellow-900", label: "≤ 90 days" },
    OK: { row: "border-slate-100  bg-white", pill: "bg-slate-200 text-slate-600", label: "OK" },
};
const KIND_LABEL = {
    BROKER_RERA_LICENSE: "Broker RERA License",
    BROKER_TRADE_LICENSE: "Trade License",
    BROKER_VAT_CERT: "VAT Certificate",
    AGENT_RERA_CARD: "Agent RERA Card",
    AGENT_EID: "Agent Emirates ID",
    BUYER_EID: "Buyer Emirates ID",
};
function fmtDate(iso) {
    return new Date(iso).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
}
function daysLabel(days) {
    if (days < 0)
        return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
    if (days === 0)
        return "today";
    if (days === 1)
        return "in 1 day";
    return `in ${days} days`;
}
function ownerHref(row) {
    if (row.ownerType === "BROKER_COMPANY")
        return `/brokers`;
    if (row.ownerType === "BROKER_AGENT")
        return `/brokers`;
    if (row.ownerType === "LEAD")
        return `/leads/${row.ownerId}`;
    return null;
}
export default function CompliancePage() {
    const [rows, setRows] = useState([]);
    const [counts, setCounts] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("ALL");
    const [horizon, setHorizon] = useState(90);
    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("withinDays", String(horizon));
            params.set("minSeverity", horizon <= 90 ? "ATTENTION" : "ATTENTION");
            if (tab !== "ALL")
                params.set("category", tab);
            const [list, summary] = await Promise.all([
                axios.get(`/api/compliance/expiring?${params.toString()}`),
                axios.get("/api/compliance/expiring/counts"),
            ]);
            setRows(list.data?.data ?? []);
            setCounts(summary.data ?? null);
        }
        finally {
            setLoading(false);
        }
    }, [tab, horizon]);
    useEffect(() => { reload(); }, [reload]);
    const grouped = useMemo(() => {
        const out = { EXPIRED: [], CRITICAL: [], WARNING: [], ATTENTION: [], OK: [] };
        for (const r of rows)
            out[r.severity].push(r);
        return out;
    }, [rows]);
    return (_jsxs("div", { className: "p-6 max-w-6xl mx-auto", children: [_jsxs("div", { className: "flex items-start justify-between mb-5", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold text-slate-900", children: "Compliance Radar" }), _jsx("p", { className: "text-sm text-slate-500 mt-0.5", children: "Every UAE credential expiring within the horizon, sorted by urgency. Stop OQOOD rejections before they happen." })] }), _jsx("div", { className: "flex gap-1 bg-slate-100 rounded-lg p-1", children: [30, 60, 90, 365].map((d) => (_jsx("button", { onClick: () => setHorizon(d), className: `px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${horizon === d ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`, children: d === 365 ? "1 year" : `${d}d` }, d))) })] }), _jsx("div", { className: "grid grid-cols-5 gap-3 mb-5", children: ["EXPIRED", "CRITICAL", "WARNING", "ATTENTION", "OK"].map((sev) => (_jsxs("div", { className: `rounded-xl border ${SEVERITY_TINT[sev].row} px-4 py-3`, children: [_jsx("p", { className: "text-[10px] font-semibold uppercase tracking-wide text-slate-500", children: SEVERITY_TINT[sev].label }), _jsx("p", { className: "text-2xl font-bold text-slate-900 mt-1", children: counts?.[sev] ?? "—" })] }, sev))) }), _jsx("div", { className: "flex gap-1 mb-4 border-b border-slate-200", children: ["ALL", "BROKER", "AGENT", "BUYER"].map((c) => (_jsx("button", { onClick: () => setTab(c), className: `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === c ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`, children: c === "ALL" ? "All" : c === "BROKER" ? "Broker companies" : c === "AGENT" ? "Broker agents" : "Buyers" }, c))) }), loading ? (_jsx("div", { className: "bg-white rounded-xl border border-slate-200 px-5 py-10 text-center text-slate-400 text-sm", children: "Loading\u2026" })) : rows.length === 0 ? (_jsx("div", { className: "bg-white rounded-xl border border-slate-200 px-5 py-10 text-center", children: _jsxs("p", { className: "text-emerald-600 text-sm font-medium", children: ["\uD83C\uDF89 Nothing expiring within ", horizon === 365 ? "a year" : `${horizon} days`, "."] }) })) : (_jsx("div", { className: "space-y-5", children: ["EXPIRED", "CRITICAL", "WARNING", "ATTENTION"].map((sev) => grouped[sev].length > 0 ? (_jsxs("section", { children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("span", { className: `text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${SEVERITY_TINT[sev].pill}`, children: sev }), _jsx("span", { className: "text-xs text-slate-500", children: SEVERITY_TINT[sev].label }), _jsxs("span", { className: "text-xs text-slate-400", children: ["\u00B7 ", grouped[sev].length] })] }), _jsx("div", { className: "space-y-2", children: grouped[sev].map((row, i) => (_jsx(ExpiryRowCard, { row: row }, `${row.kind}-${row.ownerId}-${i}`))) })] }, sev)) : null) }))] }));
}
function ExpiryRowCard({ row }) {
    const tint = SEVERITY_TINT[row.severity];
    const link = ownerHref(row);
    return (_jsxs("div", { className: `rounded-xl border ${tint.row} px-4 py-3 flex items-start gap-3`, children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: "text-sm font-semibold text-slate-800", children: row.ownerName }), _jsx("span", { className: `text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${tint.pill}`, children: row.severity }), row.ownerSubLabel && (_jsxs("span", { className: "text-xs text-slate-500", children: ["\u00B7 ", row.ownerSubLabel] }))] }), _jsxs("p", { className: "text-xs text-slate-500 mt-0.5", children: [KIND_LABEL[row.kind] ?? row.kind, " expires ", _jsx("span", { className: "font-medium text-slate-700", children: fmtDate(row.expiresAt) }), " (", daysLabel(row.daysToExpiry), ")"] })] }), link && (_jsx(Link, { to: link, className: "text-xs text-blue-600 hover:underline flex-shrink-0 mt-0.5", children: "Open \u2192" }))] }));
}
